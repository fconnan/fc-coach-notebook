import { json } from '@sveltejs/kit';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { frenchDateOrder } from '$lib/workspace/calendar';
import { applyExerciseDocument, exerciseFolder, isUuidFolder, orderByIds, splitExerciseRecord } from '$lib/workspace/exerciseFile';
import { fillTemplate, type TemplateName } from '$lib/workspace/templates';
import { REPERTOIRE_TYPE, themeKey } from '$lib/workspace/catalog';

const root = path.resolve('data');
const file = path.join(root, 'index.json');
const categoriesRoot = path.join(root, 'repertoire', 'categories');
const repertoireRoot = path.join(root, 'repertoire');
const seasonRoot = path.join(root, 'season');
const libraryRoot = path.join(root, 'studio', 'library');
const stylesRoot = path.join(root, 'studio', 'styles');

async function readIndex(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return { type: 'fccn-workspace:0', name: '' };
  }
}

const FORBIDDEN_DIR = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED_DIR = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

function directoryIssue(raw: string, kind: 'répertoire' | 'fichier'): string | null {
  const name = raw.trim();
  if (!name) return kind === 'fichier' ? 'Indique un nom de fichier.' : 'Indique un nom de répertoire.';
  if (name === '.' || name === '..' || FORBIDDEN_DIR.test(name) || /[. ]$/.test(name) || RESERVED_DIR.test(name)) {
    return `Ce nom ne peut pas être un ${kind}. Évite \\ / : * ? " < > | et les espaces ou points en fin de nom.`;
  }
  return null;
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readCategories(): Promise<Array<{ id: string; name: string; audience: string; uuid: string }>> {
  try {
    const entries = await readdir(categoriesRoot, { withFileTypes: true });
    const categories = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const info = JSON.parse(await readFile(path.join(categoriesRoot, entry.name, 'index.json'), 'utf8')) as { type?: string; name?: string; audience?: string; id?: string };
        if (info.type && info.type !== 'fccn-category:0') continue;
        const name = info.name?.trim() ? info.name : entry.name;
        categories.push({ id: entry.name, name, audience: info.audience || '', uuid: info.id || '' });
      } catch { /* sans index.json, ce n'est pas une catégorie */ }
    }
    categories.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return categories;
  } catch {
    return [];
  }
}

async function readStyles(): Promise<Array<Record<string, unknown>>> {
  try {
    const entries = await readdir(stylesRoot, { withFileTypes: true });
    const styles = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try {
        const style = JSON.parse(await readFile(path.join(stylesRoot, entry.name), 'utf8')) as { id?: string; name?: string };
        if (!style.id) continue;
        styles.push(style);
      } catch { /* fichier illisible */ }
    }
    styles.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'fr'));
    return styles;
  } catch {
    return [];
  }
}

type CatalogEntry = {
  dir: string;
  absDir: string;
  data: Record<string, unknown>;
};

type Slot = { sheet?: string; date?: string; session?: string; exercises?: string[] };

let catalogCache: Promise<CatalogEntry[]> | null = null;

function invalidateCatalog() {
  catalogCache = null;
}

function isExerciseDir(rel: string): boolean {
  const parts = rel.split('/');
  return parts.length === 5 && parts[0] === 'repertoire' && parts[2] === 'sessions';
}

async function loadCatalog(): Promise<CatalogEntry[]> {
  const out: CatalogEntry[] = [];
  async function walk(abs: string, rel: string) {
    let entries;
    try { entries = await readdir(abs, { withFileTypes: true }); }
    catch { return; }
    await Promise.all(entries.map(async entry => {
      const nextAbs = path.join(abs, entry.name);
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!isExerciseDir(nextRel)) await walk(nextAbs, nextRel);
        return;
      }
      if (entry.name !== 'index.json') return;
      try {
        out.push({ dir: rel, absDir: abs, data: JSON.parse(await readFile(nextAbs, 'utf8')) as Record<string, unknown> });
      } catch { /* index illisible */ }
    }));
  }
  await walk(root, '');
  return out;
}

function catalog(): Promise<CatalogEntry[]> {
  if (!catalogCache) catalogCache = loadCatalog();
  return catalogCache;
}

function themeSession(entries: CatalogEntry[], id: string): CatalogEntry | undefined {
  return entries.find(entry => {
    if (entry.data.type !== 'fccn-session:0' || entry.data.id !== id) return false;
    const parts = entry.dir.split('/');
    return parts.length === 4 && parts[0] === 'repertoire' && parts[2] === 'sessions';
  });
}

function seasonsFor(entries: CatalogEntry[], categoryId: string): CatalogEntry[] {
  const category = entries.find(entry => entry.dir === `repertoire/categories/${categoryId}` && entry.data.type === 'fccn-category:0');
  const categoryIdValue = typeof category?.data.id === 'string' ? category.data.id : '';
  return entries.filter(entry => {
    if (entry.data.type !== 'fccn-season:0') return false;
    const parts = entry.dir.split('/');
    return (parts[0] === 'season' && parts[2] === categoryId) || (categoryIdValue !== '' && entry.data.category === categoryIdValue);
  });
}

