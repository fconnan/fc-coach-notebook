import { createServer } from 'vite';
import { parse } from 'yaml';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('data');
const libRoot = path.join(root, 'elements');

async function walk(dir, out = []) {
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(next, out);
    else out.push(next);
  }
  return out;
}

function readSvg(source) {
  const opened = /<svg\b([^>]*)>/i.exec(source);
  const markup = source
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
  const box = opened && /viewBox\s*=\s*"([^"]+)"/i.exec(opened[1]);
  return { markup, viewBox: box ? box[1] : '' };
}

async function assetsOf(file, variants) {
  const dir = path.dirname(file);
  const assets = [];
  for (const variant of variants || []) {
    if (!variant?.path) continue;
    const parsed = readSvg(await readFile(path.resolve(dir, variant.path), 'utf8'));
    assets.push({ style: variant.style || '', markup: parsed.markup, viewBox: parsed.viewBox });
  }
  return assets;
}

function near(value, expected, label) {
  if (Math.abs(value - expected) > 0.05) throw new Error(`${label}: ${value} au lieu de ${expected}`);
}

async function main() {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error'
  });
  const scene = await vite.ssrLoadModule(path.resolve('src/lib/schema/scene.ts'));
  const { buildScene, dottedId, elementKey, elementKind, elementScene, libraryFor } = scene;
  const files = await walk(libRoot);
  const seen = new Map();
  const groups = new Map();
  for (const file of files) {
    const id = dottedId(path.basename(file));
    if (!id) continue;
    const group = groups.get(id) || {};
    if (/\.svg$/i.test(file)) group.svg = file;
    else if (/\.ya?ml$/i.test(file)) group.yaml = file;
    else continue;
    groups.set(id, group);
  }
  const entries = [];
  for (const [id, group] of groups) {
    if (seen.has(id)) throw new Error(`Identifiant en double : ${id}`);
    seen.set(id, group.yaml || group.svg);
    const kind = elementKind(id);
    let doc = { version: 'fccn-schema:0', type: kind, id };
    let held = group.svg;
    if (group.yaml) {
      doc = { ...parse(await readFile(group.yaml, 'utf8')), type: kind, id };
      held = group.yaml;
    }
    const rel = path.relative(root, held).replaceAll('\\', '/');
    const dir = path.posix.dirname(rel);
    const svgs = [];
    if (group.svg) {
      const parsed = readSvg(await readFile(group.svg, 'utf8'));
      if (parsed.markup) svgs.push({ style: '', markup: parsed.markup, viewBox: parsed.viewBox });
    }
    entries.push({
      id,
      name: id.slice(kind.length + 1),
      type: kind,
      file: rel,
      dir: dir === '.' ? '' : dir,
      doc,
      svgs
    });
  }
  const library = libraryFor('', entries);

  for (const entry of entries) {
    if (!elementScene(entry.doc, library).includes('<svg')) throw new Error(`aperçu vide : ${entry.id}`);
  }

  const cone = library.get(elementKey('object.cone'))?.svgs[0]?.markup;
  const stretched = (w, h) => buildScene({
    version: 'fccn-schema:1',
    name: 'etire',
    pitch: { name: 'rect', width: 40, length: 30, margin: 1 },
    zone: [{ rect: { name: 'a', x: 4, y: 3, w, h, margin: 1, padding: 0.5, shape: [{ 'plot-rect': {} }] } }]
  }, library, 0, 0);
  const small = stretched(16, 10);
  const large = stretched(28, 18);
  if (small.marks.length !== 4 || large.marks.length !== 4) throw new Error('plot-rect doit poser quatre plots');
  if (small.marks.some(mark => mark.svg !== cone) || large.marks.some(mark => mark.svg !== cone)) {
    throw new Error('le plot est agrandi ou remplacé');
  }
  const span = scene => Math.max(...scene.marks.map(mark => mark.x)) - Math.min(...scene.marks.map(mark => mark.x));
  if (span(large) <= span(small)) throw new Error('étirer le rectangle doit écarter les plots');
  near(small.zones[0].x, 5, 'bord x');
  near(small.zones[0].y, 4, 'bord y');
  near(small.zones[0].w, 14, 'bord w');
  near(small.zones[0].h, 8, 'bord h');
  const xs = small.marks.map(mark => mark.x).sort((a, b) => a - b);
  const ys = small.marks.map(mark => mark.y).sort((a, b) => a - b);
  near(xs[0], 5.5, 'plot gauche');
  near(xs[3], 18.5, 'plot droit');
  near(ys[0], 4.5, 'plot bas');
  near(ys[3], 11.5, 'plot haut');
  if (small.lines.length !== 4) throw new Error(`contour: ${small.lines.length} traits`);

  const relative = buildScene({
    version: 'fccn-schema:1',
    name: 'relatif',
    pitch: { name: 'rect', width: 40, length: 30, margin: 1 },
    zone: [{
      rect: {
        name: 'coin',
        x: 0.1,
        y: 0.2,
        w: 0.5,
        h: 0.4,
        unit: 'relative',
        margin: 0.02,
        padding: { y: 0.04, x: 0.03 },
        shape: [{ 'plot-rect': {} }]
      }
    }]
  }, library, 0, 0);
  near(relative.zones[0].x, 4.8, 'relatif x');
  near(relative.zones[0].y, 6.6, 'relatif y');
  near(relative.zones[0].w, 18.4, 'relatif w');
  near(relative.zones[0].h, 10.8, 'relatif h');

  const again = await walk(libRoot);
  const plain = again.filter(file => {
    if (!/\.(svg|ya?ml)$/i.test(file)) return false;
    const base = path.basename(file).replace(/\.(svg|ya?ml)$/i, '');
    return !base.includes('.');
  });
  if (plain.length) throw new Error(`nom sans point : ${plain[0]}`);

  const problems = [];
  const exercises = (await walk(path.join(root, 'themes'))).filter(file => file.endsWith(`${path.sep}schema.yaml`));
  for (const schemaPath of exercises) {
    const dir = path.dirname(schemaPath);
    const rel = path.relative(root, dir);
    const source = await readFile(schemaPath, 'utf8');
    let text = '';
    try { text = await readFile(path.join(dir, 'content.md'), 'utf8'); } catch { text = ''; }
    let doc;
    try { doc = parse(source); }
    catch (error) { problems.push(`${rel} : ${error.message}`); continue; }
    const action = /passe|course|conduite|centre|tir|déplac|appel|dribbl|finition|pressing/i.test(text);
    if (action && !(doc.phases || []).length) problems.push(`${rel} : phase absente`);
    const relPosix = rel.replaceAll('\\', '/');
    const names = libraryFor(relPosix, entries, `${relPosix}/schema.yaml`);
    try {
      const start = buildScene(doc, names, 0, 0);
      const phases = Math.max(1, start.phases.length);
      for (let index = 0; index < phases; index += 1) {
        const built = buildScene(doc, names, index, index === 0 ? 0 : 1);
        for (const player of built.players) {
          if (player.x < -0.4 || player.y < -0.4 || player.x > built.width + 0.4 || player.y > built.length + 0.4) {
            problems.push(`${rel} : joueur ${player.id} hors aire (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
          }
        }
        if (index === 0) {
          for (const mark of built.marks) {
            if (mark.x < -1 || mark.y < -1 || mark.x > built.width + 1 || mark.y > built.length + 1) {
              problems.push(`${rel} : objet hors aire (${mark.x.toFixed(1)}, ${mark.y.toFixed(1)})`);
            }
          }
        }
      }
    } catch (error) {
      problems.push(`${rel} : ${error.message}`);
    }
  }
  await vite.close();
  const pitches = entries.filter(entry => entry.type === 'pitch').length;
  const shapes = entries.filter(entry => entry.type === 'shape').length;
  console.log(`formes ${shapes}, terrains ${pitches}, éléments ${entries.length}, exercices ${exercises.length}`);
  if (problems.length) {
    console.log(problems.slice(0, 40).join('\n'));
    console.log(`échecs ${problems.length}`);
    process.exit(1);
  }
  console.log('ok');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
