import { isMap, isScalar, isSeq, parseDocument, type Document, type YAMLMap, type YAMLSeq } from 'yaml';
import { isWrapperKey } from './items';
import { isSvgTag, svgAttrsFromYaml, yamlAttrsFromSvg } from './svgShape';

function pathOf(ref: string): (string | number)[] {
  return ref.split('/').map(part => (/^\d+$/.test(part) ? Number(part) : part));
}

/** `trajectory` reste le chemin d’édition. Dans le fichier, il est une entrée de `settings`. */
function storedPath(doc: Document, ref: string): (string | number)[] {
  const parts = pathOf(ref);
  if (parts[0] !== 'trajectory' || !isMap(doc.contents)) return parts;
  const settings = doc.contents.get('settings', true);
  if (!isSeq(settings)) return parts;
  const index = settings.items.findIndex(item => isMap(item) && item.has('trajectory'));
  if (index < 0) return parts;
  return ['settings', index, ...parts];
}

function nodeAt(doc: Document, ref: string) {
  return doc.getIn(storedPath(doc, ref), true);
}

function listAddress(path: (string | number)[]): { seq: (string | number)[]; index: number } | null {
  if (path.length >= 4 && typeof path.at(-3) === 'number' && isWrapperKey(String(path.at(-2)))) {
    return { seq: path.slice(0, -3), index: path.at(-3) as number };
  }
  if (path.length >= 2 && typeof path.at(-2) === 'number') {
    return { seq: path.slice(0, -2), index: path.at(-2) as number };
  }
  return null;
}

/** Descend dans la valeur quand l’item n’a qu’une clé, le type. */
function argsOf(node: unknown): unknown {
  if (!isMap(node) || node.items.length !== 1) return node;
  if (node.has('x') || node.has('y') || node.has('p') || node.has('pos') || node.has('at') || node.has('angle') || node.has('name')) return node;
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

type Edit = { start: number; end: number; text: string };

function readNum(node: unknown): number | null {
  if (!isScalar(node)) return null;
  const value = typeof node.value === 'number' ? node.value : Number(node.value);
  return Number.isFinite(value) ? value : null;
}

function pairSet(map: YAMLMap, x: number, y: number): Edit[] | null {
  const xs = scalarRange(map.get('x', true));
  const ys = scalarRange(map.get('y', true));
  if (!xs || !ys) return null;
  return [
    { start: xs[0], end: xs[1], text: round(x) },
    { start: ys[0], end: ys[1], text: round(y) }
  ];
}

function pairDelta(map: YAMLMap, dx: number, dy: number): Edit[] | null {
  const x = readNum(map.get('x', true));
  const y = readNum(map.get('y', true));
  if (x == null || y == null) return null;
  return pairSet(map, x + dx, y + dy);
}

function seqSet(seq: YAMLSeq, x: number, y: number): Edit[] | null {
  if (seq.items.length < 2) return null;
  const xs = scalarRange(seq.items[0]);
  const ys = scalarRange(seq.items[1]);
  if (!xs || !ys) return null;
  return [
    { start: xs[0], end: xs[1], text: round(x) },
    { start: ys[0], end: ys[1], text: round(y) }
  ];
}

function seqDelta(seq: YAMLSeq, dx: number, dy: number): Edit[] | null {
  const x = readNum(seq.items[0]);
  const y = readNum(seq.items[1]);
  if (x == null || y == null) return null;
  return seqSet(seq, x + dx, y + dy);
}

function pointEdits(node: unknown, x: number, y: number, delta: boolean): Edit[] | null {
  const apply = (target: unknown): Edit[] | null => {
    if (isMap(target)) return delta ? pairDelta(target, x, y) : pairSet(target, x, y);
    if (isSeq(target)) return delta ? seqDelta(target, x, y) : seqSet(target, x, y);
    return null;
  };
  if (!isMap(node)) return null;
  const spots: unknown[] = [];
  const start = node.get('p', true) || node.get('pos', true);
  const end = node.get('to', true);
  const via = node.get('via', true);
  if (delta) {
    if (start) spots.push(start);
    if (end) spots.push(end);
    if (isSeq(via)) spots.push(...via.items);
  } else if (start) {
    spots.push(start);
  }
  const edits: Edit[] = [];
  for (const spot of spots) {
    const found = apply(spot);
    if (found) edits.push(...found);
  }
  if (edits.length) return edits;
  if (node.has('x') && node.has('y')) {
    const found = apply(node);
    if (found) return found;
  }
  const at = node.get('at', true);
  return apply(at);
}

function writePair(source: string, map: YAMLMap, x: number, y: number): string | null {
  const edits = pairSet(map, x, y);
  return edits ? splice(source, edits) : null;
}

/** Remplace les coordonnées de l’item, sans reformater le reste du document. */
export function movePoint(source: string, ref: string, x: number, y: number): string {
  return relocate(source, [{ ref, x, y }], []);
}

/** Déplace plusieurs items d’un coup. `moves` pose une position, `slides` translate tout le tracé (départ, arrivée, passages). */
export function relocate(
  source: string,
  moves: { ref: string; x: number; y: number }[],
  slides: { ref: string; dx: number; dy: number }[]
): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const edits: Edit[] = [];
  const missing: { ref: string; x: number; y: number }[] = [];
  for (const move of moves) {
    const node = argsOf(nodeAt(doc, move.ref));
    const found = pointEdits(node, move.x, move.y, false);
    if (found) edits.push(...found);
    else if (isMap(node) && !node.has('p') && !node.has('pos') && !node.has('at') && !node.has('to')) missing.push(move);
  }
  for (const slide of slides) {
    const found = pointEdits(argsOf(nodeAt(doc, slide.ref)), slide.dx, slide.dy, true);
    if (found) edits.push(...found);
  }
  let next = edits.length ? splice(source, edits) : source;
  for (const move of missing) {
    next = writeToken(next, move.ref, 'x', round(move.x));
    next = writeToken(next, move.ref, 'y', round(move.y));
  }
  return next;
}

