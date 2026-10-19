import type { Page } from '$lib/stores/workspace';
import {
  CAM3D_LIMITS,
  clampCam3dAngles,
  clampPitch,
  clampUserCameraPosition,
  getCam3dPosition,
  normalizeYaw,
  userHorizontalAxes
} from '$lib/utils/camera3d';

export const CAM_NAV = {
  keyStep: 2,
  wheelStep: 1.5,
  altitudeStep: 0.1,
  /** Pointer drag sensitivity (degrees per pixel). */
  yawDegPerPx: 0.35,
  pitchDegPerPx: 0.35
} as const;

export function buildCameraNavPatch(
  page: Page,
  delta: { forward?: number; strafe?: number; altitude?: number }
): Partial<Page> {
  const pos = getCam3dPosition(page);
  const yaw = page.cam3dYaw ?? 0;
  const { forward, right } = userHorizontalAxes(yaw);
  let { x, y, z } = pos;

  const f = delta.forward ?? 0;
  const s = delta.strafe ?? 0;
  const a = delta.altitude ?? 0;

  if (f || s) {
    x += forward.x * f + right.x * s;
    y += forward.y * f + right.y * s;
  }
  if (a) {
    z = clampAltitude(z + a);
  }

  return {
    cam3dPosition: clampUserCameraPosition({ x, y, z }, page.fieldTemplate)
  };
}

function clampAltitude(z: number): number {
  return Math.max(CAM3D_LIMITS.heightMin, Math.min(CAM3D_LIMITS.heightMax, z));
}

/**
 * Wheel deltaY > 0 = scroll down.
 * Molette bas : reculer (−X à 0°) · haut : avancer (+X)
 * Shift+molette bas : droite (+Y) · haut : gauche (−Y)
 * Ctrl+molette bas : descendre (−Z) · haut : monter (+Z)
 */
export function buildCameraWheelPatch(page: Page, e: WheelEvent): Partial<Page> | null {
  if (!e.deltaY) return null;
  const sign = Math.sign(e.deltaY);
  const step = CAM_NAV.wheelStep;

  if (e.ctrlKey) {
    return buildCameraNavPatch(page, { altitude: -sign * CAM_NAV.altitudeStep });
  }
  if (e.shiftKey) {
    return buildCameraNavPatch(page, { strafe: -sign * step });
  }
  return buildCameraNavPatch(page, { forward: -sign * step });
}

export function buildCameraKeyPatch(page: Page, key: string): Partial<Page> | null {
  const step = CAM_NAV.keyStep;
  switch (key) {
    case 'ArrowUp':
      return buildCameraNavPatch(page, { forward: step });
    case 'ArrowDown':
      return buildCameraNavPatch(page, { forward: -step });
    case 'ArrowLeft':
      return buildCameraNavPatch(page, { strafe: -step });
    case 'ArrowRight':
      return buildCameraNavPatch(page, { strafe: step });
    default:
      return null;
  }
}

export function isCameraNavKey(key: string): boolean {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  if (!t) return false;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
}

/**
 * Pointer drag — position X/Y/Z inchangée.
 * Clic+drag : rotation (yaw) · Shift+drag : inclinaison (pitch).
 */
export function buildCameraDragPatch(
  page: Page,
  deltaX: number,
  deltaY: number,
  shiftKey: boolean
): Partial<Page> | null {
  if (!deltaX && !deltaY) return null;
  const angles = clampCam3dAngles({ yaw: page.cam3dYaw, pitch: page.cam3dPitch });
  if (shiftKey) {
    return {
      cam3dPitch: clampPitch(angles.pitch + deltaY * CAM_NAV.pitchDegPerPx)
    };
  }
  if (!deltaX) return null;
  return {
    cam3dYaw: normalizeYaw(angles.yaw - deltaX * CAM_NAV.yawDegPerPx)
  };
}