function slotsOf(seasons: CatalogEntry[]): Slot[] {
  return seasons.flatMap(season => Array.isArray(season.data.slots) ? season.data.slots as Slot[] : []);
}

async function readLegacySeances(id: string): Promise<Array<{ file: string; name: string; sheet: string }>> {
  if (directoryIssue(id, 'répertoire')) return [];
  try {
    const dir = path.join(categoriesRoot, id, 'seances');
    const entries = await readdir(dir, { withFileTypes: true });
    const seances = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const data = JSON.parse(await readFile(path.join(dir, entry.name, 'index.json'), 'utf8')) as { type?: string; name?: string; sheet?: string };
        if (data.type !== 'fccn-session:0') continue;
        seances.push({ file: entry.name, name: data.name?.trim() || entry.name, sheet: data.sheet || 'S1' });
      } catch { /* sans index.json typé, ce n'est pas une séance */ }
    }
    seances.sort((a, b) => a.sheet.localeCompare(b.sheet, 'fr', { numeric: true }) || a.name.localeCompare(b.name, 'fr'));
    return seances;
  } catch {
    return [];
  }
}

async function readSeances(id: string): Promise<Array<{ file: string; name: string; sheet: string }>> {
  if (directoryIssue(id, 'répertoire')) return [];
  const entries = await catalog();
  const slots = slotsOf(seasonsFor(entries, id));
  if (!slots.length) return readLegacySeances(id);
  const seances = slots.map(slot => {
    const sessionId = String(slot.session || '');
    const session = entries.find(entry => entry.data.type === 'fccn-session:0' && entry.data.id === sessionId);
    const name = typeof session?.data.name === 'string' ? session.data.name.trim() : '';
    return { file: sessionId, name: name || sessionId, sheet: String(slot.sheet || 'S1'), date: String(slot.date || '') };
  });
  seances.sort((a, b) => frenchDateOrder(a.date) - frenchDateOrder(b.date) || a.sheet.localeCompare(b.sheet, 'fr', { numeric: true }));
  return seances;
}

async function readExercisePage(dir: string): Promise<Record<string, unknown> | null> {
  try {
    const page = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8')) as Record<string, unknown>;
    if (page.type !== 'fccn-exercise:0') return null;
    let source: string | null = null;
    try { source = await readFile(path.join(dir, 'content.md'), 'utf8'); } catch { /* fiche encore dans index.json */ }
    return applyExerciseDocument(page, source);
  } catch {
    return null;
  }
}

async function readExerciseList(absDir: string, relDir: string) {
  const found: Array<{ folder: string; page: Record<string, unknown> }> = [];
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const page = await readExercisePage(path.join(absDir, entry.name));
    if (page) found.push({ folder: entry.name, page });
  }
  found.sort((a, b) => a.folder.localeCompare(b.folder, 'fr', { numeric: true }));
  const paths: Record<string, string> = {};
  const seen = new Set<string>();
  const exercises = found.flatMap(({ folder, page }) => {
    const id = typeof page.id === 'string' && page.id ? page.id : folder;
    if (seen.has(id)) return [];
    seen.add(id);
    paths[id] = `${relDir}/${folder}`;
    return [{ ...page, id }];
  });
  return { exercises, paths };
}

async function readTheme(entries: CatalogEntry[], sessionDir: string) {
  const themeDir = sessionDir.split('/').slice(0, 2).join('/');
  const theme = entries.find(entry => entry.dir === themeDir && entry.data.type === 'fccn-theme:0');
  let markdown = '';
  if (theme) {
    try { markdown = await readFile(path.join(theme.absDir, 'content.md'), 'utf8'); } catch { /* pas encore de descriptif */ }
  }
  return { name: text(theme?.data.name), markdown };
}

async function readSeance(categoryId: string, seanceId: string) {
  if (directoryIssue(categoryId, 'répertoire') || directoryIssue(seanceId, 'répertoire')) return null;
  const entries = await catalog();
  const session = themeSession(entries, seanceId);
  if (!session) return null;
  const { exercises, paths } = await readExerciseList(session.absDir, session.dir);
  let markdown = '';
  try { markdown = await readFile(path.join(session.absDir, 'content.md'), 'utf8'); } catch { /* pas encore de descriptif */ }
  return {
    seance: {
      ...session.data,
      id: String(session.data.id || seanceId),
      name: String(session.data.name || seanceId),
      sheet: String(session.data.sheet || ''),
      date: String(session.data.date || ''),
      phase: String(session.data.phase || ''),
      principle: String(session.data.principle || ''),
      means: String(session.data.means || ''),
      markdown,
      exercises: orderByIds(exercises, session.data.exercises)
    },
    paths,
    theme: await readTheme(entries, session.dir)
  };
}

