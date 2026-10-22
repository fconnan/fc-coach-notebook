import { Pair, parseDocument, visit, YAMLSeq } from 'yaml';

const FLOW_ENTRIES = new Set(['zones', 'items', 'players', 'lines', 'moves']);
const FLOW_VALUES = new Set(['at', 'box', 'run', 'dribble', 'ball', 'pass']);

export function formatSchema(source: string): string {
  if (!source.trim()) return source;
  const doc = parseDocument(source);
  if (doc.errors.length) return source;
  let rewrite = false;
  visit(doc, {
    Map(_key, node, path) {
      const want = flowMap(path);
      if (Boolean(node.flow) !== want) rewrite = true;
      node.flow = want;
    },
    Seq(_key, node, path) {
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

function flowMap(path: readonly unknown[]) {
  const parent = path[path.length - 1];
  if (parent instanceof YAMLSeq) return FLOW_ENTRIES.has(owner(path[path.length - 2]));
  if (parent instanceof Pair) {
    const key = label(parent);
    return key === 'run' || key === 'dribble';
  }
  return false;
}

function flowSeq(path: readonly unknown[]) {
  const parent = path[path.length - 1];
  if (parent instanceof YAMLSeq) return owner(path[path.length - 2]) === 'lines';
  if (parent instanceof Pair) return FLOW_VALUES.has(label(parent));
  return false;
}

function owner(node: unknown) {
  return node instanceof Pair ? label(node) : '';
}

function label(pair: Pair) {
  const key = pair.key;
  if (key && typeof key === 'object' && 'value' in key && key.value != null) return String(key.value);
  return '';
}
