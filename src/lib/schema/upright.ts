/** Contre-rotation d'une partie, dans le repère du dessin.
 *  C = T(p) S⁻¹ R(-a) S T(-p). Le centre reste, l'horizontale revient.
 *  S = diag(sx, sy) est l'échelle du dessin, sy négatif quand l'axe y est retourné. */

function round(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function num(value: number): string {
  return String(round(value));
}

/** Valeur `transform` de la correction. L'angle est celui du groupe, en degrés. */
export function uprightMatrix(angle: number, sx: number, sy: number, px: number, py: number): string {
  const rad = (angle * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const scaleX = sx || 1;
  const scaleY = sy || 1;
  const a = c;
  const b = -s * (scaleX / scaleY);
  const cc = s * (scaleY / scaleX);
  const d = c;
  const e = px - a * px - cc * py;
  const f = py - b * px - d * py;
  return `matrix(${num(a)} ${num(b)} ${num(cc)} ${num(d)} ${num(e)} ${num(f)})`;
}

function attrNum(attrs: string, name: string): number | undefined {
  const found = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs);
  if (!found) return undefined;
  const value = parseFloat(found[1]);
  return Number.isFinite(value) ? value : undefined;
}

/** Centre de la partie, dans le repère du SVG. `data-pivot` l'emporte. */
export function partCenter(tag: string, attrs: string): { x: number; y: number } {
  const pivot = /\bdata-pivot\s*=\s*"([^"]*)"/i.exec(attrs);
  if (pivot) {
    const [x, y] = pivot[1].trim().split(/[\s,]+/).map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  const kind = tag.toLowerCase();
  if (kind === 'text' || kind === 'tspan') {
    const size = attrNum(attrs, 'font-size') ?? 16;
    return { x: attrNum(attrs, 'x') ?? 0, y: (attrNum(attrs, 'y') ?? 0) - 0.35 * size };
  }
  if (kind === 'circle' || kind === 'ellipse') {
    return { x: attrNum(attrs, 'cx') ?? 0, y: attrNum(attrs, 'cy') ?? 0 };
  }
  if (kind === 'rect') {
    const x = attrNum(attrs, 'x') ?? 0;
    const y = attrNum(attrs, 'y') ?? 0;
    return { x: x + (attrNum(attrs, 'width') ?? 0) / 2, y: y + (attrNum(attrs, 'height') ?? 0) / 2 };
  }
  return { x: attrNum(attrs, 'x') ?? 0, y: attrNum(attrs, 'y') ?? 0 };
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renameIds(markup: string): string {
  return markup.replace(/\sid\s*=\s*(["'])([^"']*)\1/gi, ' data-part="$2"');
}

function held(markup: string, index: number): boolean {
  const before = markup.slice(0, index);
  const close = before.lastIndexOf('>');
  if (close < 0) return false;
  const open = before.lastIndexOf('<', close);
  if (open < 0 || before.slice(close + 1).trim() !== '') return false;
  return before.slice(open, close).includes('data-upright="1"');
}

function closeAt(markup: string, tag: string, from: number): number {
  const re = new RegExp(`<(/?)(${escapeReg(tag)})\\b[^<>]*\\/?>`, 'gi');
  re.lastIndex = from;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markup))) {
    const closing = match[1] === '/';
    if (!closing && match[0].endsWith('/>')) continue;
    depth += closing ? -1 : 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return -1;
}

interface OpenTag {
  start: number;
  end: number;
  tag: string;
  attrs: string;
}

function firstOpen(markup: string, name: string): OpenTag | null {
  const re = new RegExp(`<([A-Za-z][\\w:.-]*)\\b([^<>]*\\bdata-part="${escapeReg(name)}"[^<>]*)\\/?>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(markup))) {
    if (held(markup, match.index)) continue;
    const self = match[0].endsWith('/>');
    const tagEnd = match.index + match[0].length;
    const end = self ? tagEnd : closeAt(markup, match[1], tagEnd);
    if (end < 0) continue;
    return { start: match.index, end, tag: match[1], attrs: match[2].replace(/\/\s*$/, '') };
  }
  return null;
}

function wrapNamed(markup: string, name: string, angle: number, sx: number, sy: number): string {
  let current = markup;
  for (let guard = 0; guard < 64; guard += 1) {
    const hit = firstOpen(current, name);
    if (!hit) return current;
    const center = partCenter(hit.tag, hit.attrs);
    const px = round(center.x);
    const py = round(center.y);
    const transform = uprightMatrix(angle, sx, sy, px, py);
    const element = current.slice(hit.start, hit.end);
    const wrapped = `<g data-upright="1" data-px="${px}" data-py="${py}" transform="${transform}">${element}</g>`;
    current = current.slice(0, hit.start) + wrapped + current.slice(hit.end);
  }
  return current;
}

/** Remplace chaque `id` par `data-part`, puis entoure les parties listées. */
export function wrapUpright(markup: string, parts: string[] | undefined, angle: number, sx: number, sy: number): string {
  let next = renameIds(markup);
  const seen = new Set<string>();
  for (const name of parts || []) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    next = wrapNamed(next, name, angle, sx, sy);
  }
  return next;
}

function drawnScale(node: Element): { sx: number; sy: number } {
  if (node instanceof SVGGraphicsElement && node.transform.baseVal.numberOfItems > 0) {
    const list = node.transform.baseVal;
    let matrix = list.getItem(0).matrix;
    const svg = node.ownerSVGElement;
    if (svg && list.numberOfItems > 1) {
      let combined = svg.createSVGMatrix();
      for (let index = 0; index < list.numberOfItems; index += 1) combined = combined.multiply(list.getItem(index).matrix);
      matrix = combined;
    }
    if (matrix.a !== 0 || matrix.d !== 0) return { sx: matrix.a, sy: matrix.d };
  }
  const raw = node.getAttribute('transform') || '';
  const scale = /scale\(\s*([-\d.eE+]+)(?:[\s,]+([-\d.eE+]+))?\s*\)/.exec(raw);
  if (scale) return { sx: Number(scale[1]) || 1, sy: Number(scale[2] ?? scale[1]) || 1 };
  return { sx: 1, sy: 1 };
}

/** Réécrit la correction après un changement d'angle ou d'échelle, sans rerendu. */
export function refreshUpright(group: Element, angle: number): void {
  const scaled = group.querySelector(':scope > [data-draw]') ?? group.querySelector(':scope > g');
  if (!scaled) return;
  const { sx, sy } = drawnScale(scaled);
  for (const node of group.querySelectorAll('[data-upright]')) {
    if (!(node instanceof Element)) continue;
    const px = Number(node.getAttribute('data-px')) || 0;
    const py = Number(node.getAttribute('data-py')) || 0;
    node.setAttribute('transform', uprightMatrix(angle, sx, sy, px, py));
  }
}
