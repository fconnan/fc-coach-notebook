import type { Point } from './types';

export interface Frame {
  origin: Point;
  /** Longueur de la corde. */
  chord: number;
  /** Direction unitaire du déplacement. */
  u: Point;
  /** Gauche du déplacement. */
  n: Point;
}

export function frameOf(start: Point, end: Point): Frame | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chord = Math.hypot(dx, dy);
  if (!(chord > 1e-6)) return null;
  return {
    origin: start,
    chord,
    u: { x: dx / chord, y: dy / chord },
    n: { x: -dy / chord, y: dx / chord }
  };
}

/** Repère local vers le terrain : rotation et translation, sans échelle. */
export function toGlobal(frame: Frame, local: Point): Point {
  return {
    x: frame.origin.x + local.x * frame.u.x + local.y * frame.n.x,
    y: frame.origin.y + local.x * frame.u.y + local.y * frame.n.y
  };
}

export function vectorGlobal(frame: Frame, local: Point): Point {
  return {
    x: local.x * frame.u.x + local.y * frame.n.x,
    y: local.x * frame.u.y + local.y * frame.n.y
  };
}

/** Terrain vers le repère local : x le long de la corde, y vers la gauche. */
export function toLocal(frame: Frame, point: Point): Point {
  const dx = point.x - frame.origin.x;
  const dy = point.y - frame.origin.y;
  return {
    x: dx * frame.u.x + dy * frame.u.y,
    y: dx * frame.n.x + dy * frame.n.y
  };
}
