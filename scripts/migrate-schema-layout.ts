import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isMap, isScalar, isSeq, parseDocument, type Pair, type YAMLMap, type YAMLSeq } from 'yaml';
import { formatSchema } from '../src/lib/schema/format';
import { CATEGORIES, SETTING_KEYS } from '../src/lib/schema/layout';

const DEFINE_GROUPS = ['r', 'p', 'c'];
const LISTS = ['zone', 'formation', 'shape'] as const;

function keyOf(pair: Pair): string {
  return isScalar(pair.key) && pair.key.value != null ? String(pair.key.value) : '';
}

async function yamlFiles(dir: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) await yamlFiles(next, out);
    else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) out.push(next);
  }
}

function migrate(source: string, file: string): string {
  const doc = parseDocument(source);
  if (doc.errors.length || !isMap(doc.contents)) throw new Error('YAML illisible');
  const root = doc.contents;
  const take = (key: string): Pair | undefined => {
    const index = root.items.findIndex(pair => keyOf(pair) === key);
    if (index < 0) return undefined;
    return root.items.splice(index, 1)[0];
  };
  const entry = (key: string, value: unknown): YAMLMap => {
    const map = doc.createNode({}) as YAMLMap;
    map.set(key, value as never);
    return map;
  };

  const settings: YAMLMap[] = [];
  for (const key of SETTING_KEYS) {
    const pair = take(key);
    if (pair) settings.push(entry(key, pair.value));
  }
  if (settings.length) {
    const existing = root.get('settings', true);
    const seq = isSeq(existing) ? existing : doc.createNode([]) as YAMLSeq;
    if (!isSeq(existing)) root.set('settings', seq);
    seq.items.push(...settings);
  }

  const names = new Set<string>();
  const defined: YAMLMap[] = [];
  for (const group of DEFINE_GROUPS) {
    const pair = take(group);
    if (!pair) continue;
    if (!isMap(pair.value)) throw new Error(`${group} doit être un groupe`);
    for (const part of pair.value.items) {
      const name = keyOf(part);
      if (!name) continue;
      if (names.has(name)) throw new Error(`Nom ${name} en double dans define`);
      names.add(name);
      defined.push(entry(name, part.value));
    }
  }
  if (defined.length) {
    const existing = root.get('define', true);
    const seq = isSeq(existing) ? existing : doc.createNode([]) as YAMLSeq;
    if (!isSeq(existing)) root.set('define', seq);
    seq.items.push(...defined);
  }

  const wrapped: YAMLMap[] = [];
  for (const genre of LISTS) {
    const pair = take(genre);
    if (!pair) continue;
    if (!isSeq(pair.value)) throw new Error(`${genre} doit être une liste`);
    for (const item of pair.value.items) wrapped.push(entry(genre, item));
  }

  const legacy = take('object');
  let items = root.get('items', true);
  if (!isSeq(items) && legacy && isSeq(legacy.value)) {
    root.set('items', legacy.value);
    items = root.get('items', true);
  } else if (legacy && isSeq(legacy.value) && isSeq(items)) {
    items.items.push(...legacy.value.items);
  } else if (legacy) {
    throw new Error('object doit être une liste');
  }

  const pitch = take('pitch');
  if (wrapped.length || pitch) {
    if (!isSeq(items)) {
      const seq = doc.createNode([]) as YAMLSeq;
      root.set('items', seq);
      items = seq;
    }
    const extra = [...wrapped];
    if (pitch) extra.push(entry('pitch', pitch.value));
    items.items = [...extra, ...items.items];
  }

  const rank = (pair: Pair) => {
    const index = (CATEGORIES as readonly string[]).indexOf(keyOf(pair));
    return index < 0 ? CATEGORIES.length : index;
  };
  root.items.sort((a, b) => rank(a) - rank(b));

  const left = root.items.map(keyOf).filter(key => key && !(CATEGORIES as readonly string[]).includes(key));
  if (left.length) throw new Error(`Clé ${left.join(', ')} hors catégorie`);

  let next = doc.toString({ collectionStyle: 'any', lineWidth: 0 });
  if (source.includes('\r\n')) next = next.replace(/\n/g, '\r\n');
  return formatSchema(next);
}

const root = path.resolve('data');
const files: string[] = [];
await yamlFiles(root, files);
const errors: string[] = [];
let changed = 0;
for (const file of files) {
  const source = await readFile(file, 'utf8');
  try {
    const next = migrate(source, file);
    if (next !== source) {
      await writeFile(file, next);
      changed += 1;
    }
  } catch (err) {
    errors.push(`${path.relative(root, file)} : ${err instanceof Error ? err.message : 'illisible'}`);
  }
}
console.log(`${changed} fichier${changed > 1 ? 's' : ''} mis à jour, ${files.length} lus.`);
if (errors.length) {
  for (const line of errors) console.error(line);
  process.exitCode = 1;
}
