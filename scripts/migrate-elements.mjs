import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isMap, isScalar, isSeq, Pair, parseDocument, Scalar, YAMLMap, YAMLSeq } from 'yaml';

function pitchBox(viewBox) {
  const [x, y, w, h] = viewBox.trim().split(/[\s,]+/).map(Number);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  const margin = Math.max(x < 0 ? -x : 0, y < 0 ? -y : 0);
  return { width: w - margin * 2, length: h - margin * 2, margin };
}

function viewBoxOf(source) {
  const opened = /<svg\b([^>]*)>/i.exec(source);
  const box = opened && /viewBox\s*=\s*"([^"]+)"/i.exec(opened[1]);
  return box ? box[1] : '';
}

const root = path.resolve('data');
const elements = path.join(root, 'elements');

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

function keyOf(pair) {
  return isScalar(pair.key) ? String(pair.key.value) : '';
}

function keysOf(node) {
  return isMap(node) ? node.items.map(keyOf) : [];
}

function rest(node, drop) {
  const map = new YAMLMap();
  map.flow = true;
  for (const item of node.items) if (!drop.has(keyOf(item))) map.items.push(item);
  return map;
}

function single(type, value, flow) {
  const map = new YAMLMap();
  map.flow = flow;
  map.set(type, value);
  return map;
}

function convertItem(node, flow) {
  if (!isMap(node)) return;
  const keys = keysOf(node);
  if (keys.includes('object')) {
    const name = node.get('object', true);
    const label = isScalar(name) ? String(name.value) : '';
    const args = rest(node, new Set(['object']));
    node.items = [];
    node.flow = flow;
    node.set(label || 'object', args.items.length ? args : label);
    return;
  }
  if (keys.includes('player') && (keys.length > 1 || !isMap(node.get('player', true)))) {
    const number = node.get('player', true);
    const args = rest(node, new Set(['player']));
    args.items.unshift(new Pair(new Scalar('name'), number));
    node.items = [];
    node.flow = flow;
    node.set('player', args);
    return;
  }
  if (keys.includes('shape') && keys.length > 1) {
    const name = node.get('shape', true);
    const args = rest(node, new Set(['shape']));
    args.items.unshift(new Pair(new Scalar('name'), name));
    node.items = [];
    node.flow = flow;
    node.set('shape', args);
    return;
  }
  if (keys.includes('ball') && !isMap(node.get('ball', true))) {
    const value = node.get('ball', true);
    const args = new YAMLMap();
    args.flow = true;
    if (isSeq(value)) args.set('at', value);
    else args.set('player', value);
    node.items = [];
    node.flow = flow;
    node.set('ball', args);
  }
}

function convertItems(seq) {
  if (!isSeq(seq)) return;
  const flow = Boolean(seq.flow);
  for (const item of seq.items) convertItem(item, flow);
}

function convertZones(seq) {
  if (!isSeq(seq)) return;
  for (const zone of seq.items) {
    if (!isMap(zone)) continue;
    convertItems(zone.get('items', true));
    convertZones(zone.get('zones', true));
  }
}

function playerItem(node) {
  const name = isMap(node) ? node.get('number', true) : undefined;
  const args = isMap(node) ? rest(node, new Set(['number'])) : new YAMLMap();
  args.flow = true;
  if (name) args.items.unshift(new Pair(new Scalar('name'), name));
  return single('player', args, false);
}

function absorbPlayers(doc) {
  const players = doc.get('players', true);
  if (!isSeq(players)) return;
  if (!isSeq(doc.get('items', true))) doc.set('items', new YAMLSeq());
  const items = doc.get('items', true);
  if (!isSeq(items)) return;
  items.flow = false;
  for (const player of players.items) items.add(playerItem(player));
  doc.delete('players');
}

function convertPitch(doc, kind) {
  if (!isMap(doc.contents)) return;
  const index = doc.contents.items.findIndex(pair => keyOf(pair) === 'pitch');
  if (index < 0) return;
  const pitch = doc.contents.items[index].value;
  if (!isMap(pitch)) return;
  if (pitch.has('template')) {
    const name = pitch.get('template', true);
    const extra = rest(pitch, new Set(['template']));
    if (!extra.items.length) {
      doc.contents.items.splice(index, 1, new Pair(new Scalar('pitch'), name));
      return;
    }
    extra.items.unshift(new Pair(new Scalar('name'), name));
    doc.contents.items.splice(index, 1, new Pair(new Scalar('pitch'), extra));
    return;
  }
  if (kind !== 'pitch') return;
  const pairs = [];
  for (const key of ['width', 'length', 'margin', 'boundary']) {
    if (!pitch.has(key)) continue;
    pairs.push(new Pair(new Scalar(key), pitch.get(key, true)));
  }
  doc.contents.items.splice(index, 1, ...pairs);
}