async function readSettings(name: TemplateName): Promise<string> {
  try { return await readFile(path.join(root, 'settings', `${name}.md`), 'utf8'); }
  catch { return ''; }
}

async function exerciseIdOf(dir: string): Promise<string> {
  try {
    const page = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8')) as { id?: string };
    return String(page.id || '');
  } catch {
    return '';
  }
}

function rememberFolder(folders: Map<string, string>, id: string, name: string) {
  const current = folders.get(id);
  if (!current || (isUuidFolder(current) && !isUuidFolder(name))) folders.set(id, name);
}

async function keepSchema(fromDir: string, toDir: string) {
  if (!(await exists(path.join(fromDir, 'schema.yaml'))) || await exists(path.join(toDir, 'schema.yaml'))) return;
  await mkdir(toDir, { recursive: true });
  for (const name of ['schema.yaml', 'schema.svg']) {
    if (await exists(path.join(fromDir, name))) await copyFile(path.join(fromDir, name), path.join(toDir, name));
  }
}

async function writeExercises(absDir: string, relDir: string, exercises: Array<Record<string, unknown>>) {
  const folders = new Map<string, string>();
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const page = JSON.parse(await readFile(path.join(absDir, entry.name, 'index.json'), 'utf8')) as { type?: string; id?: string };
      if (page.type === 'fccn-exercise:0') rememberFolder(folders, page.id || entry.name, entry.name);
    } catch { /* dossier déjà absent */ }
  }
  const keep = new Set<string>();
  const paths: Record<string, string> = {};
  const used = new Set(folders.values());
  for (const page of exercises) {
    const exerciseId = String(page.id || '').trim();
    let folder = folders.get(exerciseId);
    if (!folder) {
      if (directoryIssue(exerciseId, 'répertoire')) continue;
      folder = exerciseId;
    }
    const name = String(page.name || '').trim();
    if (isUuidFolder(folder) && name) {
      const desired = exerciseFolder(name);
      const from = path.join(absDir, folder);
      const to = path.join(absDir, desired);
      const owner = await exists(to) ? await exerciseIdOf(to) : '';
      if (desired !== folder && await exists(to) && (!owner || owner === exerciseId)) {
        folder = desired;
        folders.set(exerciseId, desired);
      } else if (desired !== folder && !used.has(desired) && await exists(from) && !(await exists(to))) {
        await rename(from, to);
        used.delete(folder);
        used.add(desired);
        folders.set(exerciseId, desired);
        folder = desired;
      }
    }
    keep.add(folder);
    paths[exerciseId] = `${relDir}/${folder}`;
    const exerciseDir = path.join(absDir, folder);
    await mkdir(exerciseDir, { recursive: true });
    const stored = splitExerciseRecord({ ...page, type: 'fccn-exercise:0', id: exerciseId });
    await writeFile(path.join(exerciseDir, 'index.json'), JSON.stringify(stored.index, null, 2) + '\n');
    await writeFile(path.join(exerciseDir, 'content.md'), stored.document);
  }
  const after = await readdir(absDir, { withFileTypes: true });
  for (const entry of after) {
    if (!entry.isDirectory() || keep.has(entry.name)) continue;
    try {
      const page = JSON.parse(await readFile(path.join(absDir, entry.name, 'index.json'), 'utf8')) as { type?: string; id?: string };
      if (page.type !== 'fccn-exercise:0') continue;
      const survivor = folders.get(page.id || '');
      if (survivor && survivor !== entry.name) await keepSchema(path.join(absDir, entry.name), path.join(absDir, survivor));
      const schemaFile = path.join(absDir, entry.name, 'schema.yaml');
      const keptSchema = survivor ? path.join(absDir, survivor, 'schema.yaml') : '';
      if (await exists(schemaFile) && !(keptSchema && await exists(keptSchema))) continue;
      await rm(path.join(absDir, entry.name), { recursive: true, force: true });
    } catch { /* dossier déjà absent */ }
  }
  return paths;
}

const LIBRARY_KINDS = new Set(['objects', 'pitches', 'shapes']);

