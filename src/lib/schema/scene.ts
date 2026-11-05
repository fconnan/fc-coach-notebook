import { ballBeside, ballMarkup, ballRadius, playerTokenRadius } from './ball';
import { applyParams } from './params';
import { glyphFactor, realExtent, resolveMin } from './size';
import type {
  ArrowMark,
  BoxInset,
  CallArgs,
  ItemSpec,
  LibraryEntry,
  MoveSpec,
  PlacedMark,
  PlacedPlayer,
  PlacedZone,
  Scene,
  SchemaDoc,
  SchemaUnit,
  SvgAsset
} from './types';
import { SCHEMA_VERSION } from './types';
import { frameOfSize, hasStretch, stretchSvg, viewBoxOf as parsedBox } from './stretch';

/** `object.ball.svg` ou `pitch.half-attack.yaml` donne `object.ball`. Un second point marque une variante, pas un élément. */
export function dottedId(filename: string): string {
  const base = filename.replace(/\.(svg|ya?ml)$/i, '');
  const parts = base.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return '';
  return base;
}

const GENRES = ['zone', 'formation', 'shape', 'object'] as const;
type Genre = typeof GENRES[number];

/** Premier segment : object, pitch, shape, formation, zone. */
export function elementKind(id: string): string {
  return id.split('.')[0] || '';
}

export function elementKey(id: string): string {
  return id;
}

export function isPlayerId(id: string): boolean {
  return id === 'object.player';
}

export function isBallId(id: string): boolean {
  return id === 'object.ball';
}

/** La clé unique d’un item est l’identifiant pointé. Une valeur vide vaut {}. */
export function callOf(item: ItemSpec | undefined): { type: string; args: CallArgs } | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const keys = Object.keys(item);
  if (keys.length !== 1) return null;
  const type = keys[0];
  const value = item[type];
  if (value == null) return { type, args: {} };
  if (typeof value === 'string' || typeof value === 'number') return { type, args: { name: value } };
  if (typeof value === 'object' && !Array.isArray(value)) return { type, args: value };
  return null;
}

/** Élément dont l’identifiant pointé est celui de l’appel. */
export function resolveElement(library: Map<string, LibraryEntry>, id: string): LibraryEntry | undefined {
  return id ? library.get(elementKey(id)) : undefined;
}

function parts(value: string): string[] {
  return value.split('/').filter(Boolean);
}

function score(exerciseDir: string, schemaDir: string): [number, number] | null {
  const ex = parts(exerciseDir);
  const sc = parts(schemaDir);
  const global = sc[0] === 'elements';
  let shared = 0;
  while (shared < ex.length && shared < sc.length && ex[shared] === sc[shared]) shared += 1;
  const insideExercise = shared === ex.length;
  const onAncestor = shared === sc.length;
  const localLibrary = shared > 0 && sc[shared] === 'library';
  if (!global && !insideExercise && !onAncestor && !localLibrary) return null;
  return [shared, -(sc.length - shared)];
}

export function libraryFor(exerciseDir: string, entries: LibraryEntry[], exerciseFile = ''): Map<string, LibraryEntry> {
  const best = new Map<string, { entry: LibraryEntry; rank: [number, number] }>();
  for (const entry of entries) {
    if (!entry.id || entry.file === exerciseFile) continue;
    const rank = score(exerciseDir, entry.dir);
    if (!rank) continue;
    const key = elementKey(entry.id);
    const current = best.get(key);
    if (!current || rank[0] > current.rank[0] || (rank[0] === current.rank[0] && rank[1] > current.rank[1])) {
      best.set(key, { entry, rank });
    }
  }
  return new Map([...best.entries()].map(([key, item]) => [key, item.entry]));
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pointOf(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) return [num(value[0]), num(value[1])];
  if (value && typeof value === 'object') {
    const spot = value as { x?: unknown; y?: unknown };
    if (typeof spot.x === 'number' && typeof spot.y === 'number') return [spot.x, spot.y];
  }
  return null;
}

function placedAt(item: { x?: number; y?: number; at?: unknown; pos?: unknown }): [number, number] | null {
  const pos = pointOf(item.pos);
  if (pos) return pos;
  if (typeof item.x === 'number' && typeof item.y === 'number') return [item.x, item.y];
  return pointOf(item.at);
}

function idOf(value: string | number | undefined): string {
  return value === undefined ? '' : String(value);
}

type Box = [number, number, number, number];
type Unit = SchemaUnit;

interface Xform {
  mirror: boolean;
  rotate: boolean;
}

const IDENTITY: Xform = { mirror: false, rotate: false };

interface PlaceBag {
  library: Map<string, LibraryEntry>;
  style: string;
  frameLength: number;
  /** Document en cours et son cadre, en mètres. */
  host?: SchemaDoc;
  frame: Box;
  players: PlacedPlayer[];
  marks: PlacedMark[];
  zones: PlacedZone[];
  lines: number[][];
  drawings: string[];
  ballHolder: { id: string; svg: string; ref?: string; radius: number; real: number; min?: number };
}

function pitchArgs(doc: SchemaDoc): CallArgs {
  if (typeof doc.pitch === 'string' || typeof doc.pitch === 'number') return { name: String(doc.pitch) };
  if (doc.pitch && typeof doc.pitch === 'object') return doc.pitch;
  return {};
}

function qualify(kind: string, key: string): string {
  if (!key) return '';
  return key.includes('.') ? key : `${kind}.${key}`;
}

function pitchId(args: CallArgs): string {
  if (args.name === undefined || args.name === '') return '';
  return qualify('pitch', String(args.name));
}

function entryOf(library: Map<string, LibraryEntry>, doc: SchemaDoc): LibraryEntry | undefined {
  return doc.id ? library.get(elementKey(doc.id)) : undefined;
}

function assetOf(entry: LibraryEntry | undefined, style: string): SvgAsset | undefined {
  const variants = entry?.svgs || [];
  if (!variants.length) return undefined;
  const wanted = style ? variants.find(item => item.style === style) : undefined;
  return wanted || variants.find(item => !item.style) || variants[0];
}

function markupOf(entry: LibraryEntry | undefined, style: string): string {
  return assetOf(entry, style)?.markup || '';
}

function halfTurn(value: unknown): boolean {
  return (((num(value, 0) % 360) + 360) % 360) === 180;
}

function turnOf(args: CallArgs): Xform {
  return { mirror: args.mirror === true, rotate: halfTurn(args.rotate) };
}

function compose(outer: Xform, inner: Xform): Xform {
  return { mirror: outer.mirror !== inner.mirror, rotate: outer.rotate !== inner.rotate };
}

/** Sens d’un terrain, y compris le terrain qu’il reprend. */
function facingOf(doc: SchemaDoc | undefined, library: Map<string, LibraryEntry>, depth = 0): Xform {
  if (!doc || depth > 6) return IDENTITY;
  const args = pitchArgs(doc);
  const id = pitchId(args);
  const base = id ? resolveElement(library, id) : undefined;
  return compose(turnOf(args), base ? facingOf(base.doc, library, depth + 1) : IDENTITY);
}

function callPitchId(args: CallArgs, doc: SchemaDoc | undefined): string {
  if (typeof args.pitch === 'string' && args.pitch) return qualify('pitch', args.pitch);
  return doc ? pitchId(pitchArgs(doc)) : '';
}

/**
 * Rectangle d’un demi-terrain nommé sur le terrain du document.
 * Le demi-tour n’est ajouté que si le sens du fichier et celui de la zone diffèrent.
 */