export type KnotRole = 'start' | 'via' | 'end';

function writePointNode(source: string, node: unknown, x: number, y: number): string | null {
  if (isMap(node)) return writePair(source, node, x, y);
  if (isSeq(node) && node.items.length >= 2) {
    const xs = scalarRange(node.items[0]);
    const ys = scalarRange(node.items[1]);
    if (!xs || !ys) return null;
    return splice(source, [
      { start: xs[0], end: xs[1], text: round(x) },
      { start: ys[0], end: ys[1], text: round(y) }
    ]);
  }
  return null;
}

/** Déplace un point du tracé : départ `p`, arrivée `to` ou `x`/`y`, passage `via`. */
export function moveKnot(source: string, ref: string, role: KnotRole, index: number, x: number, y: number): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = argsOf(nodeAt(doc, ref));
  if (isSeq(node)) return role === 'end' ? writePointNode(source, node, x, y) ?? source : source;
  if (!isMap(node)) return source;
  if (role === 'start') {
    const point = node.get('p', true);
    if (isMap(point) || isSeq(point)) return writePointNode(source, point, x, y) ?? source;
    if (node.has('x') && node.has('y')) return writePointNode(source, node, x, y) ?? source;
    return source;
  }
  if (role === 'end') {
    const to = node.get('to', true);
    if (isMap(to) || isSeq(to)) return writePointNode(source, to, x, y) ?? source;
    if (node.has('x') && node.has('y')) return writePointNode(source, node, x, y) ?? source;
    return source;
  }
  const via = node.get('via', true);
  if (!isSeq(via) || index < 0 || index >= via.items.length) return source;
  return writePointNode(source, via.items[index], x, y) ?? source;
}

function spotText(x: number, y: number): string {
  return `{ x: ${round(x)}, y: ${round(y)} }`;
}