async function readLibrary() {
  const out: Array<{ domain: string; kind: string; name: string; file: string }> = [];
  let domains;
  try { domains = await readdir(libraryRoot, { withFileTypes: true }); }
  catch { return out; }
  for (const domain of domains) {
    if (!domain.isDirectory()) continue;
    let kinds;
    try { kinds = await readdir(path.join(libraryRoot, domain.name), { withFileTypes: true }); }
    catch { continue; }
    for (const kind of kinds) {
      if (!kind.isDirectory() || !LIBRARY_KINDS.has(kind.name)) continue;
      let files;
      try { files = await readdir(path.join(libraryRoot, domain.name, kind.name), { withFileTypes: true }); }
      catch { continue; }
      for (const file of files) {
        if (!file.isFile() || !/\.(svg|ya?ml)$/i.test(file.name)) continue;
        out.push({
          domain: domain.name,
          kind: kind.name,
          name: file.name.replace(/\.(svg|ya?ml)$/i, ''),
          file: `studio/library/${domain.name}/${kind.name}/${file.name}`
        });
      }
    }
  }
  out.sort((a, b) => a.domain.localeCompare(b.domain, 'fr') || a.kind.localeCompare(b.kind, 'fr') || a.name.localeCompare(b.name, 'fr'));
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function readBrowse() {
  const entries = await catalog();
  const categories = await readCategories();
  const seasons = entries.filter(entry => entry.data.type === 'fccn-season:0' && entry.dir.split('/').length === 3 && entry.dir.startsWith('season/')).map(entry => {
    const [, , folder] = entry.dir.split('/');
    const category = categories.find(item => item.id === folder) || categories.find(item => item.uuid && item.uuid === entry.data.category);
    const slots = (Array.isArray(entry.data.slots) ? entry.data.slots as Slot[] : []).map(slot => {
      const sessionId = String(slot.session || '');
      const session = entries.find(item => item.data.type === 'fccn-session:0' && item.data.id === sessionId);
      return {
        sheet: String(slot.sheet || ''),
        date: String(slot.date || ''),
        session: sessionId,
        sessionName: text(session?.data.name) || sessionId,
        exercises: Array.isArray(slot.exercises) ? idList(slot.exercises) : undefined
      };
    });
    return {
      id: entry.dir,
      uuid: text(entry.data.id),
      name: text(entry.data.name) || entry.dir.split('/')[1],
      zone: text(entry.data.zone),
      from: text(entry.data.from),
      to: text(entry.data.to),
      categoryFolder: folder,
      categoryName: text(entry.data.categoryName) || category?.name || folder,
      slots
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.categoryName.localeCompare(b.categoryName, 'fr'));
  return { seasons, themes: themesOf(entries), library: await readLibrary() };
}

function legacyOrder(entry: CatalogEntry): number {
  return typeof entry.data.order === 'number' ? entry.data.order : 0;
}

function themesOf(entries: CatalogEntry[]) {
  const repertoire = entries.find(entry => entry.dir === 'repertoire' && entry.data.type === REPERTOIRE_TYPE);
  const themes = entries.filter(entry => entry.data.type === 'fccn-theme:0' && entry.dir.split('/').length === 2 && entry.dir.startsWith('repertoire/')).map(entry => {
    const id = entry.dir.split('/')[1];
    const sessions = entries
      .filter(item => item.data.type === 'fccn-session:0' && item.dir.startsWith(`repertoire/${id}/sessions/`) && item.dir.split('/').length === 4)
      .sort((a, b) => legacyOrder(a) - legacyOrder(b) || text(a.data.name).localeCompare(text(b.data.name), 'fr'))
      .map(item => ({
        id: text(item.data.id) || item.dir.split('/').pop() || '',
        folder: item.dir.split('/').pop() || '',
        name: text(item.data.name),
        audience: text(item.data.audience),
        phase: text(item.data.phase)
      }));
    return { id, name: text(entry.data.name) || id, uuid: text(entry.data.id), sessions: orderByIds(sessions, entry.data.sessions) };
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return orderByIds(themes, repertoire?.data.themes, themeKey);
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id !== '') : [];
}

async function writeThemeOrder(themes: string[]) {
  const file = path.join(repertoireRoot, 'index.json');
  let current: Record<string, unknown> = {};
  try { current = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>; } catch { /* premier ordre enregistré */ }
  await mkdir(repertoireRoot, { recursive: true });
  await writeFile(file, JSON.stringify({ type: REPERTOIRE_TYPE, ...current, themes }, null, 2) + '\n');
}

async function writeSessionOrder(themeDir: string, sessions: string[]) {
  const file = path.join(themeDir, 'index.json');
  const current = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  await writeFile(file, JSON.stringify({ ...current, sessions }, null, 2) + '\n');
}

async function listDirNames(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  } catch {
    return [];
  }
}

async function readJsonAt(filePath: string): Promise<Record<string, unknown> | null> {
  try { return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>; }
  catch { return null; }
}

type SessionHit = {
  id: string;
  folder: string;
  name: string;
  audience: string;
  phase: string;
  abs: string;
  rel: string;
  themeFolder: string;
  data: Record<string, unknown>;
};

async function scanThemes(): Promise<{ themes: ReturnType<typeof themesOf>; sessions: SessionHit[] }> {
  const [repertoire, folders] = await Promise.all([
    readJsonAt(path.join(repertoireRoot, 'index.json')),
    listDirNames(repertoireRoot)
  ]);
  const entries: CatalogEntry[] = [];
  if (repertoire) entries.push({ dir: 'repertoire', absDir: repertoireRoot, data: repertoire });
  const sessions: SessionHit[] = [];
  await Promise.all(folders.map(async folder => {
    const abs = path.join(repertoireRoot, folder);
    const data = await readJsonAt(path.join(abs, 'index.json'));
    if (!data || data.type !== 'fccn-theme:0') return;
    entries.push({ dir: `repertoire/${folder}`, absDir: abs, data });
    const names = await listDirNames(path.join(abs, 'sessions'));
    await Promise.all(names.map(async name => {
      const sessionAbs = path.join(abs, 'sessions', name);
      const session = await readJsonAt(path.join(sessionAbs, 'index.json'));
      if (!session || session.type !== 'fccn-session:0') return;
      const rel = `repertoire/${folder}/sessions/${name}`;
      entries.push({ dir: rel, absDir: sessionAbs, data: session });
      sessions.push({
        id: text(session.id) || name,
        folder: name,
        name: text(session.name),
        audience: text(session.audience),
        phase: text(session.phase),
        abs: sessionAbs,
        rel,
        themeFolder: folder,
        data: session
      });
    }));
  }));
  return { themes: themesOf(entries), sessions };
}

async function scanSeasons(sessions: SessionHit[]) {
  const years = await listDirNames(seasonRoot);
  const found: CatalogEntry[] = [];
  await Promise.all(years.map(async year => {
    const cats = await listDirNames(path.join(seasonRoot, year));
    await Promise.all(cats.map(async cat => {
      const abs = path.join(seasonRoot, year, cat);
      const data = await readJsonAt(path.join(abs, 'index.json'));
      if (data?.type === 'fccn-season:0') found.push({ dir: `season/${year}/${cat}`, absDir: abs, data });
    }));
  }));
  const byId = new Map(sessions.map(session => [session.id, session.name]));
  return found.map(entry => {
    const folder = entry.dir.split('/')[2];
    const slots = (Array.isArray(entry.data.slots) ? entry.data.slots as Slot[] : []).map(slot => {
      const sessionId = String(slot.session || '');
      return {
        sheet: String(slot.sheet || ''),
        date: String(slot.date || ''),
        session: sessionId,
        sessionName: byId.get(sessionId) || sessionId,
        exercises: Array.isArray(slot.exercises) ? idList(slot.exercises) : undefined
      };
    });
    return {
      id: entry.dir,
      uuid: text(entry.data.id),
      name: text(entry.data.name) || entry.dir.split('/')[1],
      zone: text(entry.data.zone),
      from: text(entry.data.from),
      to: text(entry.data.to),
      categoryFolder: folder,
      categoryName: text(entry.data.categoryName) || folder,
      slots
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.categoryName.localeCompare(b.categoryName, 'fr'));
}

async function readView(pathname: string) {
  const index = await readIndex();
  const trainer = { name: text(index.name), sport: text(index.sport), folder: path.basename(root) };
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length || (parts[0] !== 'season' && parts[0] !== 'repertoire')) return { trainer };
  const scanned = await scanThemes();
  if (parts[0] === 'repertoire') {
    const theme = scanned.themes.find(item => item.uuid === parts[1] || item.id === parts[1]);
    const session = parts[2] ? scanned.sessions.find(item => item.id === parts[2] && (!theme || item.themeFolder === theme.id)) : undefined;
    let opened = null;
    if (session) {
      const { exercises, paths } = await readExerciseList(session.abs, session.rel);
      let markdown = '';
      try { markdown = await readFile(path.join(session.abs, 'content.md'), 'utf8'); } catch { /* pas de descriptif */ }
      const themeEntry = scanned.themes.find(item => item.id === session.themeFolder);
      let themeMarkdown = '';
      if (themeEntry) {
        try { themeMarkdown = await readFile(path.join(repertoireRoot, themeEntry.id, 'content.md'), 'utf8'); } catch { /* pas de descriptif */ }
      }
      opened = {
        seance: {
          ...session.data,
          id: session.id,
          name: session.name || session.id,
          sheet: text(session.data.sheet),
          date: text(session.data.date),
          phase: text(session.data.phase),
          principle: text(session.data.principle),
          means: text(session.data.means),
          markdown,
          exercises: orderByIds(exercises, session.data.exercises)
        },
        paths,
        theme: { name: themeEntry?.name || '', markdown: themeMarkdown }
      };
    }
    const missing = parts[1] && !theme
      ? 'Ce thème n’existe plus.'
      : parts[2] && !session
        ? 'Cette séance n’existe plus.'
        : '';
    return { trainer, themes: scanned.themes, session: opened, missing };
  }
  const seasons = await scanSeasons(scanned.sessions);
  const season = parts[1] ? seasons.find(item => item.uuid === parts[1] || item.id === parts[1]) : undefined;
  const session = parts[2] ? scanned.sessions.find(item => item.id === parts[2]) : undefined;
  let opened = null;
  if (season && session) {
    const { exercises, paths } = await readExerciseList(session.abs, session.rel);
    let markdown = '';
    try { markdown = await readFile(path.join(session.abs, 'content.md'), 'utf8'); } catch { /* pas de descriptif */ }
    const themeEntry = scanned.themes.find(item => item.id === session.themeFolder);
    let themeMarkdown = '';
    if (themeEntry) {
      try { themeMarkdown = await readFile(path.join(repertoireRoot, themeEntry.id, 'content.md'), 'utf8'); } catch { /* pas de descriptif */ }
    }
    opened = {
      seance: {
        ...session.data,
        id: session.id,
        name: session.name || session.id,
        sheet: text(session.data.sheet),
        date: text(session.data.date),
        phase: text(session.data.phase),
        principle: text(session.data.principle),
        means: text(session.data.means),
        markdown,
        exercises: orderByIds(exercises, session.data.exercises)
      },
      paths,
      theme: { name: themeEntry?.name || '', markdown: themeMarkdown }
    };
  }
  const missing = parts[1] && !season
    ? 'Cette saison n’existe plus.'
    : parts[2] && season && !season.slots.some(slot => slot.session === parts[2])
      ? `Cette séance ne fait plus partie du planning de la saison « ${season.name} ».`
      : '';
  return {
    trainer,
    seasons,
    themes: session ? scanned.themes.filter(item => item.id === session.themeFolder) : [],
    session: opened,
    missing
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const template = url.searchParams.get('template');
  if (template === 'session' || template === 'exercise') return json({ markdown: await readSettings(template) });
  const view = url.searchParams.get('view');
  if (view != null) return json(await readView(view));
  const category = url.searchParams.get('category');
  const seance = url.searchParams.get('seance');
  if (category && seance) {
    const loaded = await readSeance(category, seance);
    return json({ seance: loaded?.seance ?? null, paths: loaded?.paths ?? {}, theme: loaded?.theme ?? { name: '', markdown: '' } });
  }
  if (category) return json({ seances: await readSeances(category) });
  const index = await readIndex();
  delete index.folder;
  const browse = await readBrowse();
  return json({
    ...index,
    folder: path.basename(root),
    categories: await readCategories(),
    styles: await readStyles(),
    ...browse
  });
};

export const POST: RequestHandler = async ({ request }) => {
  invalidateCatalog();
  const body = await request.json() as {
    type?: string;
    explicit?: boolean;
    id?: string;
    name?: string;
    category?: string;
    sheet?: string;
    date?: string;
    phase?: string;
    principle?: string;
    means?: string;
    update?: boolean;
    style?: Record<string, unknown>;
    exercises?: Array<Record<string, unknown>>;
    zone?: string;
    from?: string;
    to?: string;
    season?: string;
    session?: string;
    theme?: string;
    themes?: unknown;
    sessions?: unknown;
    domain?: string;
    kind?: string;
    markdown?: string;
  };
  if (body.type === 'save-slot-exercises') {
    if (body.explicit !== true) return json({ ok: false });
    const session = String(body.session || '').trim();
    const seasonKey = String(body.season || '').trim();
    if (!session || !seasonKey) return json({ error: 'Séance introuvable.' }, { status: 400 });
    const season = (await catalog()).find(entry => entry.data.type === 'fccn-season:0' && (entry.dir === seasonKey || entry.data.id === seasonKey));
    if (!season) return json({ error: 'Cette saison n’existe pas.' }, { status: 404 });
    const slots = Array.isArray(season.data.slots) ? season.data.slots as Slot[] : [];
    const exercises = idList(body.exercises);
    let found = false;
    for (const slot of slots) {
      if (String(slot.session || '') !== session) continue;
      slot.exercises = exercises;
      found = true;
    }
    if (!found) slots.push({ sheet: '', date: '', session, exercises });
    season.data.slots = slots;
    await writeFile(path.join(season.absDir, 'index.json'), JSON.stringify(season.data, null, 2) + '\n');
    return json({ ok: true });
  }
  if (body.type === 'save-session-markdown') {
    if (body.explicit !== true) return json({ ok: false });
    const id = String(body.id || '').trim();
    if (directoryIssue(id, 'répertoire')) return json({ error: 'Répertoire invalide.' }, { status: 400 });
    const session = themeSession(await catalog(), id);
    if (!session) return json({ error: 'Cette séance n’existe pas.' }, { status: 404 });
    const text = String(body.markdown || '').replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n';
    await writeFile(path.join(session.absDir, 'content.md'), text);
    return json({ ok: true });
  }
  if (body.type === 'category' || body.type === 'seance') {
    return json({ error: 'Les catégories ne font plus partie du répertoire.' }, { status: 410 });
  }
  if (body.type === 'save-seance') {
    if (body.explicit !== true) return json({ id: String(body.id || ''), paths: {} });
    const category = String(body.category || '').trim();
    const id = String(body.id || '').trim();
    if (directoryIssue(id, 'répertoire') || (category && directoryIssue(category, 'répertoire'))) {
      return json({ error: 'Répertoire invalide.' }, { status: 400 });
    }
    const entries = await catalog();
    const session = themeSession(entries, id);
    if (session) {
      await writeFile(path.join(session.absDir, 'index.json'), JSON.stringify({
        type: 'fccn-session:0',
        id: session.data.id,
        name: String(body.name || session.data.name || id),
        order: session.data.order,
        audience: session.data.audience,
        phase: String(body.phase || ''),
        principle: String(body.principle || ''),
        means: String(body.means || ''),
        exercises: (body.exercises || []).map(page => String(page.id || '')).filter(Boolean)
      }, null, 2) + '\n');
      const paths = await writeExercises(session.absDir, session.dir, body.exercises || []);
      return json({ id, paths });
    }
    return json({ error: 'Cette séance n’existe pas.' }, { status: 404 });
  }
  if (body.type === 'season') {
    const name = String(body.name || '').trim();
    const category = String(body.category || '').trim();
    const zone = String(body.zone || '').trim();
    const from = String(body.from || '').trim();
    const to = String(body.to || '').trim();
    const issue = directoryIssue(name, 'répertoire');
    const categoryIssue = directoryIssue(category, 'répertoire');
    if (issue || categoryIssue) return json({ error: issue || categoryIssue }, { status: 400 });
    if (!zone || !from || !to) return json({ error: 'Indique la zone et les deux dates.' }, { status: 400 });
    const categories = await readCategories();
    const found = categories.find(item => item.id === category);
    if (!found) return json({ error: 'Cette catégorie n’existe pas.' }, { status: 400 });
    const dir = path.join(seasonRoot, name, category);
    if (await exists(dir)) return json({ error: 'Cette saison existe déjà.' }, { status: 409 });
    await mkdir(dir, { recursive: true });
    const id = crypto.randomUUID();
    await writeFile(path.join(dir, 'index.json'), JSON.stringify({
      type: 'fccn-season:0',
      id,
      name,
      zone,
      from,
      to,
      category: found.uuid,
      holidays: [],
      competencies: [],
      slots: []
    }, null, 2) + '\n');
    return json({ id: `season/${name}/${category}`, name });
  }
  if (body.type === 'slot') {
    const season = String(body.season || '').trim();
    const parts = season.split('/');
    if (parts.length !== 3 || parts[0] !== 'season' || parts.some(part => directoryIssue(part, 'répertoire'))) {
      return json({ error: 'Saison invalide.' }, { status: 400 });
    }
    const sheet = String(body.sheet || '').trim();
    const date = String(body.date || '').trim();
    const session = String(body.session || '').trim();
    if (!sheet || !date || !session) return json({ error: 'Indique la fiche, la date et la séance.' }, { status: 400 });
    const entries = await catalog();
    const found = entries.find(entry => entry.dir === season && entry.data.type === 'fccn-season:0');
    if (!found) return json({ error: 'Cette saison n’existe pas.' }, { status: 404 });
    if (!themeSession(entries, session)) {
      return json({ error: 'Cette séance n’existe pas.' }, { status: 400 });
    }
    const slots = Array.isArray(found.data.slots) ? found.data.slots as Slot[] : [];
    if (slots.some(slot => slot.sheet === sheet)) return json({ error: 'Cette fiche existe déjà.' }, { status: 409 });
    slots.push({ sheet, date, session });
    found.data.slots = slots;
    await writeFile(path.join(found.absDir, 'index.json'), JSON.stringify(found.data, null, 2) + '\n');
    return json({ id: season });
  }
  if (body.type === 'theme') {
    const id = String(body.id || '').trim();
    const issue = directoryIssue(id, 'répertoire');
    if (issue) return json({ error: issue }, { status: 400 });
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'Indique un nom.' }, { status: 400 });
    const dir = path.join(repertoireRoot, id);
    if (await exists(dir)) return json({ error: 'Ce répertoire existe déjà.' }, { status: 409 });
    const listed = themesOf(await catalog()).map(themeKey);
    await mkdir(path.join(dir, 'sessions'), { recursive: true });
    const themeId = crypto.randomUUID();
    await writeFile(path.join(dir, 'index.json'), JSON.stringify({ type: 'fccn-theme:0', id: themeId, name, sessions: [] }, null, 2) + '\n');
    await writeThemeOrder([...listed, themeId]);
    return json({ id, name });
  }
  if (body.type === 'order-themes') {
    await writeThemeOrder(idList(body.themes));
    return json({ ok: true });
  }
  if (body.type === 'order-sessions') {
    const theme = String(body.theme || '').trim();
    const issue = directoryIssue(theme, 'répertoire');
    if (issue) return json({ error: issue }, { status: 400 });
    const themeDir = path.join(repertoireRoot, theme);
    if (!(await exists(path.join(themeDir, 'index.json')))) return json({ error: 'Ce thème n’existe pas.' }, { status: 404 });
    await writeSessionOrder(themeDir, idList(body.sessions));
    return json({ ok: true });
  }
  if (body.type === 'order-exercises') {
    const session = themeSession(await catalog(), String(body.id || '').trim());
    if (!session) return json({ error: 'Cette séance n’existe pas.' }, { status: 404 });
    await writeFile(path.join(session.absDir, 'index.json'), JSON.stringify({ ...session.data, exercises: idList(body.exercises) }, null, 2) + '\n');
    return json({ ok: true });
  }
  if (body.type === 'session') {
    const theme = String(body.theme || '').trim();
    const id = String(body.id || '').trim();
    const themeIssue = directoryIssue(theme, 'répertoire');
    const issue = directoryIssue(id, 'répertoire');
    if (themeIssue || issue) return json({ error: themeIssue || issue }, { status: 400 });
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'Indique un nom.' }, { status: 400 });
    const themeDir = path.join(repertoireRoot, theme);
    if (!(await exists(path.join(themeDir, 'index.json')))) return json({ error: 'Ce thème n’existe pas.' }, { status: 404 });
    const dir = path.join(themeDir, 'sessions', id);
    if (await exists(dir)) return json({ error: 'Ce répertoire existe déjà.' }, { status: 409 });
    const listed = themesOf(await catalog()).find(item => item.id === theme)?.sessions.map(session => session.id) || [];
    await mkdir(dir, { recursive: true });
    const sessionId = crypto.randomUUID();
    await writeFile(path.join(dir, 'index.json'), JSON.stringify({
      type: 'fccn-session:0',
      id: sessionId,
      name,
      audience: '',
      phase: '',
      principle: '',
      means: '',
      exercises: []
    }, null, 2) + '\n');
    const markdown = fillTemplate(await readSettings('session'), { name });
    await writeFile(path.join(dir, 'content.md'), markdown.replace(/\n+$/, '') + '\n');
    await writeSessionOrder(themeDir, [...listed, sessionId]);
    return json({ id: sessionId, name });
  }
  if (body.type === 'library') {
    const domain = String(body.domain || '').trim();
    const kind = String(body.kind || '').trim();
    const name = String(body.name || '').trim();
    const domainIssue = directoryIssue(domain, 'répertoire');
    const nameIssue = directoryIssue(name, 'fichier');
    if (domainIssue || nameIssue) return json({ error: domainIssue || nameIssue }, { status: 400 });
    if (!LIBRARY_KINDS.has(kind)) return json({ error: 'Dossier de bibliothèque invalide.' }, { status: 400 });
    const ext = kind === 'shapes' ? 'yaml' : 'svg';
    const dir = path.join(libraryRoot, domain, kind);
    const file = path.join(dir, `${name}.${ext}`);
    if (await exists(file)) return json({ error: 'Ce fichier existe déjà.' }, { status: 409 });
    await mkdir(dir, { recursive: true });
    const source = kind === 'shapes'
      ? `type: fccn-schema:0\nname: ${name}\nunits: relative\nplayers: []\n`
      : kind === 'pitches'
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 72 56.5">\n</svg>\n`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 1 1">\n</svg>\n`;
    await writeFile(file, source, 'utf8');
    return json({ name, file: `studio/library/${domain}/${kind}/${name}.${ext}` });
  }
  if (body.type === 'style') {
    const style = body.style || {};
    const id = String(style.id || '').trim();
    const issue = directoryIssue(id, 'fichier');
    if (issue) return json({ error: issue }, { status: 400 });
    const name = String(style.name || '').trim();
    if (!name) return json({ error: 'Indique un nom.' }, { status: 400 });
    const file = path.join(stylesRoot, `${id}.json`);
    if (!body.update && await exists(file)) return json({ error: 'Ce fichier existe déjà.' }, { status: 409 });
    await mkdir(stylesRoot, { recursive: true });
    await writeFile(file, JSON.stringify({ ...style, id, name }, null, 2) + '\n');
    return json({ id, name });
  }
  return json({ error: 'Requête inconnue.' }, { status: 400 });
};

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json() as { name?: string; sport?: string };
  const current = await readIndex();
  const { folder: _folder, ...rest } = current;
  void _folder;
  const next = {
    ...rest,
    type: 'fccn-workspace:0',
    name: String(body.name ?? current.name ?? ''),
    sport: String(body.sport || current.sport || 'soccer')
  };
  await mkdir(root, { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2) + '\n');
  return json({ ...next, folder: path.basename(root), categories: await readCategories() });
};