function pitchSlot(bag: PlaceBag, doc: SchemaDoc | undefined, args: CallArgs): { x: number; y: number; w: number; h: number; turn: boolean } | null {
  if (typeof args.w === 'number' && typeof args.h === 'number') return null;
  if (!bag.host || bag.frame[2] <= 0 || bag.frame[3] <= 0) return null;
  const targetId = callPitchId(args, doc);
  if (!targetId) return null;
  const hostId = pitchId(pitchArgs(bag.host));
  if (!hostId || hostId === targetId) return null;
  const zones = resolveElement(bag.library, hostId)?.doc.zone;
  if (!zones) return null;
  for (const item of zones) {
    const call = callOf(item);
    if (!call) continue;
    if (qualify('pitch', call.type) !== targetId) continue;
    const target = resolveElement(bag.library, targetId)?.doc;
    const size = target ? sizeOf(target, bag.library, 0) : null;
    if (!size) return null;
    const written = args.rotate !== undefined || args.mirror !== undefined;
    const from = facingOf(doc, bag.library);
    const to = facingOf(target, bag.library);
    const rel = (call.args.unit || 'meters') === 'relative';
    return {
      x: num(call.args.x) * (rel ? bag.frame[2] : 1),
      y: num(call.args.y) * (rel ? bag.frame[3] : 1),
      w: size.width,
      h: size.length,
      turn: !written && (from.mirror !== to.mirror || from.rotate !== to.rotate)
    };
  }
  return null;
}

/** Le miroir échange les extrémités. Le demi-tour échange aussi les côtés. Le demi-tour est appliqué d’abord. */
function turnDrawing(drawing: string, xform: Xform, width: number, length: number): string {
  if (!drawing) return '';
  const parts: string[] = [];
  if (xform.mirror) parts.push(`translate(0 ${length}) scale(1 -1)`);
  if (xform.rotate) parts.push(`translate(${width} ${length}) scale(-1 -1)`);
  if (!parts.length) return drawing;
  return `<g transform="${parts.join(' ')}">${drawing}</g>`;
}

function applyXform(u: number, v: number, xform: Xform): [number, number] {
  let x = u;
  let y = v;
  if (xform.rotate) {
    x = 1 - x;
    y = 1 - y;
  }
  if (xform.mirror) y = 1 - y;
  return [x, y];
}

function transformBox(box: Box, parent: Box, xform: Xform): Box {
  if (!xform.mirror && !xform.rotate) return box;
  if (parent[2] === 0 || parent[3] === 0) return box;
  const corners: [number, number][] = [
    [box[0], box[1]],
    [box[0] + box[2], box[1]],
    [box[0], box[1] + box[3]],
    [box[0] + box[2], box[1] + box[3]]
  ];
  const mapped = corners.map(([x, y]) => {
    const [u, v] = applyXform((x - parent[0]) / parent[2], (y - parent[1]) / parent[3], xform);
    return [parent[0] + u * parent[2], parent[1] + v * parent[3]] as [number, number];
  });
  const xs = mapped.map(point => point[0]);
  const ys = mapped.map(point => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY];
}

function mapPoint(at: [number, number], box: Box, relative: boolean): [number, number] {
  if (!relative) return [box[0] + at[0], box[1] + at[1]];
  return [box[0] + at[0] * box[2], box[1] + at[1] * box[3]];
}

function mapLocal(at: [number, number], box: Box, relative: boolean, xform: Xform): [number, number] {
  const [x, y] = mapPoint(at, box, relative);
  if ((!xform.mirror && !xform.rotate) || box[2] === 0 || box[3] === 0) return [x, y];
  const [u, v] = applyXform((x - box[0]) / box[2], (y - box[1]) / box[3], xform);
  return [box[0] + u * box[2], box[1] + v * box[3]];
}

function inheritedUnit(doc: SchemaDoc): Unit {
  if (doc.units === 'relative' || doc.units === 'meters') return doc.units;
  if (doc.type === 'shape' || doc.type === 'formation') return 'relative';
  return 'meters';
}

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function edgesOf(value: BoxInset | undefined, sx: number, sy: number): Insets {
  if (typeof value === 'number') return { top: value * sy, right: value * sx, bottom: value * sy, left: value * sx };
  if (!value) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (value.top !== undefined || value.right !== undefined || value.bottom !== undefined || value.left !== undefined) {
    return {
      top: num(value.top) * sy,
      right: num(value.right) * sx,
      bottom: num(value.bottom) * sy,
      left: num(value.left) * sx
    };
  }
  return { top: num(value.y) * sy, right: num(value.x) * sx, bottom: num(value.y) * sy, left: num(value.x) * sx };
}

function insetBox(box: Box, edges: Insets): Box | null {
  const w = box[2] - edges.left - edges.right;
  const h = box[3] - edges.bottom - edges.top;
  if (w <= 0 || h <= 0) return null;
  return [box[0] + edges.left, box[1] + edges.bottom, w, h];
}

function hasPitch(doc: SchemaDoc): boolean {
  if (typeof doc.pitch === 'string' || typeof doc.pitch === 'number') return String(doc.pitch).length > 0;
  return Boolean(doc.pitch && typeof doc.pitch === 'object' && (doc.pitch.name || doc.pitch.width || doc.pitch.length));
}

function sizeOf(doc: SchemaDoc, library: Map<string, LibraryEntry>, depth: number): { width: number; length: number } | null {
  if (depth > 6) return null;
  const ownW = num(doc.width, 0);
  const ownL = num(doc.length, 0);
  const args = pitchArgs(doc);
  const id = pitchId(args);
  const base = id ? resolveElement(library, id) : undefined;
  const inner = base ? sizeOf(base.doc, library, depth + 1) : null;
  const width = ownW || num(args.width, 0) || inner?.width || 0;
  const length = ownL || num(args.length, 0) || inner?.length || 0;
  if (!width || !length) return null;
  return { width, length };
}

function frameSize(doc: SchemaDoc, library: Map<string, LibraryEntry>): { width: number; length: number; margin: number; boundary: string } {
  const args = pitchArgs(doc);
  const id = pitchId(args);
  const base = id ? resolveElement(library, id) : undefined;
  const inner = base ? frameSize(base.doc, library) : null;
  const sized = sizeOf(doc, library, 0);
  let width = num(args.width, 0) || num(doc.width, 0) || sized?.width || inner?.width || 0;
  let length = num(args.length, 0) || num(doc.length, 0) || sized?.length || inner?.length || 0;
  const margin = typeof args.margin === 'number'
    ? args.margin
    : doc.margin !== undefined
      ? num(doc.margin)
      : inner?.margin ?? 0;
  const boundary = args.boundary || doc.boundary || inner?.boundary || '';
  if (!width || !length) {
    if (doc.type === 'zone' || (!hasPitch(doc) && doc.type !== 'pitch')) {
      width = width || 20;
      length = length || 20;
    } else {
      width = width || 68;
      length = length || 105;
    }
  }
  return { width, length, margin, boundary };
}

function partPath(path: string): { id: string; key: string } | null {
  const cut = path.lastIndexOf('.');
  if (cut <= 0) return null;
  let id = path.slice(0, cut);
  if (!id.includes('.')) id = qualify('pitch', id);
  return { id, key: path.slice(cut + 1) };
}

function markField(source: object, key: string): number {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : 0;
}

/** Origine de l’élément dans le terrain du document. Le repère de l’élément lui-même reste à zéro. */
function markOrigin(bag: PlaceBag, elementId: string): { x: number; y: number } {
  const host = bag.host;
  if (!host) return { x: 0, y: 0 };
  const hostId = pitchId(pitchArgs(host));
  if (!hostId || hostId === elementId) return { x: 0, y: 0 };
  for (const item of resolveElement(bag.library, hostId)?.doc.zone || []) {
    const call = callOf(item);
    if (!call || qualify('pitch', call.type) !== elementId) continue;
    return { x: num(call.args.x), y: num(call.args.y) };
  }
  return { x: 0, y: 0 };
}