function appendKey(source: string, node: YAMLMap, text: string): string {
  if (!node.range) return source;
  const end = node.range[1];
  if (source[end - 1] === '}') {
    let at = end - 1;
    while (at > node.range[0] && /\s/.test(source[at - 1])) at -= 1;
    const empty = source.slice(node.range[0], at).replace(/\s/g, '') === '{';
    return source.slice(0, at) + (empty ? '' : ', ') + text + source.slice(at);
  }
  const indent = source.slice(node.range[0], end).match(/\n([ \t]+)\S/)?.[1] ?? '  ';
  const at = source[end - 1] === '\n' ? end - 1 : end;
  return source.slice(0, at) + `\n${indent}${text}` + source.slice(at);
}

function insertInSeq(source: string, seq: YAMLSeq, index: number, text: string): string {
  const span = nodeSpan(seq);
  if (!span) return source;
  const body = source.slice(span[0], span[1]);
  if (!body.includes('[')) return source;
  const at = Math.max(0, Math.min(index, seq.items.length));
  if (!seq.items.length) {
    const open = body.indexOf('[');
    if (open < 0) return source;
    return source.slice(0, span[0] + open + 1) + text + source.slice(span[0] + open + 1);
  }
  if (at >= seq.items.length) {
    const last = nodeSpan(seq.items[seq.items.length - 1]);
    if (!last) return source;
    return source.slice(0, last[1]) + ', ' + text + source.slice(last[1]);
  }
  const item = nodeSpan(seq.items[at]);
  if (!item) return source;
  return source.slice(0, item[0]) + text + ', ' + source.slice(item[0]);
}

/** Ajoute un point de passage. Un trajet `[x, y]` devient un objet. */
export function addVia(source: string, ref: string, index: number, x: number, y: number): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = argsOf(nodeAt(doc, ref));
  const spot = spotText(x, y);
  if (isSeq(node)) {
    const span = nodeSpan(node);
    const xs = scalarRange(node.items[0]);
    const ys = scalarRange(node.items[1]);
    if (!span || !xs || !ys || node.items.length < 2) return source;
    const block = source.slice(span[0], span[1]);
    const text = `{ x: ${source.slice(xs[0], xs[1])}, y: ${source.slice(ys[0], ys[1])}, via: [${spot}] }${block.endsWith('\n') ? '\n' : ''}`;
    return source.slice(0, span[0]) + text + source.slice(span[1]);
  }
  if (!isMap(node)) return source;
  const via = node.get('via', true);
  if (isSeq(via)) return insertInSeq(source, via, index, spot);
  return appendKey(source, node, `via: [${spot}]`);
}

function cutPair(source: string, keyStart: number, valueEnd: number): string {
  let start = keyStart;
  let end = valueEnd;
  let after = end;
  while (after < source.length && /[ \t]/.test(source[after])) after += 1;
  let before = start;
  while (before > 0 && /[ \t]/.test(source[before - 1])) before -= 1;
  if (before > 0 && source[before - 1] === ',') start = before - 1;
  else if (source[after] === ',') {
    end = after + 1;
    if (source[end] === ' ') end += 1;
  } else if (before > 0 && source[before - 1] === '\n') {
    start = before - 1;
  }
  return source.slice(0, start) + source.slice(end);
}

/** Retire une clé de liste. Une clé en début de ligne emporte sa ligne, sans coller la suivante. */
function dropListKey(source: string, map: YAMLMap, key: string): string | null {
  const pair = map.items.find(item => isScalar(item.key) && String(item.key.value ?? '') === key);
  const keyStart = pair ? startOf(pair.key) : null;
  const valueSpan = pair ? nodeSpan(pair.value) : null;
  if (keyStart == null || !valueSpan) return null;
  const line = source.lastIndexOf('\n', keyStart - 1);
  const lineStart = line < 0 ? 0 : line + 1;
  if (source.slice(lineStart, keyStart).trim() !== '') return cutPair(source, keyStart, valueSpan[1]);
  let end = valueSpan[1];
  if (source[end] === '\n') end += 1;
  return source.slice(0, lineStart) + source.slice(end);
}

