import { parseDocument } from 'yaml';
import { formatSchema } from './format';
import { GENRES, genreHits, plainItems } from './items';
import type { CallArgs, ItemSpec, LibraryEntry, SchemaDoc, SvgAsset } from './types';

const DRAWINGS = new Set(['circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'path']);
const TEST_KEY = /^([\w-]+)=([\w.-]+)$/;

/** Session d’affichage : élément, puis paramètre, puis valeur. */
export type ParamSession = Record<string, Record<string, string>>;

export interface ParamDecl {
  key: string;
  value: string;
}

/** Une ligne du dialogue : un paramètre d’un élément, et les valeurs rencontrées. */
export interface ParamChoice {
  element: string;
  key: string;
  names: string[];
}

export interface ResolveInput {
  entry: LibraryEntry | undefined;
  library: LibraryEntry[] | Map<string, LibraryEntry>;
  /** Clé de l’appel, par exemple `player` ou `pitch`. */
  callType: string;
  args?: CallArgs | Record<string, unknown>;
  /** Arguments des appels englobants, le plus proche d’abord. */
  parents?: Array<Record<string, string>>;
  /** `defaults` des documents, le plus extérieur d’abord. */
  docs?: Array<Record<string, Record<string, string>>>;
  session?: ParamSession;
}

interface ReadCall {
  type: string;
  args: Record<string, unknown>;
}

/** Dernier segment : `player` pour `player`, `rect` pour `pitch.rect`. */
export function leafOf(id: string | undefined): string {
  const name = id || '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1) : name;
}

/** Clé `param=valeur`. Le reste du texte n’est pas un test. */
export function testOf(item: ItemSpec | undefined): { key: string; value: string; raw: string } | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const keys = Object.keys(item);
  if (keys.length !== 1) return null;
  const matched = TEST_KEY.exec(keys[0]);
  if (!matched) return null;
  return { key: matched[1], value: matched[2], raw: keys[0] };
}

function readCall(item: ItemSpec | undefined): ReadCall | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const keys = Object.keys(item);
  if (keys.length !== 1) return null;
  const type = keys[0];
  if (TEST_KEY.test(type)) return null;
  const value = item[type];
  if (value == null) return { type, args: {} };
  if (typeof value === 'string' || typeof value === 'number') return { type, args: { name: value } };
  if (typeof value === 'object' && !Array.isArray(value)) return { type, args: value as Record<string, unknown> };
  return null;
}

function asLibrary(library: LibraryEntry[] | Map<string, LibraryEntry>): Map<string, LibraryEntry> {
  return library instanceof Map ? library : new Map(library.map(entry => [entry.id, entry]));
}

function textArgs(args: CallArgs | Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!args) return out;
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' || typeof value === 'number') out[key] = String(value);
  }
  return out;
}

function listsOf(doc: { items?: ItemSpec[]; shape?: ItemSpec[]; formation?: ItemSpec[]; zone?: ItemSpec[] }): Array<[string, ItemSpec[] | undefined]> {
  const grouped = genreHits(doc).reduce((bucket, hit) => {
    bucket[hit.genre].push(hit.item);
    return bucket;
  }, { zone: [] as ItemSpec[], formation: [] as ItemSpec[], shape: [] as ItemSpec[], object: [] as ItemSpec[] });
  return GENRES.map(genre => [genre, grouped[genre]]);
}

function findEntry(type: string, library: Map<string, LibraryEntry>, genre = ''): LibraryEntry | undefined {
  if (!type) return undefined;
  const direct = library.get(type);
  if (direct) return direct;
  if (!type.includes('.')) {
    const qualified = genre ? library.get(`${genre}.${type}`) : undefined;
    if (qualified) return qualified;
    const object = library.get(`object.${type}`);
    if (object) return object;
    const pitch = library.get(`pitch.${type}`);
    if (pitch) return pitch;
  }
  const leaf = leafOf(type);
  const matches = [...library.values()].filter(entry => entry.id === leaf || entry.name === leaf || entry.id.endsWith(`.${leaf}`));
  if (matches.length === 1) return matches[0];
  if (genre) {
    const same = matches.filter(entry => entry.type === genre);
    if (same.length === 1) return same[0];
  }
  return undefined;
}