/** `p`, `s` et `r` remplissent la géométrie. Un nombre absent dans un groupe vaut 0. Un chemin est en mètres. */
function applyGeometry(args: CallArgs, bag: PlaceBag): CallArgs {
  const next: CallArgs = { ...args };
  let meters = false;
  if (args.r && typeof args.r === 'object') {
    next.x = markField(args.r, 'x');
    next.y = markField(args.r, 'y');
    next.w = markField(args.r, 'w');
    next.h = markField(args.r, 'h');
  } else if (typeof args.r === 'string') {
    const parts = partPath(args.r);
    const rect = parts ? resolveElement(bag.library, parts.id)?.doc.r?.[parts.key] : undefined;
    if (parts && rect) {
      const origin = markOrigin(bag, parts.id);
      next.x = origin.x + markField(rect, 'x');
      next.y = origin.y + markField(rect, 'y');
      next.w = markField(rect, 'w');
      next.h = markField(rect, 'h');
      meters = true;
    }
  }
  if (!args.r && !args.p && args.c && typeof args.c === 'object') {
    next.x = markField(args.c, 'x');
    next.y = markField(args.c, 'y');
  } else if (!args.r && !args.p && typeof args.c === 'string') {
    const parts = partPath(args.c);
    const circle = parts ? resolveElement(bag.library, parts.id)?.doc.c?.[parts.key] : undefined;
    if (parts && circle) {
      const origin = markOrigin(bag, parts.id);
      next.x = origin.x + markField(circle, 'x');
      next.y = origin.y + markField(circle, 'y');
      meters = true;
    }
  }
  if (args.p && typeof args.p === 'object') {
    next.x = markField(args.p, 'x');
    next.y = markField(args.p, 'y');
  } else if (typeof args.p === 'string') {
    const parts = partPath(args.p);
    const point = parts ? resolveElement(bag.library, parts.id)?.doc.p?.[parts.key] : undefined;
    if (parts && point) {
      const origin = markOrigin(bag, parts.id);
      next.x = origin.x + markField(point, 'x');
      next.y = origin.y + markField(point, 'y');
      meters = true;
    }
  }
  if (args.s && typeof args.s === 'object') {
    next.w = markField(args.s, 'w');
    next.h = markField(args.s, 'h');
  }
  if (meters) next.unit = 'meters';
  return next;
}

function boxOf(args: CallArgs, parent: Box, unit: Unit, intrinsic: { width: number; length: number } | null, inset: boolean): { border: Box; content: Box } | null {
  let outer: Box;
  if (typeof args.w === 'number' && typeof args.h === 'number') {
    const x = num(args.x);
    const y = num(args.y);
    outer = unit === 'relative'
      ? [parent[0] + x * parent[2], parent[1] + y * parent[3], args.w * parent[2], args.h * parent[3]]
      : [parent[0] + x, parent[1] + y, args.w, args.h];
  } else if (!inset && typeof args.width === 'number' && typeof args.length === 'number') {
    outer = [parent[0] + num(args.x), parent[1] + num(args.y), args.width, args.length];
  } else if (!inset && intrinsic) {
    outer = [parent[0] + num(args.x), parent[1] + num(args.y), intrinsic.width, intrinsic.length];
  } else {
    outer = [parent[0], parent[1], parent[2], parent[3]];
  }
  const scaleX = unit === 'relative' ? parent[2] : 1;
  const scaleY = unit === 'relative' ? parent[3] : 1;
  const border = insetBox(outer, edgesOf(inset ? args.margin : undefined, scaleX, scaleY));
  if (!border) return null;
  const content = insetBox(border, edgesOf(args.padding, scaleX, scaleY));
  if (!content) return null;
  return { border, content };
}

function resolvePercents(markup: string, w: number, h: number): string {
  return markup.replace(/([\w:-]+)="(-?[\d.]+)%"/g, (_all, name: string, raw: string) => {
    const vertical = /^(y|y1|y2|height|cy|ry)$/.test(name);
    const value = (Number(raw) / 100) * (vertical ? h : w);
    const rounded = Math.round(value * 1000) / 1000;
    return `${name}="${rounded}"`;
  });
}

function emitDrawing(entry: LibraryEntry | undefined, style: string, box: Box, xform: Xform, bag: PlaceBag, title = '') {
  const asset = assetOf(entry, style);
  if (!asset?.markup || box[2] <= 0 || box[3] <= 0) return;
  const percent = /="[^"]*%"/.test(asset.markup);
  const markup = applyParams(percent ? resolvePercents(asset.markup, box[2], box[3]) : asset.markup, { title });
  const width = percent ? box[2] : num(entry?.doc.width, 0) || box[2];
  const length = percent ? box[3] : num(entry?.doc.length, 0) || box[3];
  const screenY = bag.frameLength - (box[1] + box[3]);
  const turned = turnDrawing(markup, xform, width, length);
  bag.drawings.push(
    `<svg x="${box[0]}" y="${screenY}" width="${box[2]}" height="${box[3]}" viewBox="0 0 ${width} ${length}" overflow="visible">${turned}</svg>`
  );
}

function listsOf(doc: { object?: ItemSpec[]; shape?: ItemSpec[]; formation?: ItemSpec[]; zone?: ItemSpec[] }): Record<Genre, ItemSpec[] | undefined> {
  return { zone: doc.zone, formation: doc.formation, shape: doc.shape, object: doc.object };
}

function areaMode(id: string): 'full' | 'content' {
  const kind = elementKind(id);
  return kind === 'zone' || kind === 'pitch' ? 'full' : 'content';
}

function fillsParent(id: string): boolean {
  const kind = elementKind(id);
  return kind === 'formation' || kind === 'zone' || kind === 'shape';
}

function isComposition(doc: SchemaDoc): boolean {
  if (doc.type === 'pitch' || doc.type === 'zone' || isPlayerId(doc.id || '') || isBallId(doc.id || '')) return false;
  return Boolean(doc.object?.length || doc.shape?.length || doc.formation?.length || doc.zone?.length || doc.outline);
}

function meterOf(value: number | undefined, relative: boolean, span: number): number | undefined {
  if (typeof value !== 'number') return undefined;
  return relative ? value * span : value;
}

function placeBall(args: CallArgs, box: Box, local: Unit, xform: Xform, bag: PlaceBag, ref?: string) {
  const def = resolveElement(bag.library, 'object.ball');
  const svg = markupOf(def, String(args.style || bag.style || ''));
  if (svg) bag.ballHolder.svg = svg;
  if (ref) bag.ballHolder.ref = ref;
  const asset = assetOf(def, String(args.style || bag.style || ''));
  const extent = realExtent(asset?.size, parsedBox(asset?.viewBox || ''));
  const declared = Boolean(asset?.size?.realW || asset?.size?.realH);
  let diameter = declared ? extent.w : ballRadius * 2;
  const width = meterOf(args.w, local === 'relative', box[2]);
  const height = meterOf(args.h, local === 'relative', box[3]);
  if (width !== undefined || height !== undefined) {
    const sx = width !== undefined ? width / diameter : undefined;
    const sy = height !== undefined ? height / diameter : undefined;
    const scale = sx !== undefined && sy !== undefined ? Math.min(sx, sy) : (sx ?? sy ?? 1);
    diameter = Math.max(0.05, diameter * scale);
  }
  bag.ballHolder.radius = diameter / 2;
  bag.ballHolder.real = diameter;
  bag.ballHolder.min = resolveMin(bag.host?.sizes, def?.id || 'object.ball', asset?.size?.min, args.min);
  const at = placedAt(args);
  if (args.player !== undefined && !at) {
    bag.ballHolder.id = idOf(args.player);
    return;
  }
  if (at) {
    const placed = mapLocal(at, box, local === 'relative', xform);
    bag.ballHolder.id = `@${placed[0]},${placed[1]}`;
    return;
  }
  if (args.player !== undefined) bag.ballHolder.id = idOf(args.player);
}

