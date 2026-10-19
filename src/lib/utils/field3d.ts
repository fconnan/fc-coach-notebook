import { contentBox, PITCH_W, PITCH_H_FULL, PITCH_H_HALF, type FieldTemplate } from '$lib/utils/fieldBounds';

/** Pixels per metre in display coordinates (10 px = 1 m). */
export const PX_PER_M = 10;

/** Official pitch dimensions in metres (105 × 68 m). */
export const PITCH_M_W = PITCH_W / PX_PER_M;
export const PITCH_M_L = PITCH_H_FULL / PX_PER_M;
export const PITCH_M_L_HALF = PITCH_H_HALF / PX_PER_M;

export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

export interface DisplayPoint {
  x: number;
  y: number;
}

/** Pitch centre in display SVG coordinates for a template. */
export function fieldCenter(template: FieldTemplate): DisplayPoint {
  const b = contentBox(template);
  return { x: b.cx, y: b.cy };
}

/** Display SVG coords → world metres (Y up, ground on XZ plane). */
export function displayToWorld(
  displayX: number,
  displayY: number,
  template: FieldTemplate = 'Complet'
): WorldPoint {
  const c = fieldCenter(template);
  return {
    x: (displayX - c.x) / PX_PER_M,
    y: 0,
    z: (displayY - c.y) / PX_PER_M
  };
}

/** World metres (XZ ground) → display SVG coords. */
export function worldToDisplay(
  worldX: number,
  worldZ: number,
  template: FieldTemplate = 'Complet'
): DisplayPoint {
  const c = fieldCenter(template);
  return {
    x: worldX * PX_PER_M + c.x,
    y: worldZ * PX_PER_M + c.y
  };
}

/** Pitch half-length and width in metres for the active template. */
export function pitchSizeM(template: FieldTemplate) {
  if (template === 'Demi' || template === 'DemiBas') {
    return { length: PITCH_M_L_HALF, width: PITCH_M_W };
  }
  return { length: PITCH_M_L, width: PITCH_M_W };
}

/** Which half of the pitch is visible (for clipping in 3D). */
export function pitchHalfClip(template: FieldTemplate): 'full' | 'top' | 'bottom' {
  if (template === 'Demi') return 'top';
  if (template === 'DemiBas') return 'bottom';
  return 'full';
}
