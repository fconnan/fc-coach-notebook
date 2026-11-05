import { isMap, isScalar, isSeq, parseDocument, type YAMLMap } from 'yaml';

function pathOf(ref: string): (string | number)[] {
  return ref.split('/').map(part => (/^\d+$/.test(part) ? Number(part) : part));
}

/** Descend dans la valeur quand l’item n’a qu’une clé, le type. */
function argsOf(node: unknown): unknown {
  if (!isMap(node) || node.items.length !== 1) return node;
  if (node.has('x') || node.has('y') || node.has('pos') || node.has('at') || node.has('angle') || node.has('name')) return node;
  const value = node.items[0]?.value;
  return isMap(value) ? value : node;
}

function round(value: number): string {
  const n = Math.round(value * 1000) / 1000;
  return String(Object.is(n, -0) ? 0 : n);
}

function scalarRange(node: unknown): [number, number] | null {
  if (!isScalar(node) || !node.range) return null;
  return [node.range[0], node.range[1]];
}

function splice(source: string, edits: { start: number; end: number; text: string }[]): string {
  let next = source;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
  }
  return next;
}

function writePair(source: string, map: YAMLMap, x: number, y: number): string | null {
  const xs = scalarRange(map.get('x', true));
  const ys = scalarRange(map.get('y', true));
  if (!xs || !ys) return null;
  return splice(source, [
    { start: xs[0], end: xs[1], text: round(x) },
    { start: ys[0], end: ys[1], text: round(y) }
  ]);
}

/** Remplace les coordonnées de l’item, sans reformater le reste du document. */
export function movePoint(source: string, ref: string, x: number, y: number): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = argsOf(doc.getIn(pathOf(ref), true));
  if (!isMap(node)) return source;
  const pos = node.get('pos', true);
  if (isMap(pos)) {
    const next = writePair(source, pos, x, y);
    if (next) return next;
  }
  if (node.has('x') && node.has('y')) {
    const next = writePair(source, node, x, y);
    if (next) return next;
  }
  const at = node.get('at', true);
  if (isMap(at)) {
    const next = writePair(source, at, x, y);
    if (next) return next;
  }
  if (isSeq(at) && at.items.length >= 2) {
    const xs = scalarRange(at.items[0]);
    const ys = scalarRange(at.items[1]);
    if (xs && ys) {
      return splice(source, [
        { start: xs[0], end: xs[1], text: round(x) },
        { start: ys[0], end: ys[1], text: round(y) }
      ]);
    }
  }
  return source;
}

function startOf(node: unknown): number | null {
  if (!node || typeof node !== 'object' || !('range' in node) || !Array.isArray(node.range)) return null;
  return typeof node.range[0] === 'number' ? node.range[0] : null;
}

/** Écrit une valeur numérique de l’item, sans reformater le reste du document. */
function writeScalar(source: string, ref: string, key: string, value: number): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = argsOf(doc.getIn(pathOf(ref), true));
  if (!isMap(node) || !node.range) return source;
  const text = round(value);
  const existing = scalarRange(node.get(key, true));
  if (existing) return splice(source, [{ start: existing[0], end: existing[1], text }]);
  const end = node.range[1];
  if (source[end - 1] === '}') {
    let at = end - 1;
    while (at > node.range[0] && /\s/.test(source[at - 1])) at -= 1;
    return source.slice(0, at) + `, ${key}: ${text} ` + source.slice(end - 1);
  }
  const indent = source.slice(node.range[0], end).match(/\n([ \t]+)\S/)?.[1] ?? '  ';
  const at = source[end - 1] === '\n' ? end - 1 : end;
  return source.slice(0, at) + `\n${indent}${key}: ${text}` + source.slice(at);
}

/** Écrit l’angle de l’item, en degrés, sans reformater le reste du document. */
export function setAngle(source: string, ref: string, angle: number): string {
  return writeScalar(source, ref, 'angle', angle);
}

/** Écrit la taille de l’item. Une valeur nulle laisse l’axe inchangé. */
export function setSize(source: string, ref: string, w: number | null, h: number | null): string {
  let next = source;
  if (w != null) next = writeScalar(next, ref, 'w', w);
  if (h != null) next = writeScalar(next, ref, 'h', h);
  return next;
}

/** Position du curseur : l’abscisse de l’item, sinon le début de l’item. */
export function itemOffset(source: string, ref: string): number | null {
  const doc = parseDocument(source);
  if (doc.errors.length) return null;
  const node = argsOf(doc.getIn(pathOf(ref), true));
  if (!isMap(node)) return startOf(node);
  const pos = node.get('pos', true);
  const x = isMap(pos) ? pos.get('x', true) : node.has('x') ? node.get('x', true) : null;
  return startOf(x) ?? startOf(node);
}

function nodeSpan(node: unknown): [number, number] | null {
  if (!node || typeof node !== 'object' || !('range' in node) || !Array.isArray(node.range)) return null;
  const [start, , end] = node.range as number[];
  return typeof start === 'number' && typeof end === 'number' ? [start, end] : null;
}

/** Étend le début jusqu’au tiret de liste, sans remonter à la ligne précédente. */
function withDash(source: string, start: number): number {
  let at = start;
  while (at > 0 && (source[at - 1] === ' ' || source[at - 1] === '\t')) at -= 1;
  if (at > 0 && source[at - 1] === '-') at -= 1;
  while (at > 0 && (source[at - 1] === ' ' || source[at - 1] === '\t')) at -= 1;
  return at;
}

const GENRES = ['object', 'shape', 'formation', 'zone'];

/** Référence de l’élément sous le curseur. */
export function itemAt(source: string, offset: number): string {
  const doc = parseDocument(source);
  if (doc.errors.length || !isMap(doc.contents)) return '';
  const spans: { ref: string; start: number; end: number }[] = [];
  const add = (node: unknown, ref: string) => {
    const span = nodeSpan(node);
    if (span) spans.push({ ref, start: withDash(source, span[0]), end: span[1] });
  };
  const walkList = (items: unknown, path: string, genre: string) => {
    if (!isSeq(items)) return;
    items.items.forEach((item, index) => {
      if (!isMap(item) || item.items.length !== 1 || !isScalar(item.items[0]?.key)) return;
      const type = String(item.items[0].key.value ?? '');
      if (!type) return;
      const ref = `${path}${genre}/${index}/${type}`;
      add(item, ref);
      const value = item.items[0]?.value;
      if (!isMap(value)) return;
      for (const nested of GENRES) walkList(value.get(nested, true), `${ref}/`, nested);
    });
  };
  for (const genre of GENRES) walkList(doc.contents.get(genre, true), '', genre);
  const inside = spans.filter(span => offset >= span.start && offset < span.end);
  const hits = inside.length ? inside : spans.filter(span => span.end === offset);
  let best = '';
  let size = Infinity;
  for (const span of hits) {
    const width = span.end - span.start;
    if (width < size) {
      best = span.ref;
      size = width;
    }
  }
  return best;
}