function spotMeta(ref: string | undefined, own: boolean, box: Box, relative: boolean, xform: Xform) {
  if (!ref) return {};
  return {
    ref,
    locked: !own || xform.mirror || xform.rotate,
    ox: box[0],
    oy: box[1],
    sx: box[2],
    sy: box[3],
    relative
  };
}

function placePoint(id: string, args: CallArgs, box: Box, unit: Unit, xform: Xform, bag: PlaceBag, ref: string | undefined, own: boolean, team: string, corners: [number, number][]) {
  const local = args.unit || unit;
  const def = resolveElement(bag.library, id);
  if (isBallId(id) || isBallId(def?.id || '')) {
    placeBall(args, box, local, xform, bag, ref);
    return;
  }
  const at = placedAt(args);
  if (!at) return;
  const spot = mapLocal(at, box, local === 'relative', xform);
  const meta = spotMeta(ref, own, box, local === 'relative', xform);
  const asset = assetOf(def, String(args.style || bag.style || ''));
  const sourceBox = parsedBox(asset?.viewBox || '');
  const extent = realExtent(asset?.size, sourceBox);
  const givenW = meterOf(args.w, local === 'relative', box[2]);
  const givenH = meterOf(args.h, local === 'relative', box[3]);
  if (isPlayerId(id) || isPlayerId(def?.id || '')) {
    const side = args.team || team || 'blue';
    const fit = givenW !== undefined || givenH !== undefined
      ? Math.min(givenW !== undefined ? givenW / extent.w : Infinity, givenH !== undefined ? givenH / extent.h : Infinity)
      : 1;
    const scale = Number.isFinite(fit) ? Math.max(fit, 0.05) : 1;
    bag.players.push({
      id: `${side}:${idOf(args.name)}`,
      team: side,
      x: spot[0],
      y: spot[1],
      svg: paintPlayer(markupOf(def, String(args.style || bag.style || '')), idOf(args.name), side),
      ux: extent.ux * scale,
      uy: extent.uy * scale,
      radius: playerTokenRadius * extent.ux * scale,
      real: Math.max(extent.w, extent.h) * scale,
      min: resolveMin(bag.host?.sizes, def?.id || id, asset?.size?.min, args.min),
      ...meta
    });
    return;
  }
  const markup = markupOf(def, String(args.style || bag.style || ''));
  if (!markup) return;
  const presetW = num(def?.doc.width, 0);
  const presetH = num(def?.doc.length, 0);
  const widthM = givenW ?? (presetW > 0 ? presetW : (sourceBox ? extent.w : undefined));
  const heightM = givenH ?? (presetH > 0 ? presetH : (sourceBox ? extent.h : undefined));
  const rules = hasStretch(asset?.stretch);
  let svg = markup;
  if (asset && sourceBox && widthM && heightM && (rules || givenW !== undefined || givenH !== undefined)) {
    const drawn = stretchSvg(asset, widthM / extent.ux, heightM / extent.uy);
    svg = rules
      ? `<g data-mold="1" display="none">${markup}</g><g data-ink="1">${drawn.markup}</g>`
      : drawn.markup;
  }
  bag.marks.push({
    svg,
    x: spot[0],
    y: spot[1],
    angle: num(args.angle) + (xform.mirror ? 180 : 0) + (xform.rotate ? 180 : 0),
    title: args.title === undefined ? undefined : String(args.title),
    w: widthM,
    h: heightM,
    box: rules && sourceBox ? sourceBox : undefined,
    stretch: rules ? asset?.stretch : undefined,
    ux: extent.ux,
    uy: extent.uy,
    real: widthM && heightM ? Math.max(widthM, heightM) : undefined,
    min: resolveMin(bag.host?.sizes, def?.id || id, asset?.size?.min, args.min),
    ...meta
  });
  corners.push(spot);
}

interface ZoneInk {
  fill?: string;
  alpha?: number;
  title?: string;
}

function withInk(args: CallArgs, ink: ZoneInk | undefined): CallArgs {
  if (!ink) return args;
  return { ...args, fill: args.fill ?? ink.fill, alpha: args.alpha ?? ink.alpha, title: args.title ?? ink.title };
}

function inkOf(args: CallArgs): ZoneInk | undefined {
  if (args.fill === undefined && args.alpha === undefined && args.title === undefined) return undefined;
  return { fill: args.fill, alpha: args.alpha, title: args.title };
}

/** Un groupe ne se teinte pas : la couleur descend sur ses zones. Sans couleur, le lavis reste le blanc à 0,06. */
function zoneWash(args: CallArgs, group: boolean): { fill: string; alpha: number } {
  const fill = args.fill || '#ffffff';
  if (group) return { fill, alpha: 0 };
  const alpha = args.alpha !== undefined ? args.alpha : (args.fill ? 0.2 : 0.06);
  return { fill, alpha };
}

function placeCall(
  id: string,
  args: CallArgs,
  parent: Box,
  unit: Unit,
  parentXform: Xform,
  mode: 'full' | 'content',
  bag: PlaceBag,
  depth: number,
  ref: string | undefined,
  own: boolean,
  team: string
) {
  if (depth > 8 || !id) return;
  const kind = elementKind(id);
  const local = args.unit || unit;
  if (kind === 'object' || isPlayerId(id) || isBallId(id)) {
    const scene = transformBox(parent, parent, parentXform);
    placePoint(id, args, scene, local, parentXform, bag, ref, own, args.team || team, []);
    return;
  }
  const def = resolveElement(bag.library, id);
  const inset = fillsParent(id);
  const slot = inset ? pitchSlot(bag, def?.doc, args) : null;
  const intrinsic = !inset && def ? sizeOf(def.doc, bag.library, 0) : null;
  const along = slot ? bag.frame : parent;
  const placed = slot
    ? {
        ...args,
        x: typeof args.x === 'number' ? (local === 'relative' ? args.x * bag.frame[2] : args.x) : slot.x,
        y: typeof args.y === 'number' ? (local === 'relative' ? args.y * bag.frame[3] : args.y) : slot.y,
        w: slot.w,
        h: slot.h
      }
    : args;
  const boxes = boxOf(placed, along, slot ? 'meters' : local, intrinsic, inset);
  if (!boxes) return;
  const border = transformBox(boxes.border, along, parentXform);
  const content = transformBox(boxes.content, along, parentXform);
  let xform = compose(parentXform, turnOf(args));
  if (slot?.turn) xform = compose(xform, { mirror: false, rotate: true });
  const group = kind === 'zone' && Boolean(def?.doc.zone?.length);
  if (kind === 'zone' && ((own && ref) || !group)) {
    const wash = zoneWash(args, group);
    bag.zones.push({
      name: args.name === undefined ? '' : String(args.name),
      x: border[0],
      y: border[1],
      w: border[2],
      h: border[3],
      fill: wash.fill,
      alpha: wash.alpha,
      ref: own ? ref : undefined
    });
  }
  if (mode === 'full' && def) {
    emitDrawing(def, String(args.style || def.doc.style || bag.style || ''), border, xform, bag, args.title === undefined ? '' : String(args.title));
    const nested = pitchArgs(def.doc);
    const nestedId = pitchId(nested);
    if (nestedId && nestedId !== id) {
      const folded = compose(xform, turnOf(nested));
      placeCall(nestedId, {
        ...nested,
        x: 0,
        y: 0,
        w: border[2],
        h: border[3],
        unit: 'meters',
        mirror: folded.mirror,
        rotate: folded.rotate ? 180 : 0
      }, border, 'meters', IDENTITY, 'full', bag, depth + 1, undefined, false, team);
    }
  }
  const ink = inkOf(args);
  if (def) {
    placeLists(def.doc, content, inheritedUnit(def.doc), xform, bag, depth + 1, undefined, ref, args.team || team, ink);
  }
  if (own && ref) {
    placeLists(args, content, local, xform, bag, depth + 1, `${ref}/`, undefined, args.team || team, ink);
  }
}