function stamp(doc, kind) {
  if (!isMap(doc.contents)) return false;
  const type = doc.get('type', true);
  const version = doc.get('version', true);
  const legacy = isScalar(type) && type.value === 'fccn-schema:0';
  const current = isScalar(version) && version.value === 'fccn-schema:0';
  if (!legacy && !current) return false;
  if (legacy) doc.delete('type');
  if (!current) doc.contents.items.unshift(new Pair(new Scalar('version'), new Scalar('fccn-schema:0')));
  if (kind && !doc.has('type')) {
    const at = doc.contents.items.findIndex(pair => keyOf(pair) === 'version');
    doc.contents.items.splice(at + 1, 0, new Pair(new Scalar('type'), new Scalar(kind)));
  }
  absorbPlayers(doc);
  convertPitch(doc, kind);
  convertItems(doc.get('items', true));
  convertZones(doc.get('zones', true));
  return true;
}

function kindOf(file) {
  const parts = path.relative(elements, file).split(path.sep);
  if (parts.includes('pitches')) return 'pitch';
  if (parts.includes('shapes')) return 'shape';
  return '';
}

function textOf(doc) {
  let next = doc.toString({ collectionStyle: 'any', lineWidth: 0, flowCollectionPadding: false });
  if (!next.endsWith('\n')) next += '\n';
  return next;
}

async function companions(files) {
  const yamlStems = new Set(files.filter(file => /\.ya?ml$/i.test(file)).map(file => file.replace(/\.(ya?ml|svg)$/i, '').toLowerCase()));
  let created = 0;
  for (const file of files) {
    if (!/\.svg$/i.test(file)) continue;
    const stem = file.replace(/\.svg$/i, '');
    if (yamlStems.has(stem.toLowerCase())) continue;
    const name = path.basename(file, '.svg');
    const rel = path.relative(elements, file).split(path.sep);
    const pitch = rel.includes('pitches');
    const type = pitch ? 'pitch' : name;
    const lines = ['version: fccn-schema:0', `type: ${type}`];
    if (name !== type) lines.push(`name: ${name}`);
    if (pitch) {
      const box = pitchBox(viewBoxOf(await readFile(file, 'utf8')));
      if (box) {
        lines.push(`width: ${box.width}`, `length: ${box.length}`, `margin: ${box.margin}`);
      }
    }
    lines.push('svg:', `  - { path: ${path.basename(file)} }`, '');
    await writeFile(`${stem}.yaml`, lines.join('\n'), 'utf8');
    created += 1;
  }
  const objects = path.join(elements, 'objects');
  for (const type of ['player', 'ball']) {
    const file = path.join(objects, `${type}.yaml`);
    if (yamlStems.has(file.replace(/\.ya?ml$/i, '').toLowerCase())) continue;
    await writeFile(file, `version: fccn-schema:0\ntype: ${type}\n`, 'utf8');
    created += 1;
  }
  return created;
}

throw new Error('Migration déjà appliquée : les éléments portent un identifiant pointé (object.ball, pitch.half-attack, shape.3-5-2).');

const files = await walk(root);
let changed = 0;
for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const inElements = rel.startsWith('elements/') && /\.ya?ml$/i.test(file);
  const schema = file.endsWith(`${path.sep}schema.yaml`);
  if (!inElements && !schema) continue;
  const source = await readFile(file, 'utf8');
  const doc = parseDocument(source);
  if (doc.errors.length) throw new Error(`${rel} : ${doc.errors[0].message}`);
  if (!stamp(doc, inElements ? kindOf(file) : '')) continue;
  const next = textOf(doc);
  if (next !== source) {
    await writeFile(file, next, 'utf8');
    changed += 1;
  }
}
const created = await companions(await walk(elements));
console.log(`modifiés ${changed}, créés ${created}`);
