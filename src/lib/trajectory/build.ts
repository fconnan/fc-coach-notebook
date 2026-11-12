import { curvePath, lineSpine, smoothSpine, unit, type Spine } from './center';
import { frameOf, toGlobal, toLocal, vectorGlobal, type Frame } from './frame';
import { motifOf } from './motif';
import { TrajectoryError, type GeneratedPath, type Point, type TrajectoryDef } from './types';

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

function command(points: Point[]): string {
  if (points.length < 2) return '';
  const parts = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];
  if (points.length === 2) {
    parts.push(`L ${fmt(points[1].x)} ${fmt(points[1].y)}`);
    return parts.join(' ');
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    parts.push(`C ${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2.x)} ${fmt(p2.y)}`);
  }
  return parts.join(' ');
}

function viasOf(def: TrajectoryDef): Point[] {
  return (def.via || []).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function spineOf(def: TrajectoryDef, frame: Frame): Spine {
  const via = viasOf(def);
  if (!via.length) return lineSpine(frame.chord);
  return smoothSpine([
    { x: 0, y: 0 },
    ...via.map(point => toLocal(frame, point)),
    { x: frame.chord, y: 0 }
  ]);
}

function empty(start: Point): GeneratedPath {
  return {
    d: '',
    line: '',
    length: 0,
    start,
    end: start,
    startTangent: { x: 1, y: 0 },
    endTangent: { x: 1, y: 0 },
    pointAt: () => ({ ...start })
  };
}

/** Géométrie pure : mêmes entrées, même tracé. Le style n'entre pas ici. */
export function generateTrajectory(def: TrajectoryDef): GeneratedPath {
  if (!Number.isFinite(def.start.x) || !Number.isFinite(def.start.y) || !Number.isFinite(def.end.x) || !Number.isFinite(def.end.y)) {
    throw new TrajectoryError('Coordonnées invalides');
  }
  const frame = frameOf(def.start, def.end);
  if (!frame) return empty(def.start);
  const spine = spineOf(def, frame);
  const line = curvePath([def.start, ...viasOf(def), def.end]);
  const motif = motifOf(
    def.motif || 'none',
    spine.length,
    def.amp || 0,
    def.wave || 0,
    def.phase || 0,
    def.side === -1 ? -1 : 1,
    Math.max(def.taper || 0, 0),
    Math.max(def.neck || 0, 0)
  );
  const trim = Math.max(def.trim || 0, 0);
  const drawn = Math.max(spine.length - trim, spine.length * 0.5);
  const globalAt = (distance: number) => {
    const local = spine.pointAt(distance);
    const tangent = spine.tangentAt(distance);
    const side = motif ? motif.at(distance) : 0;
    return toGlobal(frame, { x: local.x - tangent.y * side, y: local.y + tangent.x * side });
  };
  const tangentAt = (distance: number) => unit(vectorGlobal(frame, spine.tangentAt(distance)));
  const step = motif
    ? Math.min(motif.wave / 16, Math.max(drawn / 12, 0.02))
    : Math.max(drawn / 32, 0.05);
  const d = motif || trim > 0 ? command(track(globalAt, Math.min(drawn, spine.length), step)) : line;
  return {
    d,
    line,
    length: spine.length,
    start: { ...def.start },
    end: { ...def.end },
    startTangent: tangentAt(0),
    endTangent: tangentAt(spine.length),
    pointAt: fraction => {
      const t = Math.max(0, Math.min(fraction, 1));
      const local = spine.pointAt(t * spine.length);
      return toGlobal(frame, local);
    }
  };
}

function track(at: (distance: number) => Point, length: number, step: number): Point[] {
  const count = Math.max(2, Math.ceil(length / Math.max(step, 0.02)));
  const points: Point[] = [];
  for (let i = 0; i <= count; i += 1) points.push(at((length * i) / count));
  return points;
}