function placeLists(
  doc: { object?: ItemSpec[]; shape?: ItemSpec[]; formation?: ItemSpec[]; zone?: ItemSpec[]; outline?: boolean },
  box: Box,
  unit: Unit,
  xform: Xform,
  bag: PlaceBag,
  depth: number,
  basePath: string | undefined,
  anchor: string | undefined,
  team: string,
  ink?: ZoneInk
) {
  const corners: [number, number][] = [];
  const lists = listsOf(doc);
  for (const genre of GENRES) {
    (lists[genre] || []).forEach((item, index) => {
      const call = callOf(item);
      if (!call) return;
      const painted = applyGeometry(withInk(call.args, ink), bag);
      const id = qualify(genre, call.type);
      const ref = basePath !== undefined ? `${basePath}${genre}/${index}/${call.type}` : anchor;
      const own = basePath !== undefined;
      const kind = elementKind(id);
      if (kind === 'object' || isPlayerId(id) || isBallId(id)) {
        const scene = transformBox(box, box, xform);
        placePoint(id, painted, scene, painted.unit || unit, xform, bag, ref, own, painted.team || team, corners);
        return;
      }
      placeCall(id, painted, box, unit, xform, areaMode(id), bag, depth + 1, ref, own, painted.team || team);
    });
  }
  if (doc.outline && corners.length >= 2) {
    const last = corners.length === 2 ? 1 : corners.length;
    for (let i = 0; i < last; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      bag.lines.push([a[0], a[1], b[0], b[1]]);
    }
  }
}

function placeDocument(doc: SchemaDoc, box: Box, xform: Xform, mode: 'full' | 'content', bag: PlaceBag, depth: number, own: boolean) {
  if (depth > 8) return;
  if (mode === 'full') {
    emitDrawing(entryOf(bag.library, doc), doc.style || bag.style, box, xform, bag);
    const args = pitchArgs(doc);
    const id = pitchId(args);
    if (id) {
      const { margin: _margin, width: _width, length: _length, w: _w, h: _h, x: _x, y: _y, ...rest } = args;
      placeCall(id, { ...rest, x: 0, y: 0, w: box[2], h: box[3], unit: 'meters' }, box, 'meters', xform, 'full', bag, depth + 1, undefined, false, 'blue');
    }
  }
  placeLists(doc, box, inheritedUnit(doc), xform, bag, depth, own ? '' : undefined, undefined, 'blue');
}

function emptyBag(library: Map<string, LibraryEntry>, style: string, frameLength: number): PlaceBag {
  return {
    library,
    style,
    frameLength,
    frame: [0, 0, 0, 0],
    players: [],
    marks: [],
    zones: [],
    lines: [],
    drawings: [],
    ballHolder: { id: '', svg: '', radius: ballRadius, real: ballRadius * 2 }
  };
}

function cornerMarks(width: number, length: number, boundary: string, library: Map<string, LibraryEntry>, style: string): PlacedMark[] {
  if (!boundary) return [];
  let entry: LibraryEntry | undefined;
  for (const item of library.values()) {
    if ((item.id === boundary || item.name === boundary || item.id === qualify('object', boundary)) && item.svgs.length) {
      entry = item;
      break;
    }
  }
  const svg = markupOf(entry, style);
  if (!svg) return [];
  const spots: [number, number][] = [[0, 0], [width, 0], [0, length], [width, length]];
  return spots.map(([x, y]) => ({ svg, x, y }));
}
function matches(player: PlacedPlayer, token: string | number | undefined): boolean {
  const key = idOf(token);
  return player.id === key || player.id.endsWith(`:${key}`);
}

function findPlayer(players: PlacedPlayer[], token: string | number | undefined): PlacedPlayer | undefined {
  return players.find(player => matches(player, token) && player.team === 'blue')
    || players.find(player => matches(player, token));
}

function applyMove(players: PlacedPlayer[], move: MoveSpec) {
  const who = findPlayer(players, move.player);
  const dest = pointOf(move.dribble) || pointOf(move.run);
  if (who && dest) {
    who.x = dest[0];
    who.y = dest[1];
  }
}

function shownRadius(radius: number, real: number | undefined, min: number | undefined, span: number): number {
  return radius * glyphFactor(real ?? radius * 2, min, span);
}

function stretchArrow(library: Map<string, LibraryEntry>, arrow: ArrowMark, span: number, doc: SchemaDoc): ArrowMark {
  const id = `arrow.${arrow.kind}`;
  const asset = assetOf(resolveElement(library, id), '');
  const box = asset ? parsedBox(asset.viewBox) : null;
  const length = Math.hypot(arrow.x2 - arrow.x1, arrow.y2 - arrow.y1);
  if (!asset || !box || length < 0.05) return arrow;
  const extent = realExtent(asset.size, box);
  const factor = glyphFactor(extent.h, resolveMin(doc.sizes, id, asset.size?.min, undefined), span);
  const drawn = stretchSvg(asset, length / (extent.ux * factor), box.h);
  const angle = Math.atan2(arrow.y2 - arrow.y1, arrow.x2 - arrow.x1) * 180 / Math.PI;
  return { ...arrow, svg: drawn.markup, angle, glyph: extent.ux * factor };
}

function arrowsFor(before: PlacedPlayer[], after: PlacedPlayer[], moves: MoveSpec[]): ArrowMark[] {
  const arrows: ArrowMark[] = [];
  for (const move of moves) {
    if (move.dribble || move.run) {
      const from = findPlayer(before, move.player);
      const to = from ? after.find(player => player.id === from.id) : undefined;
      if (from && to) arrows.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, kind: move.dribble ? 'dribble' : 'run' });
    }
    if (move.pass !== undefined && move.from !== undefined) {
      const from = findPlayer(before, move.from);
      const target = typeof move.pass === 'number' || typeof move.pass === 'string' ? null : pointOf(move.pass);
      const mate = typeof move.pass === 'number' || typeof move.pass === 'string'
        ? findPlayer(after, move.pass)
        : null;
      if (from && mate) arrows.push({ x1: from.x, y1: from.y, x2: mate.x, y2: mate.y, kind: 'pass' });
      else if (from && target) arrows.push({ x1: from.x, y1: from.y, x2: target[0], y2: target[1], kind: 'pass' });
    }
  }
  return arrows;
}

