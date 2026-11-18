import { moveAnchor, pathAnchors, pathHint, pathKind, stampPath } from './pathEdit';
import { formatPath, mapPath, parsePath, type PathSeg } from '$lib/schema/svgGeometry';

/** Attributs SVG d’une forme. Les nombres sont déjà écrits en texte. */
export type ShapeAttrs = Record<string, string>;

export interface ShapeKnot {
  x: number;
  y: number;
  role: 'anchor' | 'control';
  seg: number;
  part: number;
}

function num(value: number): string {
  const n = Math.round(value * 1000) / 1000;
  return String(Object.is(n, -0) ? 0 : n);
}

function read(attrs: ShapeAttrs, name: string, fallback = 0): number {
  const match = /[+-]?(?:\d*\.\d+|\d+)/.exec(attrs[name] || '');
  const value = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(value) ? value : fallback;
}

function put(attrs: ShapeAttrs, name: string, value: number): ShapeAttrs {
  return { ...attrs, [name]: num(value) };
}

function pathKnots(d: string): ShapeKnot[] {
  return segKnots(parsePath(d));
}

function segKnots(segs: PathSeg[]): ShapeKnot[] {
  const points: ShapeKnot[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  segs.forEach((seg, segIndex) => {
    const roleAt = (pair: number, pairs: number): ShapeKnot['role'] => pair < pairs - 1 ? 'control' : 'anchor';
    if (seg.op === 'H') points.push({ x: seg.abs[0], y: cy, role: 'anchor', seg: segIndex, part: 0 });
    else if (seg.op === 'V') points.push({ x: cx, y: seg.abs[0], role: 'anchor', seg: segIndex, part: 0 });
    else if (seg.op === 'A') points.push({ x: seg.abs[5], y: seg.abs[6], role: 'anchor', seg: segIndex, part: 0 });
    else if (seg.op !== 'Z') {
      const pairs = seg.abs.length / 2;
      for (let pair = 0; pair < pairs; pair += 1) {
        points.push({ x: seg.abs[pair * 2], y: seg.abs[pair * 2 + 1], role: roleAt(pair, pairs), seg: segIndex, part: pair });
      }
    }
    if (seg.op === 'H') cx = seg.abs[0];
    else if (seg.op === 'V') cy = seg.abs[0];
    else if (seg.op === 'Z') { cx = sx; cy = sy; }
    else if (seg.op === 'A') { cx = seg.abs[5]; cy = seg.abs[6]; }
    else { cx = seg.abs[seg.abs.length - 2]; cy = seg.abs[seg.abs.length - 1]; }
    if (seg.op === 'M') { sx = cx; sy = cy; }
  });
  return points;
}

function movePathPoint(d: string, knot: number, x: number, y: number): string {
  const segs = parsePath(d).map(seg => ({ ...seg, abs: seg.abs.slice() }));
  const point = segKnots(segs)[knot];
  if (!point) return d;
  const seg = segs[point.seg];
  if (!seg) return d;
  if (seg.op === 'H') seg.abs[0] = x;
  else if (seg.op === 'V') seg.abs[0] = y;
  else if (seg.op === 'A') { seg.abs[5] = x; seg.abs[6] = y; }
  else {
    seg.abs[point.part * 2] = x;
    seg.abs[point.part * 2 + 1] = y;
  }
  return formatPath(segs);
}

function pointList(text: string): [number, number][] {
  const values = text.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const points: [number, number][] = [];
  for (let i = 0; i + 1 < values.length; i += 2) points.push([values[i], values[i + 1]]);
  return points;
}

/** Sommets éditables, dans le repère des attributs. */
export function shapeKnots(tag: string, attrs: ShapeAttrs): ShapeKnot[] {
  const name = tag.toLowerCase();
  if (name === 'path') {
    const kind = pathKind(attrs.d || '', pathHint(attrs));
    if (kind !== 'free') return pathAnchors(attrs.d || '').map((point, seg) => ({ x: point.x, y: point.y, role: 'anchor' as const, seg, part: 0 }));
    return pathKnots(attrs.d || '');
  }
  if (name === 'polygon' || name === 'polyline') {
    return pointList(attrs.points || '').map(([x, y], seg) => ({ x, y, role: 'anchor' as const, seg, part: 0 }));
  }
  if (name === 'line') {
    return [
      { x: read(attrs, 'x1'), y: read(attrs, 'y1'), role: 'anchor', seg: 0, part: 0 },
      { x: read(attrs, 'x2'), y: read(attrs, 'y2'), role: 'anchor', seg: 1, part: 0 }
    ];
  }
  if (name === 'rect') {
    const x = read(attrs, 'x');
    const y = read(attrs, 'y');
    const w = read(attrs, 'width');
    const h = read(attrs, 'height');
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py], seg) => ({ x: px, y: py, role: 'anchor' as const, seg, part: 0 }));
  }
  if (name === 'circle') {
    const cx = read(attrs, 'cx');
    const cy = read(attrs, 'cy');
    const r = read(attrs, 'r');
    return [
      { x: cx, y: cy, role: 'anchor', seg: 0, part: 0 },
      { x: cx + r, y: cy, role: 'control', seg: 1, part: 0 }
    ];
  }
  if (name === 'ellipse') {
    const cx = read(attrs, 'cx');
    const cy = read(attrs, 'cy');
    return [
      { x: cx, y: cy, role: 'anchor', seg: 0, part: 0 },
      { x: cx + read(attrs, 'rx'), y: cy, role: 'control', seg: 1, part: 0 },
      { x: cx, y: cy + read(attrs, 'ry'), role: 'control', seg: 2, part: 0 }
    ];
  }
  if (name === 'text') return [{ x: read(attrs, 'x'), y: read(attrs, 'y'), role: 'anchor', seg: 0, part: 0 }];
  return [];
}

