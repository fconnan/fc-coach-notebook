import { curvePath } from '$lib/trajectory';
import { formatPath, parsePath, type PathSeg } from '$lib/schema/svgGeometry';

/** Courbe lisse comme une flèche, segments droits, ou bézier libre. */
export type PathKind = 'smooth' | 'line' | 'free';

export type PathPoint = { x: number; y: number };

function round(value: number): number {
  const n = Math.round(value * 1000) / 1000;
  return Object.is(n, -0) ? 0 : n;
}

function text(value: number): string {
  return String(round(value));
}

/** Indication explicite. `data-track` reste la courbe des flèches. */
export function pathHint(attrs: Record<string, string | undefined>): string {
  if (attrs['data-track'] === '1') return 'smooth';
  return attrs.curve || attrs['data-curve'] || '';
}

/** Sommets du tracé, sans les poignées de tangente. */
export function pathAnchors(d: string): PathPoint[] {
  const points: PathPoint[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const seg of parsePath(d)) {
    if (seg.op === 'Z') {
      cx = sx;
      cy = sy;
      continue;
    }
    if (seg.op === 'M') {
      cx = seg.abs[0];
      cy = seg.abs[1];
      sx = cx;
      sy = cy;
      points.push({ x: cx, y: cy });
      continue;
    }
    if (seg.op === 'H') cx = seg.abs[0];
    else if (seg.op === 'V') cy = seg.abs[0];
    else if (seg.op === 'A') {
      cx = seg.abs[5];
      cy = seg.abs[6];
    } else {
      cx = seg.abs[seg.abs.length - 2];
      cy = seg.abs[seg.abs.length - 1];
    }
    points.push({ x: cx, y: cy });
  }
  return points;
}

function linePath(points: PathPoint[]): string {
  if (points.length < 2) return '';
  const [start, ...rest] = points;
  return `M ${text(start.x)} ${text(start.y)}${rest.map(point => ` L ${text(point.x)} ${text(point.y)}`).join('')}`;
}

function samePath(a: string, b: string): boolean {
  const left = parsePath(a);
  const right = parsePath(b);
  if (left.length !== right.length) return false;
  return left.every((seg, index) => {
    const other = right[index];
    return seg.op === other.op && seg.abs.length === other.abs.length && seg.abs.every((value, at) => Math.abs(value - other.abs[at]) < 0.002);
  });
}

/** Type de courbe. L’indication gagne sur la forme du `d`. */
export function pathKind(d: string, hint = ''): PathKind {
  if (hint === 'smooth' || hint === 'line' || hint === 'free') return hint;
  const segs = parsePath(d);
  const drawn = segs.filter(seg => seg.op !== 'M' && seg.op !== 'Z');
  if (drawn.length && drawn.every(seg => seg.op === 'L' || seg.op === 'H' || seg.op === 'V')) return 'line';
  const anchors = pathAnchors(d);
  if (anchors.length >= 3 && samePath(d, curvePath(anchors))) return 'smooth';
  return 'free';
}

/** Réécrit `d` et conserve la clé qui porte le type (`curve` ou `data-curve`). */
export function stampPath(attrs: Record<string, string>, d: string, kind: PathKind): Record<string, string> {
  const next: Record<string, string> = { ...attrs, d };
  if (next['data-track'] === '1') return next;
  if ('curve' in next || !('data-curve' in next)) next.curve = kind;
  if ('data-curve' in next) next['data-curve'] = kind;
  return next;
}

export function setPathKind(d: string, kind: PathKind): string {
  const points = pathAnchors(d);
  if (points.length < 2 || kind === 'free') return d;
  return kind === 'line' ? linePath(points) : curvePath(points);
}

export function moveAnchor(d: string, kind: PathKind, index: number, x: number, y: number): string {
  const points = pathAnchors(d);
  if (!points[index] || kind === 'free') return d;
  points[index] = { x, y };
  return kind === 'line' ? linePath(points) : curvePath(points);
}

export function insertAnchor(d: string, kind: PathKind, at: number, x: number, y: number): string {
  const points = pathAnchors(d);
  if (points.length < 2) return d;
  const spot = Math.max(1, Math.min(at, points.length - 1));
  if (kind === 'line' || kind === 'smooth') {
    points.splice(spot, 0, { x, y });
    return kind === 'line' ? linePath(points) : curvePath(points);
  }
  return insertFree(d, spot, x, y);
}

export function removeAnchor(d: string, kind: PathKind, index: number): string {
  const points = pathAnchors(d);
  if (points.length <= 2 || index < 0 || index >= points.length) return d;
  if (kind === 'line' || kind === 'smooth') {
    points.splice(index, 1);
    return kind === 'line' ? linePath(points) : curvePath(points);
  }
  return removeFree(d, index);
}

/** Segment le plus proche d’un point, entre les sommets. */
export function nearestSegment(points: PathPoint[], at: PathPoint): number {
  let best = 0;
  let dist = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const span = dx * dx + dy * dy;
    const t = span > 0 ? Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / span)) : 0;
    const gap = Math.hypot(at.x - (a.x + dx * t), at.y - (a.y + dy * t));
    if (gap < dist) {
      dist = gap;
      best = i;
    }
  }
  return best;
}

