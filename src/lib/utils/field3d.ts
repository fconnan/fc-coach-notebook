import { contentBox, PITCH_W, PITCH_H_FULL, PITCH_H_HALF, type FieldTemplate } from '$lib/utils/fieldBounds';
import { PITCH, PX_PER_M as PITCH_PX_PER_M, pitchPxToWorld } from '$lib/utils/pitchMarkings';

/** Pixels per metre in display coordinates (10 px = 1 m). */
export const PX_PER_M = PITCH_PX_PER_M;

/** Official pitch dimensions in metres (105 × 68 m). */
export const PITCH_M_W = PITCH_W / PX_PER_M;
export const PITCH_M_L = PITCH_H_FULL / PX_PER_M;
export const PITCH_M_L_HALF = PITCH_H_HALF / PX_PER_M;

/** Three.js scene coords: X = width, Y = height, Z = length. */
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * User / pitch coords (origin = centre du terrain complet).
 * X = longueur · Y = largeur · Z = hauteur au-dessus du sol.
 */
export interface UserPoint {
  x: number;
  y: number;
  z: number;
}

export function userToThree(p: UserPoint): WorldPoint {
  return { x: p.y, y: p.z, z: p.x };
}

export function threeToUser(p: WorldPoint): UserPoint {
  return { x: p.z, y: p.x, z: p.y };
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

/** Display SVG (vertical pitch layout) → pitch-local px, same as PitchProjected. */
export function displayToPitchLocal(displayX: number, displayY: number): { lx: number; ly: number } {
  return { lx: PITCH.lengthPx - displayY, ly: displayX };
}

/** Display SVG coords → world metres (Y up, ground on XZ). Always uses full-pitch origin (matches pitchPxToWorld / markings). */
export function displayToWorld(
  displayX: number,
  displayY: number,
  _template: FieldTemplate = 'Complet'
): WorldPoint {
  const { lx, ly } = displayToPitchLocal(displayX, displayY);
  const [x, y, z] = pitchPxToWorld(lx, ly, 0);
  return { x, y, z };
}

/** World metres (XZ ground) → display SVG coords. */
export function worldToDisplay(
  worldX: number,
  worldZ: number,
  _template: FieldTemplate = 'Complet'
): DisplayPoint {
  const lx = worldZ * PX_PER_M + PITCH.halfLengthPx;
  const ly = worldX * PX_PER_M + PITCH.halfWidthPx;
  return { x: ly, y: PITCH.lengthPx - lx };
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

export function pitchOrbitTarget(
  template: FieldTemplate,
  offsetZ = 0,
  pan?: { x?: number; z?: number }
): { x: number; z: number } {
  const halfShift = halfFieldZShift(template);
  return {
    x: pan?.x ?? 0,
    z: pan?.z ?? halfShift + offsetZ
  };
}

/** Longitudinal centre offset for half-field templates (world Z). */
export function halfFieldZShift(template: FieldTemplate): number {
  if (template === 'Demi') return -PITCH_M_L_HALF / 2;
  if (template === 'DemiBas') return PITCH_M_L_HALF / 2;
  return 0;
}

/** Ground target from page settings (cam3dTarget.y = world Z). */
export function resolveOrbitTargetWorld(
  template: FieldTemplate,
  cam3dTarget?: { x?: number; y?: number } | null,
  cam3dDistance?: number
): { x: number; z: number } {
  const halfShift = halfFieldZShift(template);
  return {
    x: cam3dTarget?.x ?? 0,
    z: cam3dTarget?.y ?? halfShift + (cam3dDistance ?? 0)
  };
}