/** Déplace un sommet. Les autres restent en place. */
export function moveShapeKnot(tag: string, attrs: ShapeAttrs, knot: number, x: number, y: number): ShapeAttrs {
  const name = tag.toLowerCase();
  if (name === 'path') {
    const kind = pathKind(attrs.d || '', pathHint(attrs));
    if (kind !== 'free') return stampPath(attrs, moveAnchor(attrs.d || '', kind, knot, x, y), kind);
    return { ...attrs, d: movePathPoint(attrs.d || '', knot, x, y) };
  }
  if (name === 'polygon' || name === 'polyline') {
    const points = pointList(attrs.points || '');
    if (!points[knot]) return attrs;
    points[knot] = [x, y];
    return { ...attrs, points: points.map(pair => `${num(pair[0])},${num(pair[1])}`).join(' ') };
  }
  if (name === 'line') {
    const key = knot === 0 ? ['x1', 'y1'] : ['x2', 'y2'];
    return put(put(attrs, key[0], x), key[1], y);
  }
  if (name === 'rect') {
    const left = read(attrs, 'x');
    const top = read(attrs, 'y');
    const right = left + read(attrs, 'width');
    const bottom = top + read(attrs, 'height');
    const xs = [left, right];
    const ys = [top, bottom];
    if (knot === 0 || knot === 3) xs[0] = x;
    else xs[1] = x;
    if (knot === 0 || knot === 1) ys[0] = y;
    else ys[1] = y;
    const nx = Math.min(...xs);
    const ny = Math.min(...ys);
    return put(put(put(put(attrs, 'x', nx), 'y', ny), 'width', Math.abs(xs[1] - xs[0])), 'height', Math.abs(ys[1] - ys[0]));
  }
  if (name === 'circle') {
    const cx = read(attrs, 'cx');
    const cy = read(attrs, 'cy');
    if (knot === 0) return put(put(attrs, 'cx', x), 'cy', y);
    return put(attrs, 'r', Math.hypot(x - cx, y - cy));
  }
  if (name === 'ellipse') {
    const cx = read(attrs, 'cx');
    const cy = read(attrs, 'cy');
    if (knot === 0) return put(put(attrs, 'cx', x), 'cy', y);
    if (knot === 1) return put(attrs, 'rx', Math.abs(x - cx));
    return put(attrs, 'ry', Math.abs(y - cy));
  }
  if (name === 'text') return put(put(attrs, 'x', x), 'y', y);
  return attrs;
}