/** Un seul appel sans position : l’élément hérite de sa base. */
function inheritance(doc: SchemaDoc): ReadCall | null {
  const items = plainItems(doc.items).filter(item => {
    const call = readCall(item);
    return Boolean(call && call.type !== 'svg' && !DRAWINGS.has(call.type));
  });
  if (items.length !== 1) return null;
  const call = readCall(items[0]);
  if (!call) return null;
  const args = call.args;
  if (args.x !== undefined || args.y !== undefined || args.p !== undefined || args.w !== undefined || args.h !== undefined) return null;
  return call;
}

function lineage(entry: LibraryEntry | undefined, library: Map<string, LibraryEntry>): LibraryEntry[] {
  const out: LibraryEntry[] = [];
  const seen = new Set<string>();
  let current = entry;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    out.push(current);
    const link = inheritance(current.doc);
    const next = link ? findEntry(link.type, library, current.type) : undefined;
    current = next && next.id !== current.id ? next : undefined;
  }
  return out;
}

function pushName(names: string[], name: string) {
  if (name && !names.includes(name)) names.push(name);
}

/** Paramètres déclarés, la base d’abord. La valeur de l’élément l’emporte sur celle de sa base. */
export function declaredParams(entry: LibraryEntry | undefined, library: LibraryEntry[] | Map<string, LibraryEntry>): ParamDecl[] {
  const names = asLibrary(library);
  const map = new Map<string, string>();
  for (const step of lineage(entry, names).reverse()) {
    for (const item of step.doc.parameters || []) {
      if (!item || typeof item !== 'object') continue;
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'string' || typeof value === 'number') map.set(key, String(value));
      }
    }
  }
  return [...map.entries()].map(([key, value]) => ({ key, value }));
}

function collectTests(items: ItemSpec[] | undefined, bucket: Map<string, string[]>) {
  for (const item of items || []) {
    const test = testOf(item);
    if (!test) continue;
    if (!bucket.has(test.key)) bucket.set(test.key, []);
    pushName(bucket.get(test.key) || [], test.value);
    const body = item[test.raw];
    if (Array.isArray(body)) collectTests(body as ItemSpec[], bucket);
  }
}

/** Valeurs trouvées dans les clés `p=v` de `items` et de `defaults`, avec la lignée. */
export function paramChoices(entry: LibraryEntry | undefined, library: LibraryEntry[] | Map<string, LibraryEntry>): Array<{ key: string; names: string[] }> {
  const names = asLibrary(library);
  const bucket = new Map<string, string[]>();
  for (const step of lineage(entry, names).reverse()) {
    for (const [, items] of listsOf(step.doc)) collectTests(items, bucket);
    for (const item of step.doc.defaults || []) {
      const test = testOf(item as ItemSpec);
      if (!test) continue;
      if (!bucket.has(test.key)) bucket.set(test.key, []);
      pushName(bucket.get(test.key) || [], test.value);
    }
  }
  return [...bucket.entries()].filter(([, list]) => list.length).map(([key, list]) => ({ key, names: list }));
}

function linkArgs(entry: LibraryEntry | undefined, library: Map<string, LibraryEntry>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const step of lineage(entry, library)) {
    const link = inheritance(step.doc);
    if (!link) continue;
    for (const [key, value] of Object.entries(textArgs(link.args))) {
      if (out[key] === undefined) out[key] = value;
    }
  }
  return out;
}

function matchKeys(entry: LibraryEntry | undefined, callType: string, library: Map<string, LibraryEntry>): string[] {
  const keys: string[] = [];
  const push = (key: string) => {
    if (key && !keys.includes(key)) keys.push(key);
  };
  for (const step of lineage(entry, library)) {
    push(step.id);
    push(leafOf(step.id));
  }
  push(callType);
  return keys;
}

function fromMaps(maps: Array<Record<string, Record<string, string>>> | undefined, keys: string[], param: string): string | undefined {
  for (const map of maps || []) {
    for (const key of keys) {
      const value = map[key]?.[param];
      if (value !== undefined && value !== '') return value;
    }
  }
  return undefined;
}

