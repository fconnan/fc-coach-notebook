import { curvePath } from '$lib/trajectory';
import { parseDocument } from 'yaml';
import { genreHits, plainItems } from './items';
import { readSchema } from './layout';
import { callOf, isArrowId, isBallId, isPlayerId } from './scene';
import { isSvgTag } from './svgShape';
import { formatSchema } from './format';
import type { LibraryEntry, SchemaDoc } from './types';

export function inFolder(entries: LibraryEntry[], dir: string): LibraryEntry[] {
  const prefix = dir.replace(/\/$/, '');
  return entries
    .filter(entry => entry.dir === prefix || entry.dir.startsWith(`${prefix}/`))
    .filter(entry => /\.ya?ml$/i.test(entry.file))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Éléments dont le fichier est directement dans ce dossier. */
export function folderEntries(entries: LibraryEntry[], dir: string): LibraryEntry[] {
  const prefix = dir.replace(/\/$/, '');
  return entries
    .filter(entry => entry.dir === prefix && /\.ya?ml$/i.test(entry.file) && entry.doc.listed !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Premier segment de chemin sous le dossier. */
export function childFolders(entries: LibraryEntry[], dir: string): string[] {
  const prefix = dir.replace(/\/$/, '');
  const names = new Set<string>();
  for (const entry of entries) {
    if (!entry.dir.startsWith(`${prefix}/`)) continue;
    const rest = entry.dir.slice(prefix.length + 1);
    const next = rest.split('/')[0];
    if (next) names.add(next);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
}

function placedPitch(doc: SchemaDoc): { name: string; width: number; length: number } {
  for (const item of plainItems(doc.items)) {
    const call = callOf(item);
    if (call?.type !== 'pitch') continue;
    return {
      name: call.args.name !== undefined ? String(call.args.name) : '',
      width: Number(call.args.width) || 0,
      length: Number(call.args.length) || 0
    };
  }
  return { name: '', width: 0, length: 0 };
}

export function pitchOfSource(source: string): string {
  try {
    const name = placedPitch(readSchema(source)).name;
    if (!name) return '';
    return name.includes('.') ? name : `pitch.${name}`;
  } catch {
    return '';
  }
}

function rewrite(source: string, change: (doc: ReturnType<typeof parseDocument>) => void): string {
  const doc = parseDocument(source);
  if (doc.errors.length) throw new Error('YAML illisible');
  change(doc);
  let next = doc.toString({ collectionStyle: 'any', lineWidth: 0 });
  if (!next.endsWith('\n')) next += '\n';
  return formatSchema(next);
}

function ensureList(doc: ReturnType<typeof parseDocument>, key: string) {
  if (!doc.has(key)) doc.set(key, doc.createNode([]));
}

function composition(entry: LibraryEntry): boolean {
  const doc = entry.doc;
  if (entry.type === 'pitch' || isPlayerId(entry.id) || isBallId(entry.id) || isArrowId(entry.id)) return false;
  if (entry.type === 'formation' || entry.type === 'zone' || entry.type === 'shape') return true;
  return Boolean(genreHits(doc).length || doc.outline);
}

function pitchCenter(source: string, library: LibraryEntry[]): { x: number; y: number } {
  let doc: SchemaDoc = {};
  try { doc = readSchema(source); } catch { /* centre par défaut */ }
  const placed = placedPitch(doc);
  const id = placed.name.includes('.') || !placed.name ? placed.name : `pitch.${placed.name}`;
  const known = id ? library.find(entry => entry.id === id)?.doc : undefined;
  const width = known?.width || placed.width;
  const length = known?.length || placed.length;
  const count = doc.items?.length || 0;
  const shift = ((count % 4) - 1.5) * 3;
  if (!width || !length) {
    return { x: Math.round(shift * 100) / 100, y: 0 };
  }
  return {
    x: Math.round((width / 2 + shift) * 100) / 100,
    y: Math.round((length / 2) * 100) / 100
  };
}

function dropAt(source: string, library: LibraryEntry[], view?: { x: number; y: number } | null): { x: number; y: number } {
  if (view && Number.isFinite(view.x) && Number.isFinite(view.y)) {
    return {
      x: Math.round(view.x * 100) / 100,
      y: Math.round(view.y * 100) / 100
    };
  }
  return pitchCenter(source, library);
}

function nextPlayer(source: string): number {
  let doc: SchemaDoc = {};
  try { doc = readSchema(source); } catch { /* 1 */ }
  const used = new Set<number>();
  const walk = (node: { items?: SchemaDoc['items']; zone?: SchemaDoc['items']; formation?: SchemaDoc['items']; shape?: SchemaDoc['items'] } | undefined) => {
    if (!node) return;
    for (const hit of genreHits(node)) {
      const player = hit.item.player;
      const name = typeof player === 'object' && player ? player.name : player;
      const number = typeof name === 'number' ? name : Number(name);
      if (Number.isInteger(number)) used.add(number);
      const call = callOf(hit.item);
      if (call) walk(call.args);
    }
  };
  walk(doc);
  let number = 1;
  while (used.has(number)) number += 1;
  return number;
}

function meters(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Géométrie d’un tracé, en mètres. `x`/`y` est le centre. `span` est le petit côté visible. */
function shapeBody(kind: string, x: number, y: number, viewSpan = 0): Record<string, unknown> {
  const seen = viewSpan > 0 ? viewSpan : 10;
  const span = meters(seen * 0.12);
  const sw = meters(span / 30);
  const cx = meters(x);
  const cy = meters(y);
  const ink = { fill: '#f59e0b', stroke: '#b45309', 'stroke-width': sw };
  const line = { fill: 'none', stroke: '#ffffff', 'stroke-width': sw };
  if (kind === 'circle') return { x: cx, y: cy, r: meters(span / 2), ...ink };
  if (kind === 'ellipse') return { x: cx, y: cy, rx: meters(span / 2), ry: meters(span * 0.32), ...line, ...ink };
  if (kind === 'line') return { x1: meters(cx - span / 2), y1: cy, x2: meters(cx + span / 2), y2: cy, ...line };
  if (kind === 'polyline') return { points: `${meters(cx - span / 2)},${cy} ${meters(cx + span / 2)},${cy}`, ...line };
  if (kind === 'polygon') {
    const points = [[cx, meters(cy - span / 2)], [meters(cx + span / 2), meters(cy + span * 0.35)], [meters(cx - span / 2), meters(cy + span * 0.35)]]
      .map(pair => pair.join(','))
      .join(' ');
    return { points, ...ink };
  }
  if (kind === 'path') {
    return {
      d: curvePath([
        { x: meters(cx - span / 2), y: cy },
        { x: cx, y: meters(cy + span * 0.45) },
        { x: meters(cx + span / 2), y: cy }
      ]),
      curve: 'smooth',
      ...line
    };
  }
  return { x: cx, y: cy, width: span, height: meters(span * 0.7), ...ink };
}

function placedKey(): string {
  return 'items';
}

/** Insère un tracé SVG dans `items`, au centre de la zone affichée. */
export function insertShape(
  source: string,
  kind: string,
  library: LibraryEntry[],
  view?: { x: number; y: number; span?: number } | null
): string {
  if (!isSvgTag(kind)) throw new Error('forme inconnue');
  const at = dropAt(source, library, view);
  const body = shapeBody(kind, at.x, at.y, view?.span || 0);
  return rewrite(source, doc => {
    const key = placedKey();
    ensureList(doc, key);
    doc.addIn([key], { [kind]: body });
  });
}

/** L’unique appel sans position : la base, avec ses arguments. */
function inheritedCall(entry: LibraryEntry): { type: string; args: Record<string, unknown> } | null {
  const items = entry.doc.items || [];
  if (items.length !== 1 || !items[0] || typeof items[0] !== 'object') return null;
  const keys = Object.keys(items[0]);
  if (keys.length !== 1 || keys[0].includes('=')) return null;
  const value = items[0][keys[0]];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const args = value as Record<string, unknown>;
  if (args.x !== undefined || args.y !== undefined || args.p !== undefined) return null;
  return { type: keys[0], args };
}

/** Insère l’élément choisi. Un objet se pose au centre de la zone affichée. */
export function insertElement(
  source: string,
  entry: LibraryEntry,
  library: LibraryEntry[],
  view?: { x: number; y: number } | null
): string {
  if (entry.type === 'pitch') {
    return rewrite(source, doc => {
      const key = placedKey();
      ensureList(doc, key);
      doc.addIn([key], { pitch: entry.name });
    });
  }
  const genre = entry.type === 'formation' || entry.type === 'zone' || entry.type === 'shape' ? entry.type : 'object';
  if (composition(entry)) {
    return rewrite(source, doc => {
      const key = placedKey();
      ensureList(doc, key);
      const body = genre === 'object' ? { [entry.name]: {} } : { [genre]: { [entry.name]: {} } };
      doc.addIn([key], body);
    });
  }
  const at = dropAt(source, library, view);
  if (isPlayerId(entry.id)) {
    const name = nextPlayer(source);
    const link = inheritedCall(entry);
    const body: Record<string, unknown> = { name, x: at.x, y: at.y };
    for (const [key, value] of Object.entries(link?.args || {})) {
      if (typeof value === 'string' || typeof value === 'number') body[key] = value;
    }
    return rewrite(source, doc => {
      const key = placedKey();
      ensureList(doc, key);
      doc.addIn([key], { [link?.type || 'player']: body });
    });
  }
  if (isArrowId(entry.id)) {
    return rewrite(source, doc => {
      const key = placedKey();
      ensureList(doc, key);
      doc.addIn([key], { [entry.name]: { p: { x: at.x, y: at.y }, to: { x: at.x + 3, y: at.y } } });
    });
  }
  const args: Record<string, unknown> = { x: at.x, y: at.y };
  return rewrite(source, doc => {
    const key = placedKey();
    ensureList(doc, key);
    doc.addIn([key], { [entry.name]: args });
  });
}

export function libraryIcon(entry: LibraryEntry): string {
  return (entry.doc.preview || '').replace(/<\?xml[\s\S]*?\?>/g, '').trim();
}