import { isMap, isScalar, isSeq, parseDocument, type YAMLMap } from 'yaml';

function pathOf(ref: string): (string | number)[] {
  return ref.split('/').map(part => (/^\d+$/.test(part) ? Number(part) : part));
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
  const node = doc.getIn(pathOf(ref), true);
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

/** Écrit l’angle de l’item, en degrés, sans reformater le reste du document. */
export function setAngle(source: string, ref: string, angle: number): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = doc.getIn(pathOf(ref), true);
  if (!isMap(node) || !node.range) return source;
  const text = round(angle);
  const existing = scalarRange(node.get('angle', true));
  if (existing) return splice(source, [{ start: existing[0], end: existing[1], text }]);
  const end = node.range[1];
  if (source[end - 1] === '}') {
    let at = end - 1;
    while (at > node.range[0] && /\s/.test(source[at - 1])) at -= 1;
    return source.slice(0, at) + `, angle: ${text} ` + source.slice(end - 1);
  }
  const indent = source.slice(node.range[0], end).match(/\n([ \t]+)\S/)?.[1] ?? '  ';
  const at = source[end - 1] === '\n' ? end - 1 : end;
  return source.slice(0, at) + `\n${indent}angle: ${text}` + source.slice(at);
}

/** Position du curseur : l’abscisse de l’item, sinon le début de l’item. */
export function itemOffset(source: string, ref: string): number | null {
  const doc = parseDocument(source);
  if (doc.errors.length) return null;
  const node = doc.getIn(pathOf(ref), true);
  if (!isMap(node)) return startOf(node);
  const pos = node.get('pos', true);
  const x = isMap(pos) ? pos.get('x', true) : node.has('x') ? node.get('x', true) : null;
  return startOf(x) ?? startOf(node);
}
