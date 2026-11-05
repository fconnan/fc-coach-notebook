import { isMap, isSeq, Pair, parseDocument, visit, YAMLMap, YAMLSeq } from 'yaml';

/** Petits objets géométriques : toujours sur une ligne. */
const INLINE_MAPS = new Set(['rect', 'pos', 'at', 'box', 'run', 'dribble', 'pass', 'ball', 'margin', 'padding']);
/** Suites courtes de nombres, pas des listes d’objets. */
const INLINE_SEQS = new Set(['at', 'box', 'ball', 'pass', 'run', 'dribble']);

export function formatSchema(source: string): string {
  if (!source.trim()) return source;
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  let rewrite = false;
  visit(doc, {
    Map(_key, node, path) {
      if (!(node instanceof YAMLMap)) return;
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

function flowMap(path: readonly unknown[], node: YAMLMap) {
  const key = pairKey(path);
  if (INLINE_MAPS.has(key)) return true;
  const parent = path[path.length - 1];
  if (parent instanceof Pair && !hasBlockChild(node)) return true;
  if (parent instanceof YAMLSeq) return !hasBlockChild(node);
  return false;
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
  if (key && typeof key === 'object' && 'value' in key && key.value != null) return String(key.value);
  return '';
}
