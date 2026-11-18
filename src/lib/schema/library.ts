import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fitMode } from './fit';
import { readSchema } from './layout';
import { callOf, dottedId, elementKind } from './scene';
import { parseShare } from './size';
import { hasStretch } from './stretch';
import { readSvg } from './svg';
import { isSvgTag } from './svgShape';
import { SCHEMA_VERSION, type CallArgs, type LibraryEntry, type SchemaDoc, type SizeSpec, type StretchSpec, type SvgAsset } from './types';

interface ElementProps {
  stretch?: StretchSpec;
  size?: SizeSpec;
  fit?: 'ratio' | 'free' | 'none';
  fixed?: boolean;
  upright?: string[];
}

interface RawElement {
  id: string;
  file: string;
  dir: string;
  doc: SchemaDoc;
}

const SKIP_PARAM = new Set([
  'path', 'name', 'title', 'x', 'y', 'w', 'h', 'p', 's', 'r', 'c',
  'unit', 'angle', 'player', 'width', 'length', 'margin', 'padding', 'mirror', 'rotate', 'fit', 'fixed',
  'min', 'min-size', 'real-w', 'real-h', 'stretch-x', 'stretch-y', 'upright', 'listed',
  'items', 'shape', 'formation', 'zone', 'boundary', 'pitch'
]);
const TEST_KEY = /^([\w-]+)=([\w.-]+)$/;

/** Propriétés plates du YAML. Elles recouvrent celles de l’élément de base. */
export function propsOf(doc: SchemaDoc): ElementProps {
  const realW = numberOf(doc['real-w']);
  const realH = numberOf(doc['real-h']);
  const min = doc['min-size'] !== undefined && String(doc['min-size']).trim() !== '' ? parseShare(doc['min-size']) : undefined;
  const x = typeof doc['stretch-x'] === 'string' && doc['stretch-x'].trim() ? doc['stretch-x'] : undefined;
  const y = typeof doc['stretch-y'] === 'string' && doc['stretch-y'].trim() ? doc['stretch-y'] : undefined;
  const written = doc.fit !== undefined && String(doc.fit).trim() !== '';
  const fixed = doc.fixed === true ? true : undefined;
  return {
    stretch: x || y ? { x, y } : undefined,
    size: realW !== undefined || realH !== undefined || min !== undefined ? { realW, realH, min } : undefined,
    fit: written ? fitMode(doc.fit) : undefined,
    fixed,
    upright: uprightOf(doc.upright)
  };
}

function cascade(base: ElementProps, extra: ElementProps): ElementProps {
  const x = extra.stretch?.x || base.stretch?.x;
  const y = extra.stretch?.y || base.stretch?.y;
  const realW = extra.size?.realW ?? base.size?.realW;
  const realH = extra.size?.realH ?? base.size?.realH;
  const min = extra.size?.min ?? base.size?.min;
  return {
    stretch: x || y ? { x, y } : undefined,
    size: realW !== undefined || realH !== undefined || min !== undefined ? { realW, realH, min } : undefined,
    fit: extra.fit ?? base.fit,
    fixed: extra.fixed ?? base.fixed,
    upright: extra.upright ?? base.upright
  };
}

function stamp(asset: SvgAsset, props: ElementProps): SvgAsset {
  const stretch = props.stretch?.x || props.stretch?.y ? props.stretch : undefined;
  const size = props.size;
  let fit = props.fit && props.fit !== 'none' ? props.fit : undefined;
  if (!props.fit && hasStretch(stretch)) fit = 'free';
  return { ...asset, stretch, size, fit, fixed: props.fixed || undefined, upright: props.upright };
}

function uprightOf(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean);
}

function numberOf(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function declaredKeys(doc: SchemaDoc): Set<string> {
  const keys = new Set<string>();
  for (const item of doc.parameters || []) {
    if (item && typeof item === 'object') for (const key of Object.keys(item)) keys.add(key);
  }
  return keys;
}

function itemParams(args: CallArgs, declared: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (SKIP_PARAM.has(key) || declared.has(key) || value === undefined || typeof value === 'object') continue;
    out[key] = String(value);
  }
  return out;
}

function inheritOf(doc: SchemaDoc): { type: string; args: CallArgs } | null {
  const items = doc.items || [];
  if (items.length !== 1) return null;
  const call = callOf(items[0]);
  if (!call || call.type === 'svg' || isSvgTag(call.type)) return null;
  const args = call.args;
  if (args.x !== undefined || args.y !== undefined || args.p !== undefined || args.w !== undefined || args.h !== undefined) return null;
  return call;
}

function resolveRaw(type: string, raws: Map<string, RawElement>): RawElement | undefined {
  if (raws.has(type)) return raws.get(type);
  if (!type.includes('.')) {
    if (raws.has(`object.${type}`)) return raws.get(`object.${type}`);
    if (raws.has(`pitch.${type}`)) return raws.get(`pitch.${type}`);
  }
  const matches = [...raws.values()].filter(raw => raw.id === type || raw.id.endsWith(`.${type}`));
  return matches.length === 1 ? matches[0] : undefined;
}

async function walk(dir: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(next, out);
    else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) out.push(next);
  }
}