export function buildScene(
  doc: SchemaDoc,
  library: Map<string, LibraryEntry>,
  phaseIndex: number,
  progress: number
): Scene {
  const style = doc.style || '';
  const frame = frameSize(doc, library);
  const bag = emptyBag(library, style, frame.length);
  bag.host = doc;
  bag.frame = [0, 0, frame.width, frame.length];
  bag.marks.push(...cornerMarks(frame.width, frame.length, frame.boundary, library, style));
  placeDocument(doc, [0, 0, frame.width, frame.length], IDENTITY, 'full', bag, 0, true);
  const { players, marks, zones } = bag;
  const ballHolder = bag.ballHolder;
  const span = Math.max(frame.width, frame.length);
  const phases = (doc.phases || []).map(phase => ({
    name: phase.name || 'Phase',
    duration: num(phase.duration, 4)
  }));
  const index = phases.length ? Math.max(0, Math.min(phaseIndex, phases.length - 1)) : -1;
  for (let i = 0; i < index; i += 1) {
    for (const move of doc.phases?.[i]?.moves || []) applyMove(players, move);
  }
  let arrows: ArrowMark[] = [];
  const t = Math.max(0, Math.min(progress, 1));
  if (index >= 0) {
    const moves = doc.phases?.[index]?.moves || [];
    const before = players.map(player => ({ ...player }));
    const after = players.map(player => ({ ...player }));
    for (const move of moves) applyMove(after, move);
    for (const player of players) {
      const start = before.find(item => item.id === player.id);
      const end = after.find(item => item.id === player.id);
      if (!start || !end) continue;
      player.x = start.x + (end.x - start.x) * t;
      player.y = start.y + (end.y - start.y) * t;
    }
    arrows = arrowsFor(before, after, moves).map(arrow => stretchArrow(library, arrow, span, doc));
  }
  let ball: Scene['ball'] = null;
  if (ballHolder.id.startsWith('@')) {
    const [x, y] = ballHolder.id.slice(1).split(',').map(Number);
    ball = { x, y, svg: ballHolder.svg, ref: ballHolder.ref, radius: ballHolder.radius, real: ballHolder.real, min: ballHolder.min };
  } else if (ballHolder.id) {
    const carrier = findPlayer(players, ballHolder.id);
    if (carrier) ball = { x: carrier.x, y: carrier.y, svg: ballHolder.svg, ref: ballHolder.ref, radius: ballHolder.radius, real: ballHolder.real, min: ballHolder.min };
  }
  const lastPass = [...arrows].reverse().find(arrow => arrow.kind === 'pass');
  if (lastPass) {
    const passer = players.reduce<{ d: number; player: PlacedPlayer } | null>((best, player) => {
      const d = Math.hypot(player.x - lastPass.x1, player.y - lastPass.y1);
      return !best || d < best.d ? { d, player } : best;
    }, null);
    const gap = shownRadius(passer?.player.radius ?? playerTokenRadius, passer?.player.real, passer?.player.min, span)
      + shownRadius(ballHolder.radius, ballHolder.real, ballHolder.min, span) * 0.4;
    const start = ballBeside(lastPass.x1, lastPass.y1, lastPass.x2, lastPass.y2, gap);
    const end = ballBeside(lastPass.x2, lastPass.y2, lastPass.x1, lastPass.y1, gap);
    ball = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      svg: ballHolder.svg,
      ref: ball?.ref,
      radius: ballHolder.radius,
      real: ballHolder.real,
      min: ballHolder.min
    };
  }
  return {
    width: frame.width,
    length: frame.length,
    margin: frame.margin,
    lines: bag.lines,
    drawing: bag.drawings.join(''),
    zones,
    players,
    marks,
    arrows,
    ball,
    phases
  };
}

const TEAM_COLOR: Record<string, string> = {
  blue: '#2563eb',
  red: '#dc2626',
  white: '#f8fafc',
  yellow: '#ca8a04'
};

