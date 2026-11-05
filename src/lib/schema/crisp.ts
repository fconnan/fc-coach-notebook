/** Recale les traits droits pour qu’une même épaisseur couvre les mêmes pixels. */

function paintedWidth(el: Element): number {
  let node: Element | null = el;
  let stroke = '';
  let width = '';
  while (node && node.tagName.toLowerCase() !== 'svg') {
    if (!stroke) stroke = node.getAttribute('stroke') || '';
    if (!width) width = node.getAttribute('stroke-width') || '';
    node = node.parentElement;
  }
  if (!stroke || stroke === 'none' || stroke === 'transparent') return 0;
  const value = Number(width);
  return value > 0 ? value : 0;
}

function raw(el: Element, name: string): string {
  const key = `data-crisp-${name}`;
  const stored = el.getAttribute(key);
  if (stored !== null) return stored;
  const value = el.getAttribute(name) ?? '';
  el.setAttribute(key, value);
  return value;
}

function num(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

function axisAligned(ctm: DOMMatrix): boolean {
  return Math.abs(ctm.b) < 1e-3 && Math.abs(ctm.c) < 1e-3;
}

/** Décale une coordonnée pour que le bord du trait tombe sur un pixel physique. */
function snap(user: number, axis: 'x' | 'y', ctm: DOMMatrix, stroke: number, dpr: number): number {
  const origin = new DOMPoint(0, 0).matrixTransform(ctm);
  const unit = new DOMPoint(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0).matrixTransform(ctm);
  const scale = (axis === 'x' ? unit.x - origin.x : unit.y - origin.y);
  if (Math.abs(scale) < 1e-6) return user;
  const screen = (axis === 'x' ? origin.x : origin.y) + user * scale;
  const device = screen * dpr;
  const width = Math.abs(stroke * scale) * dpr;
  const snapped = Math.round(device - width / 2) + width / 2;
  return user + (snapped - device) / dpr / scale;
}

function crispLine(el: SVGLineElement, ctm: DOMMatrix, stroke: number, dpr: number) {
  if ([raw(el, 'x1'), raw(el, 'y1'), raw(el, 'x2'), raw(el, 'y2')].some(value => value.includes('%'))) return;
  const x1 = num(raw(el, 'x1'));
  const y1 = num(raw(el, 'y1'));
  const x2 = num(raw(el, 'x2'));
  const y2 = num(raw(el, 'y2'));
  if (Math.abs(y1 - y2) < 1e-6) {
    const y = fmt(snap(y1, 'y', ctm, stroke, dpr));
    el.setAttribute('y1', y);
    el.setAttribute('y2', y);
  } else if (Math.abs(x1 - x2) < 1e-6) {
    const x = fmt(snap(x1, 'x', ctm, stroke, dpr));
    el.setAttribute('x1', x);
    el.setAttribute('x2', x);
  }
}

function crispRect(el: SVGRectElement, ctm: DOMMatrix, stroke: number, dpr: number) {
  if ([raw(el, 'x'), raw(el, 'y'), raw(el, 'width'), raw(el, 'height')].some(value => value.includes('%'))) return;
  const x = num(raw(el, 'x'));
  const y = num(raw(el, 'y'));
  const right = snap(x + num(raw(el, 'width')), 'x', ctm, stroke, dpr);
  const bottom = snap(y + num(raw(el, 'height')), 'y', ctm, stroke, dpr);
  const left = snap(x, 'x', ctm, stroke, dpr);
  const top = snap(y, 'y', ctm, stroke, dpr);
  el.setAttribute('x', fmt(left));
  el.setAttribute('y', fmt(top));
  el.setAttribute('width', fmt(right - left));
  el.setAttribute('height', fmt(bottom - top));
}

function crispPath(el: SVGPathElement, ctm: DOMMatrix, stroke: number, dpr: number) {
  const next = rewritePath(raw(el, 'd'), (value, axis) => snap(value, axis, ctm, stroke, dpr));
  if (next) el.setAttribute('d', next);
}

function rewritePath(d: string, snapAt: (value: number, axis: 'x' | 'y') => number): string | null {
  const parts = d.match(/[MLHVZCSQTAmlhvzcsqta]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!parts) return null;
  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const out: string[] = [];
  const take = () => {
    const value = Number(parts[index]);
    index += 1;
    return value;
  };
  while (index < parts.length) {
    if (/[A-Za-z]/.test(parts[index])) command = parts[index++];
    const relative = command === command.toLowerCase();
    const kind = command.toUpperCase();
    if (kind === 'Z') {
      x = startX;
      y = startY;
      out.push('Z');
      continue;
    }
    if (kind === 'H') {
      const value = take();
      if (!Number.isFinite(value)) return null;
      x = relative ? x + value : value;
      out.push(`H${fmt(snapAt(x, 'x'))}`);
      continue;
    }
    if (kind === 'V') {
      const value = take();
      if (!Number.isFinite(value)) return null;
      y = relative ? y + value : value;
      out.push(`V${fmt(snapAt(y, 'y'))}`);
      continue;
    }
    if (kind === 'M' || kind === 'L') {
      const nextX = take();
      const nextY = take();
      if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return null;
      x = relative ? x + nextX : nextX;
      y = relative ? y + nextY : nextY;
      if (kind === 'M') {
        startX = x;
        startY = y;
        command = relative ? 'l' : 'L';
      }
      out.push(`${kind}${fmt(snapAt(x, 'x'))} ${fmt(snapAt(y, 'y'))}`);
      continue;
    }
    if (kind === 'A') {
      const rx = take();
      const ry = take();
      const rotation = take();
      const large = take();
      const sweep = take();
      const nextX = take();
      const nextY = take();
      if (![rx, ry, rotation, large, sweep, nextX, nextY].every(Number.isFinite)) return null;
      x = relative ? x + nextX : nextX;
      y = relative ? y + nextY : nextY;
      out.push(`A${fmt(rx)} ${fmt(ry)} ${fmt(rotation)} ${large} ${sweep} ${fmt(snapAt(x, 'x'))} ${fmt(snapAt(y, 'y'))}`);
      continue;
    }
    return null;
  }
  return out.join(' ');
}

export function crispStrokes(svg: SVGSVGElement) {
  if (svg.getBoundingClientRect().width < 2) return;
  const dpr = window.devicePixelRatio || 1;
  for (const node of svg.querySelectorAll('line, rect, path')) {
    if (!(node instanceof SVGGeometryElement)) continue;
    if (node.closest('[data-pick], [data-zone], [data-handle], [data-rotate], [data-resize], [data-mold], #svg-edit')) continue;
    const stroke = paintedWidth(node);
    const ctm = node.getScreenCTM();
    if (!stroke || !ctm || !axisAligned(ctm)) continue;
    if (node instanceof SVGLineElement) crispLine(node, ctm, stroke, dpr);
    else if (node instanceof SVGRectElement) crispRect(node, ctm, stroke, dpr);
    else if (node instanceof SVGPathElement) crispPath(node, ctm, stroke, dpr);
  }
}
