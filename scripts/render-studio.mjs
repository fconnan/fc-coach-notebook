import { createServer } from 'vite';
import { parse } from 'yaml';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('data');
const libRoot = path.join(root, 'studio', 'library', 'soccer');

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

function stem(file) {
  return file.replace(/\.(ya?ml|svg)$/i, '').toLowerCase();
}

function svgDoc(file, source) {
  const name = path.basename(file, path.extname(file));
  const opened = /<svg\b([^>]*)>/i.exec(source);
  const svg = source
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
  const doc = { name, svg };
  const box = opened && /viewBox\s*=\s*"([^"]+)"/i.exec(opened[1]);
  if (box) doc.viewBox = box[1];
  if (file.replaceAll('\\', '/').includes('/pitches/') && box) {
    const [x, y, w, h] = box[1].trim().split(/[\s,]+/).map(Number);
    const margin = Math.max(x < 0 ? -x : 0, y < 0 ? -y : 0);
    if ([x, y, w, h].every(Number.isFinite)) doc.pitch = { width: w - margin * 2, length: h - margin * 2, margin };
  }
  return doc;
}

function border(width, length) {
  return [
    { x1: 0, y1: 0, x2: width, y2: 0 },
    { x1: width, y1: 0, x2: width, y2: length },
    { x1: width, y1: length, x2: 0, y2: length },
    { x1: 0, y1: length, x2: 0, y2: 0 }
  ];
}

function hasPlayers(doc, library, depth = 0) {
  if (!doc || depth > 5) return false;
  if (doc.players?.length) return true;
  return (doc.items || []).some(item => item.player !== undefined || (item.shape && hasPlayers(library.get(item.shape), library, depth + 1)));
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
  const { buildScene, renderSvg, libraryFor } = scene;
  const files = await walk(libRoot);
  const yamlStems = new Set(files.filter(file => /\.ya?ml$/i.test(file)).map(stem));
  const library = new Map();
  const seen = new Map();
  const entries = [];
  for (const file of files) {
    if (/\.svg$/i.test(file) && yamlStems.has(stem(file))) continue;
    const source = await readFile(file, 'utf8');
    const doc = /\.svg$/i.test(file) ? svgDoc(file, source) : parse(source);
    if (!doc?.name) continue;
    if (seen.has(doc.name)) throw new Error(`Nom en double : ${doc.name}`);
    seen.set(doc.name, file);
    library.set(doc.name, doc);
    const rel = path.relative(root, file).replaceAll('\\', '/');
    const dir = path.posix.dirname(rel);
    entries.push({ name: doc.name, file: rel, dir: dir === '.' ? '' : dir, doc });
  }

  const shapeFiles = files.filter(file => file.includes(`${path.sep}shapes${path.sep}`) && /\.ya?ml$/i.test(file));
  const pitchFiles = files.filter(file => file.includes(`${path.sep}pitches${path.sep}`) && /\.ya?ml$/i.test(file));
  for (const file of [...shapeFiles, ...pitchFiles]) {
    const doc = parse(await readFile(file, 'utf8'));
    let host = doc;
    if (file.includes(`${path.sep}shapes${path.sep}`)) {
      const wide = hasPlayers(doc, library);
      const width = wide ? 68 : 24;
      const length = wide ? 52 : 18;
      host = {
        type: 'fccn-schema:0',
        name: 'apercu',
        pitch: { width, length, margin: 1.5 },
        lines: border(width, length),
        zones: [{
          name: 'cadre',
          rect: { x: 1.5, y: 1.5, w: width - 3, h: length - 3, padding: wide ? 2 : 0.8 },
          items: [{ shape: doc.name, team: 'blue' }]
        }]
      };
    }
    const svg = renderSvg(buildScene(host, library, 0, 0));
    await writeFile(file.replace(/\.ya?ml$/i, '.svg'), svg);
  }

  const cone = library.get('cone')?.svg;
  const stretched = (w, h) => buildScene({
    type: 'fccn-schema:0',
    name: 'etire',
    pitch: { width: 40, length: 30, margin: 1 },
    zones: [{ name: 'a', rect: { x: 4, y: 3, w, h, margin: 1, padding: 0.5 }, items: [{ shape: 'plot-rect' }] }]
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
    type: 'fccn-schema:0',
    name: 'relatif',
    pitch: { width: 40, length: 30, margin: 1 },
    zones: [{
      name: 'coin',
      rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.4, unit: 'relative', margin: 0.02, padding: { y: 0.04, x: 0.03 } },
      items: [{ shape: 'plot-rect' }]
    }]
  }, library, 0, 0);
  near(relative.zones[0].x, 4.8, 'relatif x');
  near(relative.zones[0].y, 6.6, 'relatif y');
  near(relative.zones[0].w, 18.4, 'relatif w');
  near(relative.zones[0].h, 10.8, 'relatif h');

  const again = await walk(libRoot);
  const yamlNow = new Set(again.filter(file => /\.ya?ml$/i.test(file)).map(stem));
  const previewLeft = again.filter(file => /\.svg$/i.test(file) && yamlNow.has(stem(file)));
  for (const file of previewLeft) {
    const name = path.basename(file, path.extname(file));
    const owner = seen.get(name);
    if (owner && owner.toLowerCase().endsWith('.svg')) throw new Error(`aperçu indexé comme objet : ${name}`);
  }

  const problems = [];
  const exercises = (await walk(path.join(root, 'repertoire'))).filter(file => file.endsWith(`${path.sep}content.md`));
  for (const file of exercises) {
    const dir = path.dirname(file);
    const schemaPath = path.join(dir, 'schema.yaml');
    const rel = path.relative(root, dir);
    let source;
    try { source = await readFile(schemaPath, 'utf8'); }
    catch { problems.push(`${rel} : schema manquant`); continue; }
    const text = await readFile(file, 'utf8');
    let doc;
    try { doc = parse(source); }
    catch (error) { problems.push(`${rel} : ${error.message}`); continue; }
    const action = /passe|course|conduite|centre|tir|déplac|appel|dribbl|finition|pressing/i.test(text);
    if (action && !(doc.phases || []).length) problems.push(`${rel} : phase absente`);
    const relPosix = rel.replaceAll('\\', '/');
    const names = libraryFor(relPosix, entries, `${relPosix}/schema.yaml`);
    try {
      await writeFile(path.join(dir, 'schema.svg'), renderSvg(buildScene(doc, names, 0, 0)) + '\n', 'utf8');
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
  const shapeSvg = shapeFiles.filter(file => files.includes(file.replace(/\.ya?ml$/i, '.svg')) || true);
  for (const file of shapeFiles) {
    const svg = file.replace(/\.ya?ml$/i, '.svg');
    try { await readFile(svg); }
    catch { problems.push(`aperçu manquant ${path.relative(root, svg)}`); }
  }
  await vite.close();
  console.log(`formes ${shapeFiles.length}, terrains ${pitchFiles.length}, exercices ${exercises.length}, aperçus ignorés ${previewLeft.length}`);
  if (problems.length) {
    console.log(problems.slice(0, 40).join('\n'));
    console.log(`échecs ${problems.length}`);
    process.exit(1);
  }
  console.log('ok');
  void shapeSvg;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