function removeKey(source: string, map: YAMLMap, key: string): string | null {
  const pair = map.items.find(item => isScalar(item.key) && String(item.key.value ?? '') === key);
  const keyStart = pair ? startOf(pair.key) : null;
  const valueSpan = pair ? nodeSpan(pair.value) : null;
  if (keyStart == null || !valueSpan) return null;
  return cutPair(source, keyStart, valueSpan[1]);
}

function removeSeqItem(source: string, seq: YAMLSeq, index: number): string | null {
  const span = nodeSpan(seq.items[index]);
  if (!span) return null;
  let start = span[0];
  let end = span[1];
  let after = end;
  while (after < source.length && /[ \t]/.test(source[after])) after += 1;
  if (source[after] === ',') {
    end = after + 1;
    if (source[end] === ' ') end += 1;
  } else {
    let before = start;
    while (before > 0 && /[ \t]/.test(source[before - 1])) before -= 1;
    if (before > 0 && source[before - 1] === ',') start = before - 1;
  }
  return source.slice(0, start) + source.slice(end);
}

/** Retire un point de passage, puis la clé `via` quand la liste est vide. */
export function removeVia(source: string, ref: string, index: number): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = argsOf(nodeAt(doc, ref));
  if (!isMap(node)) return source;
  const via = node.get('via', true);
  if (!isSeq(via) || index < 0 || index >= via.items.length) return source;
  if (via.items.length <= 1) return removeKey(source, node, 'via') ?? source;
  return removeSeqItem(source, via, index) ?? source;
}

function startOf(node: unknown): number | null {
  if (!node || typeof node !== 'object' || !('range' in node) || !Array.isArray(node.range)) return null;
  return typeof node.range[0] === 'number' ? node.range[0] : null;
}

/** Écrit un scalaire YAML déjà formaté, sans reformater le reste du document. */
function writeToken(source: string, ref: string, key: string, token: string): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = argsOf(nodeAt(doc, ref));
  if (!isMap(node) || !node.range) return source;
  const existing = scalarRange(node.get(key, true));
  if (existing) return splice(source, [{ start: existing[0], end: existing[1], text: token }]);
  const end = node.range[1];
  if (source[end - 1] === '}') {
    let at = end - 1;
    while (at > node.range[0] && /\s/.test(source[at - 1])) at -= 1;
    return source.slice(0, at) + `, ${key}: ${token} ` + source.slice(end - 1);
  }
  const indent = source.slice(node.range[0], end).match(/\n([ \t]+)\S/)?.[1] ?? '  ';
  const at = source[end - 1] === '\n' ? end - 1 : end;
  return source.slice(0, at) + `\n${indent}${key}: ${token}` + source.slice(at);
}

/** Écrit une valeur numérique de l’item, sans reformater le reste du document. */
function writeScalar(source: string, ref: string, key: string, value: number): string {
  return writeToken(source, ref, key, round(value));
}

/** Couleur de remplissage ou de contour d’un tracé SVG. */
export function shapeColor(source: string, ref: string, name: 'fill' | 'stroke'): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return '';
  const node = argsOf(nodeAt(doc, ref));
  if (!isMap(node)) return '';
  const value = node.get(name);
  return typeof value === 'string' ? value : '';
}

function shapeToken(key: string, value: string): string {
  if (key === 'curve' && /^(smooth|line|free)$/.test(value)) return value;
  if (key !== 'd' && key !== 'points' && key !== 'transform' && /^-?\d+(?:\.\d+)?$/.test(value)) return value;
  return JSON.stringify(value);
}

