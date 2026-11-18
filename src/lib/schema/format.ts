import { isMap, isScalar, isSeq, Pair, parseDocument, Scalar, visit, YAMLMap, YAMLSeq } from 'yaml';
import { CATEGORIES } from './layout';
import { isWrapperKey } from './items';

/** Petits objets géométriques : toujours sur une ligne. */
const INLINE_MAPS = new Set(['rect', 'pos', 'at', 'box', 'run', 'dribble', 'pass', 'ball', 'margin', 'padding', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'svg', 'defaults']);
/** Suites courtes de nombres, pas des listes d’objets. */
const INLINE_SEQS = new Set(['at', 'box', 'ball', 'pass', 'run', 'dribble', 'upright']);

export function formatSchema(source: string): string {
  if (!source.trim()) return source;
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  let rewrite = false;
  visit(doc, {
    Map(_key, node, path) {
      if (!(node instanceof YAMLMap)) return;
      if (canonKeys(node, path)) rewrite = true;
      const want = flowMap(path, node);
      if (Boolean(node.flow) !== want) rewrite = true;
      node.flow = want;
    },
    Seq(_key, node, path) {
      if (!(node instanceof YAMLSeq)) return;
      const want = flowSeq(path);
      if (Boolean(node.flow) !== want) rewrite = true;
      node.flow = want;
    }
  });
  if (isMap(doc.contents) && orderKeys(doc.contents)) rewrite = true;
  if (!rewrite) return source;
  let next = doc.toString({ collectionStyle: 'any', lineWidth: 0 });
  const crlf = source.includes('\r\n');
  if (crlf) next = next.replace(/\n/g, '\r\n');
  const ending = crlf ? '\r\n' : '\n';
  const trailing = source.endsWith(ending) || source.endsWith('\n');
  if (trailing && !next.endsWith('\n')) next += ending;
  if (!trailing && next.endsWith('\n')) next = next.slice(0, next.endsWith('\r\n') ? -2 : -1);
  return next;
}

/** La clé d’un appel pointé devient son dernier segment : `arrow.run` → `run`. L’enveloppe `zone` reste. */
function canonKeys(node: YAMLMap, path: readonly unknown[]): boolean {
  let changed = false;
  const parent = path[path.length - 1];
  if (parent instanceof YAMLSeq && node.items.length === 1) {
    const name = label(node.items[0]);
    if (isWrapperKey(name)) {
      const value = node.items[0].value;
      if (value instanceof YAMLMap && value.items.length === 1) {
        const inner = label(value.items[0]);
        const dot = inner.lastIndexOf('.');
        if (dot > 0) changed = setKey(value.items[0], inner.slice(dot + 1)) || changed;
      }
    } else {
      const dot = name.lastIndexOf('.');
      if (dot > 0) changed = setKey(node.items[0], name.slice(dot + 1)) || changed;
    }
  }
  return changed;
}

function orderKeys(node: YAMLMap): boolean {
  const rank = (pair: Pair) => {
    const index = (CATEGORIES as readonly string[]).indexOf(label(pair));
    return index < 0 ? CATEGORIES.length : index;
  };
  const items = [...node.items];
  const sorted = items.slice().sort((a, b) => rank(a) - rank(b));
  if (sorted.every((pair, index) => pair === items[index])) return false;
  node.items = sorted;
  return true;
}

function setKey(pair: Pair, value: string): boolean {
  const key = pair.key;
  if (!isScalar(key) || key.value === value) return false;
  key.value = value;
  if (key instanceof Scalar) {
    key.source = undefined;
    if (/^[A-Za-z_][\w-]*$/.test(value)) key.type = Scalar.PLAIN;
  }
  return true;
}

function flowMap(path: readonly unknown[], node: YAMLMap) {
  const parent = path[path.length - 1];
  if (parent instanceof YAMLSeq && node.items.length === 1) return false;
  if (callArgs(path) && !hasNestedList(node)) return true;
  const key = pairKey(path);
  if (INLINE_MAPS.has(key)) return true;
  if (parent instanceof Pair && !hasBlockChild(node)) return true;
  if (parent instanceof YAMLSeq) return !hasBlockChild(node);
  return false;
}

/** Sac d’arguments d’un appel : la valeur de l’unique clé d’une entrée de liste. */
function callArgs(path: readonly unknown[]) {
  const pair = path[path.length - 1];
  const map = path[path.length - 2];
  const seq = path[path.length - 3];
  return pair instanceof Pair && map instanceof YAMLMap && map.items.length === 1 && seq instanceof YAMLSeq;
}

function hasNestedList(node: YAMLMap) {
  return node.items.some(item => isSeq(item.value) && !INLINE_SEQS.has(label(item)));
}

function flowSeq(path: readonly unknown[]) {
  if (INLINE_SEQS.has(pairKey(path))) return true;
  return path[path.length - 1] instanceof YAMLSeq;
}

function hasBlockChild(node: YAMLMap) {
  return node.items.some(item => {
    const key = label(item);
    if (isSeq(item.value)) return !INLINE_SEQS.has(key);
    return isMap(item.value) && !INLINE_MAPS.has(key);
  });
}

function pairKey(path: readonly unknown[]) {
  const parent = path[path.length - 1];
  return parent instanceof Pair ? label(parent) : '';
}

function label(pair: Pair) {
  const key = pair.key;
  if (isScalar(key) && key.value != null) return String(key.value);
  return '';
}
