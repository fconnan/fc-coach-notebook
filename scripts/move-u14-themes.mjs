import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const data = path.resolve('data');
const source = path.join(data, 'categories', 'U14G', 'seances');
const themesRoot = path.join(data, 'themes');

if (fs.existsSync(themesRoot)) {
  console.error('data/themes existe déjà.');
  process.exit(1);
}

function slug(name) {
  const s = (name || 'sans-titre')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'sans-titre';
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

const sessions = fs.readdirSync(source)
  .filter(name => fs.statSync(path.join(source, name)).isDirectory())
  .map(name => {
    const dir = path.join(source, name);
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    const match = / — (\d+)\/5 — (.+)$/.exec(index.name || '');
    if (!match) throw new Error(`Nom de séance illisible : ${index.name}`);
    return { dir, index, order: Number(match[1]), short: match[2], sheet: index.sheet, date: index.date };
  })
  .sort((a, b) => a.sheet.localeCompare(b.sheet, 'fr', { numeric: true }));

const groups = new Map();
for (const session of sessions) {
  const principle = session.index.principle;
  if (!groups.has(principle)) groups.set(principle, []);
  groups.get(principle).push(session);
}

const themeRefs = [];
const slots = [];

for (const [principle, list] of groups) {
  const themeId = randomUUID();
  const themeDir = path.join(themesRoot, slug(principle));
  writeJson(path.join(themeDir, 'index.json'), {
    type: 'fccn-theme:0',
    id: themeId,
    name: principle
  });
  themeRefs.push({ type: 'fccn-theme:0', id: themeId });
  const used = new Set();
  for (const session of list.sort((a, b) => a.order - b.order)) {
    let sessionSlug = slug(session.short);
    let n = 2;
    while (used.has(sessionSlug)) sessionSlug = `${slug(session.short)}-${n++}`;
    used.add(sessionSlug);
    const sessionId = randomUUID();
    const sessionDir = path.join(themeDir, 'sessions', sessionSlug);
    fs.cpSync(session.dir, sessionDir, { recursive: true });
    writeJson(path.join(sessionDir, 'index.json'), {
      type: 'fccn-session:0',
      id: sessionId,
      name: session.short,
      order: session.order,
      audience: 'u13-u15',
      phase: session.index.phase || '',
      principle: session.index.principle || '',
      means: session.index.means || ''
    });
    for (const entry of fs.readdirSync(sessionDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const exerciseIndex = path.join(sessionDir, entry.name, 'index.json');
      const exercise = JSON.parse(fs.readFileSync(exerciseIndex, 'utf8'));
      if (exercise.type !== 'fccn-exercise:0') continue;
      exercise.id = randomUUID();
      writeJson(exerciseIndex, exercise);
    }
    slots.push({ sheet: session.sheet, date: session.date, session: sessionId });
  }
}

const categoryId = randomUUID();
writeJson(path.join(data, 'categories', 'U14G', 'index.json'), {
  type: 'fccn-category:0',
  id: categoryId,
  name: 'U14 Garçons',
  audience: 'u14',
  refs: themeRefs
});

const seasonDir = path.join(data, 'seasons', '2026-2027', 'U14G');
writeJson(path.join(seasonDir, 'index.json'), {
  type: 'fccn-season:0',
  id: randomUUID(),
  name: '2026-2027',
  zone: 'B',
  from: '2026-09-01',
  to: '2027-06-29',
  category: categoryId,
  holidays: [
    { name: 'Toussaint', from: '2026-10-17', to: '2026-11-01' },
    { name: 'Noël', from: '2026-12-19', to: '2027-01-03' },
    { name: 'Hiver', from: '2027-02-20', to: '2027-03-07' },
    { name: 'Printemps', from: '2027-04-17', to: '2027-05-02' },
    { name: 'Ascension', from: '2027-05-06', to: '2027-05-06' }
  ],
  competencies: [],
  slots
});
fs.mkdirSync(path.join(seasonDir, 'players'), { recursive: true });
fs.rmSync(source, { recursive: true, force: true });

console.log(`themes ${themeRefs.length}, slots ${slots.length}`);