function readShapeMap(source: string, ref: string): { tag: string; attrs: Record<string, string> } | null {
  const tag = ref.split('/').filter(Boolean).pop() || '';
  if (!isSvgTag(tag)) return null;
  const doc = parseDocument(source);
  if (doc.errors.length) return null;
  const node = argsOf(nodeAt(doc, ref));
  if (!isMap(node)) return null;
  const attrs: Record<string, string> = {};
  for (const item of node.items) {
    if (!isScalar(item.key) || !isScalar(item.value)) continue;
    const key = String(item.key.value ?? '');
    if (!key) continue;
    attrs[key] = item.value.value == null ? '' : String(item.value.value);
  }
  return { tag, attrs };
}

function dropShapeKey(source: string, ref: string, key: string): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = argsOf(nodeAt(doc, ref));
  if (!isMap(node) || !node.has(key)) return source;
  return removeKey(source, node, key) ?? source;
}

/** Attributs SVG d’un tracé. Le YAML nomme le centre `x`/`y`. */
export function readShape(source: string, ref: string): { tag: string; attrs: Record<string, string> } | null {
  const found = readShapeMap(source, ref);
  if (!found) return null;
  return { tag: found.tag, attrs: svgAttrsFromYaml(found.tag, found.attrs) };
}

function renameShapeKey(source: string, ref: string, tag: string): string | null {
  const doc = parseDocument(source);
  if (doc.errors.length) return null;
  const parent = doc.getIn(storedPath(doc, ref).slice(0, -1), true);
  if (!isMap(parent) || parent.items.length !== 1) return null;
  const key = parent.items[0]?.key;
  const start = startOf(key);
  const end = key && typeof key === 'object' && 'range' in key && Array.isArray(key.range) ? key.range[1] : null;
  if (start == null || typeof end !== 'number') return null;
  return source.slice(0, start) + tag + source.slice(end);
}

function dropMissingKeys(source: string, ref: string, attrs: Record<string, string>): string {
  let text = source;
  for (;;) {
    const doc = parseDocument(text);
    if (doc.errors.length) return text;
    const node = argsOf(nodeAt(doc, ref));
    if (!isMap(node)) return text;
    const extra = node.items.find(item => isScalar(item.key) && !Object.prototype.hasOwnProperty.call(attrs, String(item.key.value ?? '')));
    if (!extra || !isScalar(extra.key)) return text;
    const cut = removeKey(text, node, String(extra.key.value ?? ''));
    if (!cut || cut === text) return text;
    text = cut;
  }
}

/** Change le type d’un tracé si besoin, puis écrit ses attributs. */
export function retagShape(source: string, ref: string, tag: string, attrs: Record<string, string>): { source: string; ref: string } {
  const current = ref.split('/').filter(Boolean).pop() || '';
  let text = source;
  let nextRef = ref;
  if (current && current !== tag) {
    const renamed = renameShapeKey(text, ref, tag);
    if (!renamed) return { source, ref };
    text = renamed;
    nextRef = ref.slice(0, ref.length - current.length) + tag;
  }
  const stored = yamlAttrsFromSvg(tag, attrs);
  return { source: dropMissingKeys(writeShape(text, nextRef, attrs), nextRef, stored), ref: nextRef };
}

/** Écrit les attributs d’un tracé, sans reformater le reste du document. */
export function writeShape(source: string, ref: string, attrs: Record<string, string>): string {
  const tag = ref.split('/').filter(Boolean).pop() || '';
  const stored = yamlAttrsFromSvg(tag, attrs);
  const current = readShapeMap(source, ref);
  if (!current) return source;
  let next = source;
  for (const [key, value] of Object.entries(stored)) {
    if ((current.attrs[key] ?? '') === value) continue;
    next = writeToken(next, ref, key, shapeToken(key, value));
    current.attrs[key] = value;
  }
  for (const key of ['cx', 'cy']) {
    if (key in stored || !(key in current.attrs)) continue;
    next = dropShapeKey(next, ref, key);
  }
  return next;
}