/** Valeur retenue : appel, héritage, appels englobants, defaults, session, déclaration. */
export function resolveParams(input: ResolveInput): Record<string, string> {
  const library = asLibrary(input.library);
  const declared = declaredParams(input.entry, library);
  const links = linkArgs(input.entry, library);
  const call = textArgs(input.args);
  const keys = matchKeys(input.entry, input.callType, library);
  const out: Record<string, string> = {};
  for (const param of declared) {
    if (call[param.key] !== undefined) {
      out[param.key] = call[param.key];
      continue;
    }
    if (links[param.key] !== undefined) {
      out[param.key] = links[param.key];
      continue;
    }
    const parent = (input.parents || []).find(frame => frame[param.key] !== undefined);
    if (parent) {
      out[param.key] = parent[param.key];
      continue;
    }
    const documented = fromMaps(input.docs, keys, param.key);
    if (documented !== undefined) {
      out[param.key] = documented;
      continue;
    }
    const session = fromMaps(input.session ? [input.session] : [], keys, param.key);
    out[param.key] = session ?? param.value;
  }
  return out;
}

/** Déplie les tests de `items`. Les conditions s’ajoutent. Un test non vérifié disparaît. */
export function activeItems(items: ItemSpec[] | undefined, params: Record<string, string>): ItemSpec[] {
  const out: ItemSpec[] = [];
  for (const item of items || []) {
    const test = testOf(item);
    if (!test) {
      out.push(item);
      continue;
    }
    const body = item[test.raw];
    if (!Array.isArray(body) || params[test.key] !== test.value) continue;
    out.push(...activeItems(body as ItemSpec[], params));
  }
  return out;
}

/** Maps `p=v` de `defaults` dont le test est vrai. La lignée part de la base : l’enfant recouvre. */
export function paramValues(entry: LibraryEntry | undefined, params: Record<string, string>, library: LibraryEntry[] | Map<string, LibraryEntry>): Record<string, string> {
  const names = asLibrary(library);
  const out: Record<string, string> = {};
  for (const step of lineage(entry, names).reverse()) {
    for (const item of step.doc.defaults || []) {
      const test = testOf(item as ItemSpec);
      if (!test || params[test.key] !== test.value) continue;
      const body = (item as Record<string, unknown>)[test.raw];
      if (!body || typeof body !== 'object' || Array.isArray(body)) continue;
      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        if (typeof value === 'string' || typeof value === 'number') out[key] = String(value);
      }
    }
  }
  return out;
}

/** Entrées `type: { … }` de `defaults`. Les clés `p=v` restent des valeurs, pas des arguments. */
export function callDefaults(doc: SchemaDoc | null | undefined): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const item of doc?.defaults || []) {
    if (!item || typeof item !== 'object') continue;
    const keys = Object.keys(item);
    if (keys.length !== 1 || TEST_KEY.test(keys[0])) continue;
    const body = item[keys[0]];
    if (!body || typeof body !== 'object' || Array.isArray(body)) continue;
    const args = out[keys[0]] || {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (args[key] !== undefined) continue;
      if (typeof value === 'string' || typeof value === 'number') args[key] = String(value);
      else if (typeof value === 'boolean') args[key] = value ? 'true' : 'false';
      else if (Array.isArray(value)) {
        const text = value.filter(part => typeof part === 'string' || typeof part === 'number').map(String);
        if (text.length) args[key] = text.join(' ');
      }
    }
    if (Object.keys(args).length) out[keys[0]] = args;
  }
  return out;
}

/** Premier dessin dont chaque condition `when` est vraie. Sans condition, le dessin est pris. */
export function pickAsset(assets: SvgAsset[] | undefined, params: Record<string, string>): SvgAsset | undefined {
  return (assets || []).find(asset => Object.entries(asset.when || {}).every(([key, value]) => params[key] === value));
}

function placedEntry(call: ReadCall, library: Map<string, LibraryEntry>, genre: string): LibraryEntry | undefined {
  if (call.type === 'pitch') {
    const name = call.args.name;
    return typeof name === 'string' || typeof name === 'number' ? findEntry(String(name), library, 'pitch') : undefined;
  }
  return findEntry(call.type, library, genre);
}