/** Centre géométrique, avant la rotation. */
export function shapeCenter(tag: string, attrs: ShapeAttrs): { x: number; y: number } | null {
  const name = tag.toLowerCase();
  if (name === 'rect') return { x: read(attrs, 'x') + read(attrs, 'width') / 2, y: read(attrs, 'y') + read(attrs, 'height') / 2 };
  if (name === 'circle' || name === 'ellipse') return { x: read(attrs, 'cx'), y: read(attrs, 'cy') };
  if (name === 'line') return { x: (read(attrs, 'x1') + read(attrs, 'x2')) / 2, y: (read(attrs, 'y1') + read(attrs, 'y2')) / 2 };
  const knots = shapeKnots(tag, attrs).filter(knot => knot.role === 'anchor');
  if (!knots.length) return null;
  const x = knots.reduce((sum, knot) => sum + knot.x, 0) / knots.length;
  const y = knots.reduce((sum, knot) => sum + knot.y, 0) / knots.length;
  return { x, y };
}

function shiftRotate(transform: string, dx: number, dy: number): string {
  return transform.replace(/rotate\(\s*([-\d.eE+]+)(?:[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+))?\s*\)/g, (_all, angle: string, cx?: string, cy?: string) => {
    const x = Number(cx ?? 0) + dx;
    const y = Number(cy ?? 0) + dy;
    return `rotate(${angle} ${num(x)} ${num(y)})`;
  });
}

/** Translation rigide, dans le repère des attributs. */
export function translateShape(tag: string, attrs: ShapeAttrs, dx: number, dy: number): ShapeAttrs {
  if (!dx && !dy) return attrs;
  const name = tag.toLowerCase();
  let next = attrs;
  if (name === 'rect' || name === 'text') next = put(put(next, 'x', read(next, 'x') + dx), 'y', read(next, 'y') + dy);
  else if (name === 'circle' || name === 'ellipse') next = put(put(next, 'cx', read(next, 'cx') + dx), 'cy', read(next, 'cy') + dy);
  else if (name === 'line') {
    next = put(put(next, 'x1', read(next, 'x1') + dx), 'y1', read(next, 'y1') + dy);
    next = put(put(next, 'x2', read(next, 'x2') + dx), 'y2', read(next, 'y2') + dy);
  } else if (name === 'polygon' || name === 'polyline') {
    const points = pointList(next.points || '').map(([x, y]) => [x + dx, y + dy] as [number, number]);
    next = { ...next, points: points.map(pair => `${num(pair[0])},${num(pair[1])}`).join(' ') };
  } else if (name === 'path') {
    next = { ...next, d: mapPath(next.d || '', value => value + dx, value => value + dy) };
  }
  if (next.transform) next = { ...next, transform: shiftRotate(next.transform, dx, dy) };
  return next;
}

export type FittedShape = { tag: string; attrs: ShapeAttrs };

function rotationOf(transform: string): { angle: string; cx: number; cy: number } | null {
  const match = /rotate\(\s*([-\d.eE+]+)(?:[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+))?\s*\)/.exec(transform);
  if (!match) return null;
  return { angle: match[1], cx: Number(match[2] ?? 0), cy: Number(match[3] ?? 0) };
}

/** Tourne `p` autour de `c` avec la formule SVG, en degrés. */
function spinPoint(angle: number, c: { x: number; y: number }, p: { x: number; y: number }) {
  const rad = angle * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + cos * dx - sin * dy, y: c.y + sin * dx + cos * dy };
}

/**
 * Le pivot suit le centre géométrique le long de l’axe déjà tourné.
 * Le dessin à l’écran ne bouge pas : seul le repère des attributs est réécrit.
 */
