import type { ElementType } from '$lib/stores/workspace';
import type { FieldTemplate } from '$lib/utils/fieldBounds';
import { contentBox } from '$lib/utils/fieldBounds';
import { resolvePerspective } from '$lib/utils/perspective';

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Depth scale at this ground point (1 = at pivot). */
  scale: number;
  /** Depth for painter's sort (larger = nearer camera). */
  depth: number;
}

export interface Projector {
  pivotX: number;
  pivotY: number;
  tilt: number;
  globalScale: number;
  projectGround(x: number, y: number): ProjectedPoint;
  projectPoints(points: { x: number; y: number }[]): ProjectedPoint[];
  projectPolyline(points: { x: number; y: number }[]): string;
  projectRect(x: number, y: number, w: number, h: number): string;
}

/** Elements drawn flat on the pitch surface (geometry is projected). */
export const FLAT_ELEMENT_TYPES: ElementType[] = [
  'ball',
  'arrow',
  'text',
  'callout',
  'rect',
  'ellipse',
  'zone',
  'ring',
  'ladder'
];

/** Elements drawn as upright billboards (anchor projected, sprite stays vertical). */
export const STANDING_ELEMENT_TYPES: ElementType[] = [
  'player',
  'cone',
  'coneTall',
  'pole',
  'hurdle',
  'mannequin',
  'miniGoal',
  'fullGoal'
];

export function isFlatElement(type: ElementType): boolean {
  return FLAT_ELEMENT_TYPES.includes(type);
}

export function isStandingElement(type: ElementType): boolean {
  return STANDING_ELEMENT_TYPES.includes(type);
}

/** Map player orientation (0 = toward far goal / screen-up) to sprite facing. */
export function spriteFacing(
  angle: number,
  posture: string
): 'front' | 'back' | 'side-right' | 'side-left' {
  if (posture === 'running_back') return 'back';
  const a = ((angle % 360) + 360) % 360;
  if (a >= 135 && a < 225) return 'back';
  if (a >= 45 && a < 135) return 'side-right';
  if (a >= 225 && a < 315) return 'side-left';
  return 'front';
}

export function createProjector(
  template: FieldTemplate,
  page: {
    perspectiveTilt?: number;
    perspectiveIntensity?: number;
    perspectiveScale?: number;
  }
): Projector {
  const box = contentBox(template);
  const persp = resolvePerspective(page);
  const tiltRad = (persp.tilt * Math.PI) / 180;
  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);
  const pivotX = box.cx;
  const pivotY = box.cy - box.H / 2 + box.H * 0.58;
  const focal = 900 + ((100 - persp.intensity) / 100) * 1400;
  const globalScale = persp.scale;

  function projectGround(x: number, y: number): ProjectedPoint {
    const relX = x - pivotX;
    const relY = pivotY - y;
    const zDepth = relY * sinT;
    const yFlat = -relY * cosT;
    const perspScale = focal / (focal + zDepth);
    const scale = perspScale * globalScale;
    return {
      x: pivotX + relX * perspScale * globalScale,
      y: pivotY + yFlat * perspScale * globalScale,
      scale,
      depth: zDepth
    };
  }

  return {
    pivotX,
    pivotY,
    tilt: persp.tilt,
    globalScale,
    projectGround,
    projectPoints(points: { x: number; y: number }[]) {
      return points.map((p) => projectGround(p.x, p.y));
    },
    projectPolyline(points: { x: number; y: number }[]) {
      if (points.length === 0) return '';
      const proj = points.map((p) => projectGround(p.x, p.y));
      return proj.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    },
    projectRect(x: number, y: number, w: number, h: number) {
      const corners = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ];
      const proj = corners.map((p) => projectGround(p.x, p.y));
      return proj.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
    }
  };
}