/** Pose le remplissage ou le contour d’un tracé SVG. */
export function paintShape(source: string, ref: string, name: 'fill' | 'stroke', value: string): string {
  const tag = ref.split('/').filter(Boolean).pop() || '';
  if (!isSvgTag(tag) || !/^#[0-9a-fA-F]{6}$/.test(value)) return source;
  return writeToken(source, ref, name, JSON.stringify(value.toLowerCase()));
}

function refIndex(ref: string): number {
  return listAddress(pathOf(ref))?.index ?? -1;
}

/** Retire plusieurs items. Les plus loin dans la liste partent d’abord, pour ne pas décaler les suivants. */
export function removeItems(source: string, refs: string[]): string {
  const ordered = [...new Set(refs)].sort((a, b) => refIndex(b) - refIndex(a));
  return ordered.reduce((text, ref) => removeItem(text, ref), source);
}

/** Retire l’item de sa liste. */
export function removeItem(source: string, ref: string): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const path = pathOf(ref);
  const address = listAddress(path);
  if (!address) return source;
  const { index } = address;
  const seq = doc.getIn(address.seq, true);
  if (!isSeq(seq) || index < 0 || index >= seq.items.length) return source;
  const listKey = String(address.seq.at(-1) ?? '');
  if (seq.items.length === 1 && (listKey === 'items' || listKey === 'object')) {
    const parentPath = address.seq.slice(0, -1);
    const parent = parentPath.length ? doc.getIn(parentPath, true) : doc.contents;
    if (isMap(parent)) return dropListKey(source, parent, listKey) ?? source;
  }
  const span = nodeSpan(seq.items[index]);
  if (!span) return source;
  let before = span[0];
  while (before > 0 && /[ \t]/.test(source[before - 1])) before -= 1;
  if (before > 0 && source[before - 1] === '-') {
    const start = withDash(source, span[0]);
    let end = span[1];
    if (source[end] === '\n') end += 1;
    return source.slice(0, start) + source.slice(end);
  }
  return removeSeqItem(source, seq, index) ?? source;
}

/** Écrit `wave` ou `amp`. Un trajet `[x, y]` devient un objet. */
export function setTravel(source: string, ref: string, key: 'wave' | 'amp', value: number): string {
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = argsOf(nodeAt(doc, ref));
  if (isMap(node)) return writeScalar(source, ref, key, value);
  if (!isSeq(node) || node.items.length < 2) return source;
  const span = nodeSpan(node);
  const xs = scalarRange(node.items[0]);
  const ys = scalarRange(node.items[1]);
  if (!span || !xs || !ys) return source;
  const block = source.slice(span[0], span[1]);
  const text = `{ x: ${source.slice(xs[0], xs[1])}, y: ${source.slice(ys[0], ys[1])}, ${key}: ${round(value)} }${block.endsWith('\n') ? '\n' : ''}`;
  return source.slice(0, span[0]) + text + source.slice(span[1]);
}

/** Écrit l’angle de l’item, en degrés, sans reformater le reste du document. */
export function setAngle(source: string, ref: string, angle: number): string {
  return writeScalar(source, ref, 'angle', angle);
}

/** Écrit un argument de l’item. Il l’emporte sur les defaults, la session et la déclaration. */
export function setArg(source: string, ref: string, key: string, value: string): string {
  if (!/^[\w-]+$/.test(key) || !/^[\w.-]+$/.test(value)) return source;
  return writeToken(source, ref, key, value);
}

/** Retire un argument de l’item. La valeur revient aux defaults, puis à la session, puis à la déclaration. */
export function clearArg(source: string, ref: string, key: string): string {
  if (!/^[\w-]+$/.test(key)) return source;
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  const node = argsOf(nodeAt(doc, ref));
  if (!isMap(node)) return source;
  return removeKey(source, node, key) ?? source;
}