/** Le SVG du joueur reçoit son numéro et les couleurs de l’équipe. */
function paintPlayer(markup: string, name: string, team: string): string {
  const fill = TEAM_COLOR[team] || '#334155';
  const ink = team === 'white' || team === 'yellow' ? '#111827' : '#ffffff';
  const face = applyParams(markup, { name, fill, ink });
  return face || `<circle r="${playerTokenRadius}" fill="${fill}" stroke="#ffffff" stroke-width="0.12"/>
    <text text-anchor="middle" y="0.38" font-size="1.1" font-family="sans-serif" fill="${ink}">${esc(name)}</text>`;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(value: string): string {
  return esc(value).replace(/"/g, '&quot;');
}

function pickAttrs(node: { ref?: string; locked?: boolean }, kind: 'player' | 'mark'): string {
  if (!node.ref) return '';
  const drag = node.locked === false
    ? ` data-ref="${escAttr(node.ref)}"${kind === 'mark' ? ' data-handle="1" data-ox="0" data-oy="0"' : ''}`
    : '';
  return ` data-pick="${escAttr(node.ref)}" data-kind="${kind}"${drag}`;
}

/** Parts of `u` (one hundredth of the figure). Chosen so the handles stay the same size on every pitch and remain grabbable when the figure fits the preview. */
export const chrome = {
  pad: 0.5,
  handle: 2.4,
  knob: 2.4,
  knobHit: 3.4,
  knobGap: 0.7,
  knobStroke: 0.35,
  frame: 1.6,
  ring: 1.7,
  ringStroke: 0.8,
  ringPad: 0.35,
  ballRing: 1.6,
  ballPad: 0.3,
  title: 2.8,
  titleGap: 1.2
};

function resizeHandles(x: number, y: number, w: number, h: number, size: number): string {
  const spot = (axis: string, cx: number, cy: number) =>
    `<rect data-resize="${axis}" x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" rx="${(size * 0.2).toFixed(4)}" fill="#ffffff" stroke="#111827" stroke-width="${(size * 0.2).toFixed(4)}" fill-opacity="0" stroke-opacity="0" pointer-events="none"/>`;
  return spot('x', x + w, y + h / 2) + spot('y', x + w / 2, y + h) + spot('xy', x + w, y + h);
}

function markFrame(mark: PlacedMark, u: number, glyph: number): string {
  if (!mark.ref) return '';
  const pad = chrome.pad * u;
  let x: number;
  let y: number;
  let w: number;
  let h: number;
  if (mark.box && mark.w && mark.h) {
    const frame = frameOfSize(mark.box, mark.w, mark.h);
    x = frame.x * glyph - pad;
    y = frame.y * glyph - pad;
    w = frame.w * glyph + pad * 2;
    h = frame.h * glyph + pad * 2;
  } else {
    const box = markExtent(mark.svg);
    const ux = (mark.ux ?? 1) * glyph;
    const uy = (mark.uy ?? 1) * glyph;
    const minX = (box ? box.minX : -0.6) * ux;
    const minY = (box ? box.minY : -0.6) * uy;
    const maxX = (box ? box.maxX : 0.6) * ux;
    const maxY = (box ? box.maxY : 0.6) * uy;
    x = minX - pad;
    y = -maxY - pad;
    w = maxX - minX + pad * 2;
    h = maxY - minY + pad * 2;
  }
  const knobR = chrome.knob * u;
  const knobY = (y + h + knobR + chrome.knobGap * u).toFixed(4);
  const knob = mark.locked === false
    ? `<g data-rotate="1" fill-opacity="0" stroke-opacity="0" pointer-events="none">
        <circle cx="0" cy="${knobY}" r="${(chrome.knobHit * u).toFixed(4)}" fill="transparent"/>
        <circle cx="0" cy="${knobY}" r="${knobR.toFixed(4)}" fill="#fde047" stroke="#111827" stroke-width="${(chrome.knobStroke * u).toFixed(4)}"/>
      </g>`
    : '';
  const handles = mark.box && mark.locked === false ? resizeHandles(x, y, w, h, chrome.handle * u) : '';
  return `<rect data-frame="1" data-pick="${escAttr(mark.ref)}" x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent" stroke="transparent" stroke-width="${(chrome.frame * u).toFixed(4)}"/>${handles}${knob}`;
}

function ring(node: { ref?: string; locked?: boolean; x: number; y: number; ox?: number; oy?: number; sx?: number; sy?: number; relative?: boolean }, kind: 'player' | 'mark', radius: number, u: number): string {
  if (!node.ref || kind !== 'player') return '';
  const handle = node.locked === false
    ? ` data-ref="${escAttr(node.ref)}" data-handle="1" data-ox="${node.ox ?? 0}" data-oy="${node.oy ?? 0}" data-sx="${node.sx ?? 0}" data-sy="${node.sy ?? 0}" data-rel="${node.relative ? 1 : 0}"`
    : '';
  return `<circle data-pick="${escAttr(node.ref)}" data-kind="${kind}"${handle} cx="${node.x}" cy="${node.y}" r="${radius}" fill="transparent" stroke="transparent" stroke-width="${(chrome.ringStroke * u).toFixed(4)}"/>`;
}

function wavy(x1: number, y1: number, x2: number, y2: number): string {
  const steps = 8;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const amp = Math.sin(t * Math.PI * 4) * 0.6;
    d += ` L ${x1 + dx * t + nx * amp} ${y1 + dy * t + ny * amp}`;
  }
  return d;
}

function attrMap(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

function markExtent(svg: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  };
  for (const match of svg.matchAll(/<rect\b([^>]*?)\/?>/gi)) {
    const attrs = attrMap(match[1]);
    const x = num(Number(attrs.x));
    const y = num(Number(attrs.y));
    add(x, y);
    add(x + num(Number(attrs.width)), y + num(Number(attrs.height)));
  }
  for (const match of svg.matchAll(/<(?:polygon|polyline)\b([^>]*?)\/?>/gi)) {
    const points = (attrMap(match[1]).points || '').trim().split(/[\s,]+/).map(Number);
    for (let i = 0; i + 1 < points.length; i += 2) add(points[i], points[i + 1]);
  }
  for (const match of svg.matchAll(/<circle\b([^>]*?)\/?>/gi)) {
    const attrs = attrMap(match[1]);
    const radius = num(Number(attrs.r));
    add(num(Number(attrs.cx)) - radius, num(Number(attrs.cy)) - radius);
    add(num(Number(attrs.cx)) + radius, num(Number(attrs.cy)) + radius);
  }
  for (const match of svg.matchAll(/<ellipse\b([^>]*?)\/?>/gi)) {
    const attrs = attrMap(match[1]);
    const rx = num(Number(attrs.rx));
    const ry = num(Number(attrs.ry));
    add(num(Number(attrs.cx)) - rx, num(Number(attrs.cy)) - ry);
    add(num(Number(attrs.cx)) + rx, num(Number(attrs.cy)) + ry);
  }
  for (const match of svg.matchAll(/<line\b([^>]*?)\/?>/gi)) {
    const attrs = attrMap(match[1]);
    add(num(Number(attrs.x1)), num(Number(attrs.y1)));
    add(num(Number(attrs.x2)), num(Number(attrs.y2)));
  }
  if (!xs.length) return null;
  let stroke = 0;
  for (const match of svg.matchAll(/stroke-width="([\d.]+)"/gi)) stroke = Math.max(stroke, num(Number(match[1])));
  const ink = stroke / 2;
  return { minX: Math.min(...xs) - ink, minY: Math.min(...ys) - ink, maxX: Math.max(...xs) + ink, maxY: Math.max(...ys) + ink };
}

function frameOf(scene: Scene): { left: number; right: number; top: number; bottom: number } {
  const room = scene.margin || 0;
  const gap = room > 0 ? room : 1;
  let left = room;
  let right = room;
  let top = room;
  let bottom = room;
  for (const mark of scene.marks) {
    const box = markExtent(mark.svg);
    if (!box) continue;
    const angle = (mark.angle || 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const [sx, sy] of [[box.minX, box.minY], [box.maxX, box.minY], [box.minX, box.maxY], [box.maxX, box.maxY]] as [number, number][]) {
      const px = sx;
      const py = -sy;
      const x = mark.x + px * cos - py * sin;
      const y = mark.y + px * sin + py * cos;
      left = Math.max(left, gap - x);
      right = Math.max(right, x - scene.width + gap);
      bottom = Math.max(bottom, gap - y);
      top = Math.max(top, y - scene.length + gap);
    }
  }
  return { left, right, top, bottom };
}

/** Forme sans terrain : objets et contour dans le repère du fichier, sans rectangle. */
function piecesScene(doc: SchemaDoc, library: Map<string, LibraryEntry>): Scene {
  const sample = composePieces(doc, library, 1);
  const span = spanOf(sample);
  const reach = reachOf(sample);
  const side = span > 0.001 ? Math.max(1, reach * 3 / span) : Math.max(1, reach * 2);
  const bag = side === 1 ? sample : composePieces(doc, library, side);
  let ball: Scene['ball'] = null;
  if (bag.ballHolder.id.startsWith('@')) {
    const [x, y] = bag.ballHolder.id.slice(1).split(',').map(Number);
    ball = { x, y, svg: bag.ballHolder.svg, radius: bag.ballHolder.radius, real: bag.ballHolder.real, min: bag.ballHolder.min };
  } else if (bag.ballHolder.id) {
    const carrier = findPlayer(bag.players, bag.ballHolder.id);
    if (carrier) ball = { x: carrier.x, y: carrier.y, svg: bag.ballHolder.svg, radius: bag.ballHolder.radius, real: bag.ballHolder.real, min: bag.ballHolder.min };
  }
  return {
    width: side,
    length: side,
    margin: 0,
    lines: bag.lines,
    drawing: bag.drawings.join(''),
    zones: [],
    players: bag.players,
    marks: bag.marks,
    arrows: [],
    ball,
    phases: []
  };
}

function composePieces(doc: SchemaDoc, library: Map<string, LibraryEntry>, side: number): PlaceBag {
  const bag = emptyBag(library, doc.style || '', side);
  bag.host = doc;
  placeLists(doc, [0, 0, side, side], inheritedUnit(doc), IDENTITY, bag, 0, '', undefined, 'blue');
  return bag;
}

function spanOf(bag: PlaceBag): number {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const mark of bag.marks) { xs.push(mark.x); ys.push(mark.y); }
  for (const player of bag.players) { xs.push(player.x); ys.push(player.y); }
  for (const line of bag.lines) {
    if (line.length < 4) continue;
    xs.push(line[0], line[2]);
    ys.push(line[1], line[3]);
  }
  if (xs.length < 2) return 0;
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function reachOf(bag: PlaceBag): number {
  let reach = 0;
  for (const mark of bag.marks) {
    const box = markExtent(mark.svg);
    if (!box) continue;
    reach = Math.max(reach, box.maxX - box.minX, box.maxY - box.minY);
  }
  if (bag.players.length) reach = Math.max(reach, playerTokenRadius * 2);
  return reach;
}

function stripXml(svg: string): string {
  return svg.replace(/<\?xml[\s\S]*?\?>\s*/, '');
}

/** Aperçu d’un élément, selon son identifiant. Le fichier reste la seule copie sur disque. */
export function elementScene(doc: SchemaDoc, library: Map<string, LibraryEntry>, phase = 0, progress = 0, picks = false): string {
  if (doc.type === 'pitch' || doc.type === 'zone' || doc.type === 'formation' || (hasPitch(doc) && !isComposition(doc))) {
    return stripXml(renderSvg(buildScene(doc, library, phase, progress), picks));
  }
  if (isPlayerId(doc.id || '') || isBallId(doc.id || '')) {
    const host: SchemaDoc = {
      version: SCHEMA_VERSION,
      name: 'apercu',
      margin: 0.6,
      pitch: { width: 8, length: 8 },
      object: isPlayerId(doc.id || '')
        ? [{ player: { name: 8, team: 'blue', x: 4, y: 4 } }]
        : [{ ball: { x: 4, y: 4 } }]
    };
    return stripXml(renderSvg(buildScene(host, library, 0, 0)));
  }
  if (isComposition(doc)) {
    const scene = hasPitch(doc) ? buildScene(doc, library, phase, progress) : piecesScene(doc, library);
    return stripXml(renderSvg(scene, picks, hasPitch(doc)));
  }
  const asset = assetOf(entryOf(library, doc), doc.style || '');
  const box = asset ? parsedBox(asset.viewBox) : null;
  const extent = realExtent(asset?.size, box);
  const presetW = num(doc.width, 0);
  const presetH = num(doc.length, 0);
  const drawn = asset && box && (hasStretch(asset.stretch) || presetW > 0 || presetH > 0)
    ? stretchSvg(asset, (presetW > 0 ? presetW : extent.w) / extent.ux, (presetH > 0 ? presetH : extent.h) / extent.uy)
    : null;
  const viewBox = drawn?.viewBox || asset?.viewBox || '-1 -1 2 2';
  const [x, y, w, h] = viewBox.trim().split(/[\s,]+/).map(Number);
  const bg = [x, y, w, h].every(Number.isFinite)
    ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#166534"/>`
    : '';
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${bg}${drawn?.markup || asset?.markup || ''}</svg>`;
}

export function renderSvg(scene: Scene, picks = false, ground = true): string {
  const frame = frameOf(scene);
  const width = scene.width + frame.left + frame.right;
  const height = scene.length + frame.top + frame.bottom;
  const span = Math.max(scene.width, scene.length);
  const u = Math.max(span, 1) / 100;
  const players = scene.players.map(player => {
    const factor = glyphFactor(player.real ?? 0, player.min, span);
    const ux = (player.ux ?? 1) * factor;
    const uy = (player.uy ?? 1) * factor;
    const shown = (player.radius ?? playerTokenRadius) * factor;
    return `<g transform="translate(${player.x} ${player.y})" data-radius="${shown}"${picks ? pickAttrs(player, 'player') : ''}>
      <g transform="scale(${ux} ${-uy})">${player.svg}</g>
    </g>`;
  }).join('');
  const zones = scene.zones.map(zone => {
    const pick = picks && zone.ref ? ` data-zone="${escAttr(zone.ref)}"` : '';
    const hit = zone.ref ? ' pointer-events="all"' : ' pointer-events="none"';
    const fill = escAttr(zone.fill || '#ffffff');
    const alpha = zone.alpha ?? 0.06;
    return `<rect${pick}${hit} x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" fill="${fill}" fill-opacity="${alpha}" stroke="transparent" stroke-width="0.16"/>`;
  }).join('');
  const lineInk = ground ? '#ffffff' : '#111827';
  const lines = scene.lines.filter(line => line.length >= 4).map(line =>
    `<line x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}" stroke="${lineInk}" stroke-width="0.18" fill="none"/>`
  ).join('');
  const drawing = scene.drawing
    ? `<g transform="translate(${frame.left} ${frame.top})">${scene.drawing}</g>`
    : '';
  const marks = scene.marks.map(mark => {
    const angle = mark.angle || 0;
    const factor = glyphFactor(mark.real ?? 0, mark.min, span);
    const frame = picks && mark.ref ? markFrame(mark, u, factor) : '';
    const rules = mark.box
      ? ` data-vx="${mark.box.x}" data-vy="${mark.box.y}" data-vw="${mark.box.w}" data-vh="${mark.box.h}" data-stretch-x="${escAttr(mark.stretch?.x || '')}" data-stretch-y="${escAttr(mark.stretch?.y || '')}" data-mw="${mark.w ?? ''}" data-mh="${mark.h ?? ''}"${mark.relative ? ` data-rel="1" data-sx="${mark.sx ?? 0}" data-sy="${mark.sy ?? 0}"` : ''}`
      : '';
    const shownH = (mark.h || 1) * factor;
    const below = mark.y - shownH / 2 - chrome.titleGap * u;
    const label = mark.title
      ? `<g transform="translate(${mark.x} ${below}) scale(1 -1)"><text text-anchor="middle" font-size="${(chrome.title * u).toFixed(4)}" font-family="sans-serif" fill="#ffffff">${esc(mark.title)}</text></g>`
      : '';
    const ux = (mark.ux ?? 1) * factor;
    const uy = (mark.uy ?? 1) * factor;
    return `<g transform="translate(${mark.x} ${mark.y}) rotate(${angle})" data-x="${mark.x}" data-y="${mark.y}" data-angle="${angle}" data-glyph="${factor}" data-ux="${mark.ux ?? 1}" data-uy="${mark.uy ?? 1}" data-min="${mark.min ?? 0}" data-span="${span}" data-u="${u}"${rules}${picks ? pickAttrs(mark, 'mark') : ''}>
      <g data-draw="1" transform="scale(${ux} ${-uy})">${mark.svg}</g>${frame}
    </g>${label}`;
  }).join('');
  const arrows = scene.arrows.map(arrow => {
    const factor = arrow.glyph || 1;
    if (arrow.svg) {
      return `<g transform="translate(${arrow.x1} ${arrow.y1}) rotate(${arrow.angle || 0}) scale(${factor})"><g transform="scale(1 -1)">${arrow.svg}</g></g>`;
    }
    const ink = (0.22 * factor).toFixed(4);
    if (arrow.kind === 'dribble') {
      return `<path d="${wavy(arrow.x1, arrow.y1, arrow.x2, arrow.y2)}" fill="none" stroke="#111827" stroke-width="${ink}"/>`;
    }
    const dash = arrow.kind === 'run' ? ` stroke-dasharray="${(0.7 * factor).toFixed(4)} ${(0.45 * factor).toFixed(4)}"` : '';
    return `<line x1="${arrow.x1}" y1="${arrow.y1}" x2="${arrow.x2}" y2="${arrow.y2}" stroke="#111827" stroke-width="${ink}"${dash} marker-end="url(#arrow)"/>`;
  }).join('');
  const ballFactor = scene.ball ? glyphFactor(scene.ball.real ?? 0, scene.ball.min, span) : 1;
  const ballRadiusShown = scene.ball ? (scene.ball.radius ?? ballRadius) * ballFactor : ballRadius;
  const ball = scene.ball ? ballMarkup(scene.ball.x, scene.ball.y, picks, scene.ball.svg, ballRadiusShown) : '';
  const ballRing = picks && scene.ball?.ref
    ? `<circle data-pick="${escAttr(scene.ball.ref)}" data-kind="player" cx="${scene.ball.x}" cy="${scene.ball.y}" r="${Math.max(chrome.ballRing * u, ballRadiusShown + chrome.ballPad * u)}" fill="transparent" stroke="transparent" stroke-width="${(chrome.ringStroke * u).toFixed(4)}"/>`
    : '';
  const rings = picks ? scene.players.map(node => {
    const shown = (node.radius ?? playerTokenRadius) * glyphFactor(node.real ?? 0, node.min, span);
    return ring(node, 'player', Math.max(chrome.ring * u, shown + chrome.ringPad * u), u);
  }).join('') : '';
  const meta = picks ? ` data-left="${frame.left}" data-top="${frame.top}" data-length="${scene.length}"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%"${meta}>
  <defs>
    <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M 0 0 L 6 3 L 0 6 z" fill="#111827"/>
    </marker>
  </defs>
  ${ground ? `<rect width="${width}" height="${height}" fill="#166534"/>` : ''}
  <g transform="translate(${frame.left} ${frame.top + scene.length}) scale(1 -1)">
    ${ground ? `<rect x="0" y="0" width="${scene.width}" height="${scene.length}" fill="#2b6b39"/>` : ''}
    ${lines}
  </g>
  ${drawing}
  <g transform="translate(${frame.left} ${frame.top + scene.length}) scale(1 -1)">
    ${zones}
    ${marks}
    ${arrows}
    ${players}
    ${ball}
    ${ballRing}
    ${rings}
  </g>
</svg>`;
}