function inside(home: string, target: string): boolean {
  const rel = path.relative(home, target);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function collectSvgs(
  items: SchemaDoc['items'],
  when: Record<string, string>,
  raw: RawElement,
  home: string,
  declared: Set<string>,
  assets: SvgAsset[]
) {
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    const keys = Object.keys(item);
    if (keys.length !== 1) continue;
    const key = keys[0];
    const value = item[key];
    const test = TEST_KEY.exec(key);
    if (test && Array.isArray(value)) {
      await collectSvgs(value, { ...when, [test[1]]: test[2] }, raw, home, declared, assets);
      continue;
    }
    const call = callOf(item);
    if (call?.type !== 'svg' || typeof call.args.path !== 'string' || !call.args.path) continue;
    const abs = path.resolve(path.dirname(raw.file), call.args.path);
    if (!inside(home, abs)) continue;
    try {
      const parsed = readSvg(await readFile(abs, 'utf8'));
      if (!parsed.markup && !parsed.viewBox) continue;
      assets.push({
        when: { ...when },
        params: itemParams(call.args, declared),
        markup: parsed.markup,
        viewBox: parsed.viewBox
      });
    } catch { /* dessin absent */ }
  }
}

async function loadSvgs(raw: RawElement, home: string): Promise<SvgAsset[]> {
  const assets: SvgAsset[] = [];
  await collectSvgs(raw.doc.items, {}, raw, home, declaredKeys(raw.doc), assets);
  return assets;
}

/** Éléments YAML. Les SVG ne sont lus que par les items `svg`. */
export async function loadLibrary(dataRoot: string, skip = ''): Promise<LibraryEntry[]> {
  const home = path.join(dataRoot, 'elements');
  const files: string[] = [];
  try { await walk(home, files); } catch { return []; }
  const raws = new Map<string, RawElement>();
  for (const file of files) {
    if (skip && path.resolve(file) === path.resolve(skip)) continue;
    const id = dottedId(path.basename(file));
    if (!id || raws.has(id)) continue;
    try {
      const parsed = readSchema(await readFile(file, 'utf8'));
      if (parsed.version !== SCHEMA_VERSION) continue;
      parsed.type = elementKind(id);
      parsed.id = id;
      const rel = path.relative(dataRoot, file).replaceAll('\\', '/');
      raws.set(id, {
        id,
        file,
        dir: path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel),
        doc: parsed
      });
    } catch (err) {
      console.warn(`${path.basename(file)} : ${err instanceof Error ? err.message : 'yaml illisible'}`);
    }
  }
  const stack = new Set<string>();
  async function assetsOf(raw: RawElement): Promise<SvgAsset[]> {
    if (stack.has(raw.id)) return [];
    stack.add(raw.id);
    const own = await loadSvgs(raw, home);
    const link = !own.length ? inheritOf(raw.doc) : null;
    const base = link ? resolveRaw(link.type, raws) : undefined;
    let assets: SvgAsset[];
    if (base && base.id !== raw.id) {
      const inherited = await assetsOf(base);
      const params = itemParams(link?.args || {}, new Set([...declaredKeys(base.doc), ...declaredKeys(raw.doc)]));
      const props = cascade(propsOf(base.doc), propsOf(raw.doc));
      assets = inherited.map(asset => stamp({ ...asset, params: { ...asset.params, ...params } }, props));
    } else {
      assets = own.map(asset => stamp(asset, propsOf(raw.doc)));
    }
    stack.delete(raw.id);
    return assets;
  }
  const library: LibraryEntry[] = [];
  for (const raw of raws.values()) {
    const kind = elementKind(raw.id);
    const name = raw.id.startsWith(`${kind}.`) ? raw.id.slice(kind.length + 1) : raw.id;
    const rel = path.relative(dataRoot, raw.file).replaceAll('\\', '/');
    library.push({
      id: raw.id,
      name,
      type: kind,
      file: rel,
      dir: raw.dir,
      doc: raw.doc,
      svgs: await assetsOf(raw)
    });
  }
  return library;
}

export interface SvgFileMeta {
  realW?: number;
  realH?: number;
  min?: number;
  stretchX?: string;
  stretchY?: string;
  fit?: string;
  fixed?: boolean;
}

function ownsSvg(items: SchemaDoc['items'], abs: string, yaml: string): boolean {
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    const keys = Object.keys(item);
    if (keys.length !== 1) continue;
    const value = item[keys[0]];
    const test = TEST_KEY.exec(keys[0]);
    if (test && Array.isArray(value)) {
      if (ownsSvg(value, abs, yaml)) return true;
      continue;
    }
    const call = callOf(item);
    if (call?.type !== 'svg' || typeof call.args.path !== 'string') continue;
    if (path.resolve(path.dirname(yaml), call.args.path) === abs) return true;
  }
  return false;
}

/** Propriétés du premier YAML qui référence ce fichier SVG. */
export async function svgOwnerProps(dataRoot: string, file: string): Promise<SvgFileMeta> {
  const abs = path.resolve(dataRoot, file);
  const home = path.join(dataRoot, 'elements');
  if (!inside(path.resolve(dataRoot), abs) || !inside(home, abs)) return {};
  const files: string[] = [];
  try { await walk(home, files); } catch { return {}; }
  for (const yaml of files) {
    let doc: SchemaDoc;
    try { doc = readSchema(await readFile(yaml, 'utf8')); }
    catch { continue; }
    if (!doc || typeof doc !== 'object') continue;
    const hit = ownsSvg(doc.items, abs, yaml);
    if (!hit) continue;
    const props = propsOf(doc);
    return {
      realW: props.size?.realW,
      realH: props.size?.realH,
      min: props.size?.min,
      stretchX: props.stretch?.x,
      stretchY: props.stretch?.y,
      fit: props.fit && props.fit !== 'none' ? props.fit : undefined,
      fixed: props.fixed
    };
  }
  return {};
}