function rebaseRotation(tag: string, attrs: ShapeAttrs): ShapeAttrs {
  const turn = rotationOf(attrs.transform || '');
  if (!turn || !attrs.transform) return attrs;
  const center = shapeCenter(tag, attrs);
  if (!center) return attrs;
  const pivot = { x: turn.cx, y: turn.cy };
  const visual = spinPoint(Number(turn.angle), pivot, center);
  const dx = visual.x - center.x;
  const dy = visual.y - center.y;
  const shifted = dx || dy ? translateShape(tag, attrs, dx, dy) : attrs;
  const transform = (shifted.transform || attrs.transform).replace(
    /rotate\(\s*[-\d.eE+]+(?:[\s,]+[-\d.eE+]+[\s,]+[-\d.eE+]+)?\s*\)/g,
    `rotate(${turn.angle} ${num(visual.x)} ${num(visual.y)})`
  );
  return { ...shifted, transform };
}

/** Étire la forme autour d’un point fixe. Un cercle devient une ellipse si les deux axes diffèrent. */
export function fitShape(tag: string, attrs: ShapeAttrs, anchorX: number, anchorY: number, sx: number, sy: number): FittedShape {
  const xOf = (value: number) => anchorX + (value - anchorX) * sx;
  const yOf = (value: number) => anchorY + (value - anchorY) * sy;
  const name = tag.toLowerCase();
  let next: ShapeAttrs = { ...attrs };
  let out = name;
  if (name === 'rect') {
    const x0 = read(attrs, 'x');
    const y0 = read(attrs, 'y');
    const x1 = xOf(x0);
    const y1 = yOf(y0);
    const x2 = xOf(x0 + read(attrs, 'width'));
    const y2 = yOf(y0 + read(attrs, 'height'));
    next = put(put(put(put(next, 'x', Math.min(x1, x2)), 'y', Math.min(y1, y2)), 'width', Math.abs(x2 - x1)), 'height', Math.abs(y2 - y1));
  } else if (name === 'circle' || name === 'ellipse') {
    const cx = xOf(read(attrs, 'cx'));
    const cy = yOf(read(attrs, 'cy'));
    const rx = Math.abs((name === 'circle' ? read(attrs, 'r') : read(attrs, 'rx')) * sx);
    const ry = Math.abs((name === 'circle' ? read(attrs, 'r') : read(attrs, 'ry')) * sy);
    delete next.r;
    delete next.rx;
    delete next.ry;
    next = put(put(next, 'cx', cx), 'cy', cy);
    if (Math.abs(rx - ry) <= 0.0005) {
      out = 'circle';
      next = put(next, 'r', (rx + ry) / 2);
    } else {
      out = 'ellipse';
      next = put(put(next, 'rx', rx), 'ry', ry);
    }
  } else if (name === 'line') {
    next = put(put(put(put(next, 'x1', xOf(read(attrs, 'x1'))), 'y1', yOf(read(attrs, 'y1'))), 'x2', xOf(read(attrs, 'x2'))), 'y2', yOf(read(attrs, 'y2')));
  } else if (name === 'polygon' || name === 'polyline') {
    const points = pointList(attrs.points || '').map(([x, y]) => [xOf(x), yOf(y)] as [number, number]);
    next = { ...next, points: points.map(pair => `${num(pair[0])},${num(pair[1])}`).join(' ') };
  } else if (name === 'path') {
    next = { ...next, d: mapPath(attrs.d || '', xOf, yOf) };
  } else if (name === 'text') {
    next = put(put(next, 'x', xOf(read(attrs, 'x'))), 'y', yOf(read(attrs, 'y')));
  }
  if (next.transform) next = rebaseRotation(out, next);
  return { tag: out, attrs: next };
}

/** Pose une rotation autour du centre. L’angle est celui de SVG, en degrés. */
export function rotateShape(tag: string, attrs: ShapeAttrs, angle: number): ShapeAttrs {
  const center = shapeCenter(tag, attrs);
  if (!center) return attrs;
  const snapped = snapAngle(angle);
  const call = `rotate(${num(snapped)} ${num(center.x)} ${num(center.y)})`;
  const rest = (attrs.transform || '').replace(/rotate\([^)]*\)/g, '').trim();
  return { ...attrs, transform: rest ? `${call} ${rest}` : call };
}

function snapAngle(angle: number): number {
  let value = angle;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  for (const card of [0, 90, 180, -90, -180]) {
    let delta = value - card;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    if (Math.abs(delta) <= 8) return card === -180 ? 180 : card;
  }
  return Math.round(value * 10) / 10;
}