export function nearestPoint(points: PathPoint[], at: PathPoint): number {
  let best = 0;
  let dist = Infinity;
  points.forEach((point, index) => {
    const gap = Math.hypot(at.x - point.x, at.y - point.y);
    if (gap < dist) {
      dist = gap;
      best = index;
    }
  });
  return best;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function splitCubic(p0: PathPoint, abs: number[], t: number): [number[], number[]] {
  const c1 = { x: abs[0], y: abs[1] };
  const c2 = { x: abs[2], y: abs[3] };
  const p = { x: abs[4], y: abs[5] };
  const a = { x: lerp(p0.x, c1.x, t), y: lerp(p0.y, c1.y, t) };
  const b = { x: lerp(c1.x, c2.x, t), y: lerp(c1.y, c2.y, t) };
  const c = { x: lerp(c2.x, p.x, t), y: lerp(c2.y, p.y, t) };
  const d = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  const e = { x: lerp(b.x, c.x, t), y: lerp(b.y, c.y, t) };
  const at = { x: lerp(d.x, e.x, t), y: lerp(d.y, e.y, t) };
  return [
    [a.x, a.y, d.x, d.y, at.x, at.y],
    [e.x, e.y, c.x, c.y, p.x, p.y]
  ];
}

function closestT(p0: PathPoint, abs: number[], at: PathPoint): number {
  let best = 0.5;
  let dist = Infinity;
  for (let i = 1; i < 24; i += 1) {
    const t = i / 24;
    const u = 1 - t;
    const x = u * u * u * p0.x + 3 * u * u * t * abs[0] + 3 * u * t * t * abs[2] + t * t * t * abs[4];
    const y = u * u * u * p0.y + 3 * u * u * t * abs[1] + 3 * u * t * t * abs[3] + t * t * t * abs[5];
    const gap = Math.hypot(at.x - x, at.y - y);
    if (gap < dist) {
      dist = gap;
      best = t;
    }
  }
  return best;
}

function drawSegs(segs: PathSeg[]): PathSeg[] {
  return segs.filter(seg => seg.op !== 'M' && seg.op !== 'Z');
}

function insertFree(d: string, spot: number, x: number, y: number): string {
  const segs = parsePath(d).map(seg => ({ ...seg, abs: seg.abs.slice() }));
  const drawn = drawSegs(segs);
  const seg = drawn[spot - 1];
  if (!seg) return d;
  const at = segs.indexOf(seg);
  let cx = 0;
  let cy = 0;
  for (const item of segs.slice(0, at)) {
    if (item.op === 'H') cx = item.abs[0];
    else if (item.op === 'V') cy = item.abs[0];
    else if (item.op === 'Z') continue;
    else {
      cx = item.abs[item.abs.length - 2];
      cy = item.abs[item.abs.length - 1];
    }
  }
  if (seg.op === 'C') {
    const [left, right] = splitCubic({ x: cx, y: cy }, seg.abs, closestT({ x: cx, y: cy }, seg.abs, { x, y }));
    segs.splice(at, 1, { rel: false, op: 'C', abs: left }, { rel: false, op: 'C', abs: right });
  } else if (seg.op === 'L' || seg.op === 'H' || seg.op === 'V') {
    segs.splice(at, 1, { rel: false, op: 'L', abs: [x, y] }, { rel: false, op: 'L', abs: [seg.op === 'H' ? seg.abs[0] : seg.op === 'V' ? cx : seg.abs[seg.abs.length - 2], seg.op === 'V' ? seg.abs[0] : seg.op === 'H' ? cy : seg.abs[seg.abs.length - 1]] });
  } else {
    segs.splice(at, 0, { rel: false, op: 'L', abs: [x, y] });
  }
  return formatPath(segs);
}

function endOf(seg: PathSeg, start: PathPoint): PathPoint {
  if (seg.op === 'H') return { x: seg.abs[0], y: start.y };
  if (seg.op === 'V') return { x: start.x, y: seg.abs[0] };
  if (seg.op === 'A') return { x: seg.abs[5], y: seg.abs[6] };
  return { x: seg.abs[seg.abs.length - 2], y: seg.abs[seg.abs.length - 1] };
}

function removeFree(d: string, index: number): string {
  const segs = parsePath(d).map(seg => ({ ...seg, abs: seg.abs.slice() }));
  const drawn = drawSegs(segs);
  if (index === 0) {
    const first = drawn[0];
    if (!first) return d;
    const end = endOf(first, { x: segs.find(seg => seg.op === 'M')?.abs[0] || 0, y: segs.find(seg => seg.op === 'M')?.abs[1] || 0 });
    const move = segs.find(seg => seg.op === 'M');
    if (move) {
      move.abs = [end.x, end.y];
      move.rel = false;
    }
    segs.splice(segs.indexOf(first), 1);
    return formatPath(segs);
  }
  const seg = drawn[index - 1];
  if (!seg) return d;
  segs.splice(segs.indexOf(seg), 1);
  return formatPath(segs);
}
