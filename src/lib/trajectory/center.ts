import type { Point } from './types';

export interface Spine {
  length: number;
  /** Point local à l'abscisse curviligne s. */
  pointAt(distance: number): Point;
  /** Tangente locale unitaire. */
  tangentAt(distance: number): Point;
}

interface Sample {
  d: number;
  at: Point;
  tangent: Point;
}

const STEPS = 64;

function add(a: Point, b: Point, scale = 1): Point {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale };
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function mul(a: Point, scale: number): Point {
  return { x: a.x * scale, y: a.y * scale };
}

export function unit(a: Point): Point {
  const span = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / span, y: a.y / span };
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function samplesOf(at: (t: number) => Point, tangent: (t: number) => Point): Sample[] {
  const rows: Sample[] = [];
  let dist = 0;
  let prev = at(0);
  for (let i = 0; i <= STEPS; i += 1) {
    const t = i / STEPS;
    const point = at(t);
    if (i) dist += Math.hypot(point.x - prev.x, point.y - prev.y);
    rows.push({ d: dist, at: point, tangent: unit(tangent(t)) });
    prev = point;
  }
  return rows;
}

function lookup(rows: Sample[], distance: number): { at: Point; tangent: Point } {
  const total = rows[rows.length - 1]?.d || 0;
  const d = Math.max(0, Math.min(distance, total));
  let lo = 1;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].d < d) lo = mid + 1;
    else hi = mid;
  }
  const b = rows[lo] || rows[0];
  const a = rows[lo - 1] || b;
  const span = b.d - a.d || 1;
  const t = (d - a.d) / span;
  return { at: lerp(a.at, b.at, t), tangent: unit(lerp(a.tangent, b.tangent, t)) };
}

function fromSamples(rows: Sample[]): Spine {
  return {
    length: rows[rows.length - 1]?.d || 0,
    pointAt: distance => lookup(rows, distance).at,
    tangentAt: distance => lookup(rows, distance).tangent
  };
}

export function lineSpine(chord: number): Spine {
  return {
    length: chord,
    pointAt: distance => ({ x: Math.max(0, Math.min(distance, chord)), y: 0 }),
    tangentAt: () => ({ x: 1, y: 0 })
  };
}

/** Un segment de cubique. `p0` est le point de départ, `p` le point d'arrivée. */
export interface Cubic {
  p0: Point;
  c1: Point;
  c2: Point;
  p: Point;
}

/** Cubiques qui passent par chaque point. Les extrémités répètent leur voisin, comme un lissage de Catmull-Rom. */
export function smoothCubics(points: Point[]): Cubic[] {
  if (points.length < 2) return [];
  const cubics: Cubic[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    cubics.push({
      p0: p1,
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p: p2
    });
  }
  return cubics;
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10000) / 10000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Tracé SVG. Deux points donnent une droite, au-delà une cubique par intervalle. */
export function curvePath(points: Point[]): string {
  if (points.length < 2) return '';
  const start = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  if (points.length === 2) return `${start} L ${fmt(points[1].x)} ${fmt(points[1].y)}`;
  const parts = [start];
  for (const cubic of smoothCubics(points)) {
    parts.push(`C ${fmt(cubic.c1.x)} ${fmt(cubic.c1.y)} ${fmt(cubic.c2.x)} ${fmt(cubic.c2.y)} ${fmt(cubic.p.x)} ${fmt(cubic.p.y)}`);
  }
  return parts.join(' ');
}

function cubicPoint(cubic: Cubic, t: number): Point {
  const u = 1 - t;
  return add(
    add(mul(cubic.p0, u * u * u), mul(cubic.c1, 3 * u * u * t)),
    add(mul(cubic.c2, 3 * u * t * t), mul(cubic.p, t * t * t))
  );
}

function cubicTangent(cubic: Cubic, t: number): Point {
  const u = 1 - t;
  return add(
    add(mul(sub(cubic.c1, cubic.p0), 3 * u * u), mul(sub(cubic.c2, cubic.c1), 6 * u * t)),
    mul(sub(cubic.p, cubic.c2), 3 * t * t)
  );
}

/** Ligne médiane qui passe par chaque point, avec une abscisse curviligne sur tous les segments. */
export function smoothSpine(points: Point[]): Spine {
  const cubics = smoothCubics(points);
  if (!cubics.length) return lineSpine(0);
  const rows: Sample[] = [];
  let dist = 0;
  for (const cubic of cubics) {
    const begin = rows.length ? 1 : 0;
    for (let i = begin; i <= STEPS; i += 1) {
      const t = i / STEPS;
      const point = cubicPoint(cubic, t);
      if (rows.length) dist += Math.hypot(point.x - rows[rows.length - 1].at.x, point.y - rows[rows.length - 1].at.y);
      rows.push({ d: dist, at: point, tangent: unit(cubicTangent(cubic, t)) });
    }
  }
  return fromSamples(rows);
}
