import { curvePath } from '$lib/trajectory';
import { parse, parseDocument } from 'yaml';
import { isArrowId, isBallId, isPlayerId } from './scene';
import { isSvgTag } from './svgShape';
import { formatSchema } from './format';
import type { LibraryEntry, SchemaDoc } from './types';

export function inFolder(entries: LibraryEntry[], dir: string): LibraryEntry[] {
  const prefix = dir.replace(/\/$/, '');
  return entries
    .filter(entry => entry.dir === prefix || entry.dir.startsWith(`${prefix}/`))
    .filter(entry => /\.(ya?ml|svg)$/i.test(entry.file))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Éléments dont le fichier est directement dans ce dossier. */
export function folderEntries(entries: LibraryEntry[], dir: string): LibraryEntry[] {
  const prefix = dir.replace(/\/$/, '');
  return entries
    .filter(entry => entry.dir === prefix && /\.(ya?ml|svg)$/i.test(entry.file))
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

export function pitchOfSource(source: string): string {
  try {
    const doc = parse(source) as SchemaDoc;
    const name = typeof doc?.pitch === 'string' || typeof doc?.pitch === 'number'
      ? String(doc.pitch)
      : doc?.pitch?.name !== undefined ? String(doc.pitch.name) : '';
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
  return Boolean(doc.object?.length || doc.shape?.length || doc.formation?.length || doc.zone?.length || doc.outline);
}

function pitchCenter(source: string, library: LibraryEntry[]): { x: number; y: number } {
  let doc: SchemaDoc = {};
  try { doc = parse(source) as SchemaDoc; } catch { /* centre par défaut */ }
  const raw = typeof doc.pitch === 'string' ? doc.pitch : doc.pitch?.name !== undefined ? String(doc.pitch.name) : '';
  const id = raw.includes('.') || !raw ? raw : `pitch.${raw}`;
  const known = id ? library.find(entry => entry.id === id)?.doc : undefined;
  const width = known?.width || (typeof doc.pitch === 'object' ? Number(doc.pitch?.width) || 0 : 0);
  const length = known?.length || (typeof doc.pitch === 'object' ? Number(doc.pitch?.length) || 0 : 0);
  const count = (doc.object?.length || 0) + (doc.shape?.length || 0) + (doc.formation?.length || 0);
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
  try { doc = parse(source) as SchemaDoc; } catch { /* 1 */ }
  const used = new Set<number>();
  const visit = (items: SchemaDoc['object']) => {
    for (const item of items || []) {
      const player = item.player;
      const name = typeof player === 'object' && player ? player.name : player;
      const number = typeof name === 'number' ? name : Number(name);
      if (Number.isInteger(number)) used.add(number);
    }
  };
  const walk = (node: { object?: SchemaDoc['object']; zone?: SchemaDoc['zone']; formation?: SchemaDoc['formation']; shape?: SchemaDoc['shape'] } | undefined) => {
    if (!node) return;
    visit(node.object);
    for (const list of [node.zone, node.formation, node.shape]) {
      for (const item of list || []) {
        const value = Object.values(item)[0];
        if (value && typeof value === 'object') walk(value);
      }
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

/** Géométrie d’un tracé, en mètres, centrée sur le point. */
function shapeBody(kind: string, x: number, y: number): Record<string, unknown> {
  const span = 1.2;
  const sw = 0.04;
  const cx = meters(x);
  const cy = meters(y);
  const ink = { fill: '#f59e0b', stroke: '#b45309', 'stroke-width': sw };
  const line = { fill: 'none', stroke: '#ffffff', 'stroke-width': sw };
  if (kind === 'circle') return { cx, cy, r: meters(span / 2), ...ink };
  if (kind === 'ellipse') return { cx, cy, rx: meters(span / 2), ry: meters(span * 0.32), ...line, ...ink };
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
  return { x: meters(cx - span / 2), y: meters(cy - span * 0.35), width: span, height: meters(span * 0.7), ...ink };
}

/** Insère un tracé SVG dans `object`, au centre de la zone affichée. */
export function insertShape(
  source: string,
  kind: string,
  library: LibraryEntry[],
  view?: { x: number; y: number } | null
): string {
  if (!isSvgTag(kind)) throw new Error('forme inconnue');
  const at = dropAt(source, library, view);
  const body = shapeBody(kind, at.x, at.y);
  return rewrite(source, doc => {
    ensureList(doc, 'object');
    doc.addIn(['object'], { [kind]: body });
  });
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
      doc.set('pitch', entry.name);
    });
  }
  const genre = entry.type === 'formation' || entry.type === 'zone' || entry.type === 'shape' ? entry.type : 'object';
  if (composition(entry)) {
    return rewrite(source, doc => {
      ensureList(doc, genre);
      doc.addIn([genre], { [entry.name]: {} });
    });
  }
  const at = dropAt(source, library, view);
  if (isPlayerId(entry.id)) {
    const name = nextPlayer(source);
    const team = entry.id.startsWith('player.') ? entry.id.slice('player.'.length) : 'blue';
    return rewrite(source, doc => {
      ensureList(doc, 'object');
      doc.addIn(['object'], { player: { name, team, x: at.x, y: at.y } });
    });
  }
  if (isArrowId(entry.id)) {
    return rewrite(source, doc => {
      ensureList(doc, 'object');
      doc.addIn(['object'], { [entry.id]: { p: { x: at.x, y: at.y }, to: { x: at.x + 3, y: at.y } } });
    });
  }
  const args: Record<string, unknown> = { x: at.x, y: at.y };
  return rewrite(source, doc => {
    ensureList(doc, 'object');
    doc.addIn(['object'], { [entry.name]: args });
  });
}

export function libraryIcon(entry: LibraryEntry): string {
  return (entry.doc.preview || '').replace(/<\?xml[\s\S]*?\?>/g, '').trim();
}