function isLink(doc: SchemaDoc, call: ReadCall): boolean {
  const link = inheritance(doc);
  if (!link || link.type !== call.type) return false;
  const args = call.args;
  return args.x === undefined && args.y === undefined && args.p === undefined && args.w === undefined && args.h === undefined;
}

function addChoice(rows: Map<string, ParamChoice>, element: string, choice: { key: string; names: string[] }) {
  if (!element || !choice.names.length) return;
  const id = `${element}\0${choice.key}`;
  const existing = rows.get(id);
  if (!existing) {
    rows.set(id, { element, key: choice.key, names: [...choice.names] });
    return;
  }
  for (const name of choice.names) pushName(existing.names, name);
}

/** Paires (élément, paramètre, valeurs) du schéma ouvert, pour les dialogues. */
export function documentChoices(doc: SchemaDoc, library: LibraryEntry[] | Map<string, LibraryEntry>, elementId = ''): ParamChoice[] {
  const names = asLibrary(library);
  const rows = new Map<string, ParamChoice>();
  const seen = new Set<string>();
  const id = elementId || doc.id || '';
  const self = id ? findEntry(id, names) : undefined;
  if (self) {
    const link = inheritance(self.doc);
    const element = link?.type || leafOf(self.id);
    for (const choice of paramChoices(self, names)) addChoice(rows, element, choice);
  }

  const consider = (call: ReadCall, genre: string, source: SchemaDoc) => {
    if (call.type === 'svg' || DRAWINGS.has(call.type) || isLink(source, call)) return;
    const entry = placedEntry(call, names, genre);
    const mark = `${call.type}:${entry?.id || ''}`;
    if (seen.has(mark)) return;
    seen.add(mark);
    for (const choice of paramChoices(entry, names)) addChoice(rows, call.type, choice);
    if (entry) visit(entry.doc);
  };

  const visitItems = (source: SchemaDoc, genre: string, items: ItemSpec[] | undefined) => {
    for (const item of items || []) {
      const test = testOf(item);
      if (test && Array.isArray(item[test.raw])) {
        visitItems(source, genre, item[test.raw] as unknown as ItemSpec[]);
        continue;
      }
      const call = readCall(item);
      if (call) consider(call, genre, source);
    }
  };

  const visit = (source: SchemaDoc) => {
    for (const [genre, items] of listsOf(source)) visitItems(source, genre, items);
  };
  visit(doc);
  return [...rows.values()];
}

/** Écrit ou retire une clé dans l’entrée `type: { … }` de `defaults`. Une valeur vide retire la clé. */
export function writeDefaults(source: string, type: string, key: string, value: string): string {
  if (!/^[\w.-]+$/.test(type) || !/^[\w-]+$/.test(key)) return source;
  if (value && !/^[\w.-]+$/.test(value)) return source;
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const data = doc.toJS() as { defaults?: unknown };
  const list = Array.isArray(data.defaults)
    ? data.defaults.map(item => (item && typeof item === 'object' ? { ...item as Record<string, unknown> } : {}))
    : [];
  const index = list.findIndex(item => {
    const keys = Object.keys(item);
    return keys.length === 1 && keys[0] === type && !TEST_KEY.test(keys[0]);
  });
  if (!value) {
    if (index < 0) return source;
    const body = list[index][type];
    if (!body || typeof body !== 'object' || Array.isArray(body)) return source;
    const next = { ...(body as Record<string, unknown>) };
    delete next[key];
    if (Object.keys(next).length) list[index] = { [type]: next };
    else list.splice(index, 1);
  } else if (index < 0) {
    list.push({ [type]: { [key]: value } });
  } else {
    const body = list[index][type];
    const next = body && typeof body === 'object' && !Array.isArray(body) ? { ...(body as Record<string, unknown>) } : {};
    next[key] = value;
    list[index] = { [type]: next };
  }
  if (list.length) doc.set('defaults', list);
  else if (doc.has('defaults')) doc.delete('defaults');
  let next = doc.toString({ collectionStyle: 'any', lineWidth: 0 });
  if (!next.endsWith('\n')) next += '\n';
  return formatSchema(next);
}