/** Écrit la taille de l’item. Une valeur nulle laisse l’axe inchangé. x et y suivent le centre si le bord opposé reste fixe. */
export function setSize(source: string, ref: string, w: number | null, h: number | null, x?: number | null, y?: number | null): string {
  let next = source;
  if (w != null) next = writeScalar(next, ref, 'w', w);
  if (h != null) next = writeScalar(next, ref, 'h', h);
  if (x != null) next = writeScalar(next, ref, 'x', x);
  if (y != null) next = writeScalar(next, ref, 'y', y);
  return next;
}

/** Position du curseur : l’abscisse de l’item, sinon le début de l’item. */
export function itemOffset(source: string, ref: string): number | null {
  const doc = parseDocument(source);
  if (doc.errors.length) return null;
  const node = argsOf(nodeAt(doc, ref));
  if (!isMap(node)) return startOf(node);
  const point = node.get('p', true) || node.get('pos', true);
  const x = isMap(point) ? point.get('x', true) : node.has('x') ? node.get('x', true) : null;
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

const NESTED = ['items', 'shape', 'formation', 'zone'];

/** Référence de l’élément sous le curseur. */
export function itemAt(source: string, offset: number): string {
  const doc = parseDocument(source);
  if (doc.errors.length || !isMap(doc.contents)) return '';
  const spans: { ref: string; start: number; end: number }[] = [];
  const add = (node: unknown, ref: string) => {
    const span = nodeSpan(node);
    if (span) spans.push({ ref, start: withDash(source, span[0]), end: span[1] });
  };
  const walkPlain = (items: unknown, path: string, genre: string) => {
    if (!isSeq(items)) return;
    items.items.forEach((item, index) => {
      if (!isMap(item) || item.items.length !== 1 || !isScalar(item.items[0]?.key)) return;
      const type = String(item.items[0].key.value ?? '');
      if (!type) return;
      const ref = `${path}${genre}/${index}/${type}`;
      add(item, ref);
      walkCall(item.items[0]?.value, ref);
    });
  };
  const walkCall = (value: unknown, ref: string) => {
    if (!isMap(value)) return;
    for (const nested of NESTED) walkPlain(value.get(nested, true), `${ref}/`, nested);
  };
  const walkItems = (items: unknown, path: string) => {
    if (!isSeq(items)) return;
    items.items.forEach((item, index) => {
      if (!isMap(item) || item.items.length !== 1 || !isScalar(item.items[0]?.key)) return;
      const type = String(item.items[0].key.value ?? '');
      if (!type) return;
      const value = item.items[0]?.value;
      if (isWrapperKey(type) && isMap(value) && value.items.length === 1 && isScalar(value.items[0]?.key)) {
        const inner = String(value.items[0].key.value ?? '');
        if (!inner) return;
        const ref = `${path}items/${index}/${type}/${inner}`;
        add(item, ref);
        walkCall(value.items[0]?.value, ref);
        return;
      }
      const ref = `${path}items/${index}/${type}`;
      add(item, ref);
      walkCall(value, ref);
    });
  };
  walkItems(doc.contents.get('items', true), '');
  const trajectory = nodeAt(doc, 'trajectory');
  if (trajectory) add(trajectory, 'trajectory');
  const phases = doc.contents.get('phases', true);
  if (isSeq(phases)) {
    phases.items.forEach((phase, phaseIndex) => {
      if (!isMap(phase)) return;
      const moves = phase.get('moves', true);
      if (!isSeq(moves)) return;
      moves.items.forEach((move, moveIndex) => {
        if (!isMap(move)) return;
        const keys = ['dribble', 'run', 'pass'].filter(key => move.has(key));
        if (keys.length === 1) add(move, `phases/${phaseIndex}/moves/${moveIndex}/${keys[0]}`);
        for (const key of keys) {
          const value = move.get(key, true);
          if (value) add(value, `phases/${phaseIndex}/moves/${moveIndex}/${key}`);
        }
      });
    });
  }
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
