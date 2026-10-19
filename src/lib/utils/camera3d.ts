import { PITCH, PX_PER_M } from '$lib/utils/pitchMarkings';
import {
  PITCH_M_L,
  PITCH_M_W,
  type UserPoint,
  threeToUser,
  userToThree,
  resolveOrbitTargetWorld
} from '$lib/utils/field3d';
import type { Page } from '$lib/stores/workspace';

const PITCH_LENGTH_M = PITCH.lengthPx / PX_PER_M;

/** Allowed 3D camera ranges (stored in page settings). */
export const CAM3D_LIMITS = {
  yawMin: 0,
  yawMax: 360,
  pitchMin: 0,
  pitchMax: 90,
  heightMin: 0,
  heightMax: Math.round(PITCH_LENGTH_M * 2)
} as const;

export const CAM3D_DEFAULTS = {
  yaw: 45,
  pitch: 55
} as const;

/** Legacy orbit radius used only when migrating old pages. */
const LEGACY_ORBIT_RADIUS = Math.round(PITCH_LENGTH_M * 0.9);

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalizeYaw(yaw: number): number {
  const y = ((Math.round(yaw) % 360) + 360) % 360;
  return clamp(y, CAM3D_LIMITS.yawMin, CAM3D_LIMITS.yawMax);
}

export function clampPitch(pitch: number): number {
  return clamp(Math.round(pitch), CAM3D_LIMITS.pitchMin, CAM3D_LIMITS.pitchMax);
}

export function clampCam3dAngles(settings: {
  yaw?: number;
  pitch?: number;
}): { yaw: number; pitch: number } {
  return {
    yaw: normalizeYaw(settings.yaw ?? CAM3D_DEFAULTS.yaw),
    pitch: clampPitch(settings.pitch ?? CAM3D_DEFAULTS.pitch)
  };
}

export function clampUserCameraPosition(
  pos: UserPoint,
  _template: Page['fieldTemplate'] = 'Complet'
): UserPoint {
  const halfW = PITCH_M_W / 2;
  const halfL = PITCH_M_L / 2;
  const margin = 8;
  return {
    x: clamp(pos.x, -halfL - margin, halfL + margin),
    y: clamp(pos.y, -halfW - margin, halfW + margin),
    z: clamp(pos.z, CAM3D_LIMITS.heightMin, CAM3D_LIMITS.heightMax)
  };
}

/** Horizontal forward / right at yaw 0° → +X / +Y (longueur / largeur). */
export function userHorizontalAxes(yaw: number) {
  const yr = (normalizeYaw(yaw) * Math.PI) / 180;
  return {
    forward: { x: Math.cos(yr), y: Math.sin(yr), z: 0 },
    right: { x: -Math.sin(yr), y: Math.cos(yr), z: 0 }
  };
}

/** Unit view direction in user coords (pitch 0° = horizon, 90° = straight down). */
export function userViewDirection(yaw: number, pitch: number): UserPoint {
  const { yaw: y, pitch: p } = clampCam3dAngles({ yaw, pitch });
  const yr = (y * Math.PI) / 180;
  const pr = (p * Math.PI) / 180;
  return {
    x: Math.cos(pr) * Math.cos(yr),
    y: Math.cos(pr) * Math.sin(yr),
    z: -Math.sin(pr)
  };
}

/** Ground look-at point from camera position and orientation. */
export function userLookAtOnGround(cam: UserPoint, yaw: number, pitch: number): { x: number; y: number } {
  const dir = userViewDirection(yaw, pitch);
  if (dir.z >= -1e-6) {
    const h = Math.hypot(dir.x, dir.y) || 1;
    return { x: cam.x + (dir.x / h) * 100, y: cam.y + (dir.y / h) * 100 };
  }
  const t = -cam.z / dir.z;
  return { x: cam.x + dir.x * t, y: cam.y + dir.y * t };
}

/** Yaw / pitch from camera position and a ground target (z = 0). */
export function userYawPitchFromLookAt(
  cam: UserPoint,
  ground: { x: number; y: number }
): { yaw: number; pitch: number } {
  const dx = ground.x - cam.x;
  const dy = ground.y - cam.y;
  const hdist = Math.hypot(dx, dy);
  const pitch =
    hdist < 1e-6 ? 90 : clampPitch((Math.atan2(cam.z, hdist) * 180) / Math.PI);
  const yaw = normalizeYaw((Math.atan2(dy, dx) * 180) / Math.PI);
  return { yaw, pitch };
}

export function getCam3dPosition(page: Pick<Page, 'cam3dPosition'>): UserPoint {
  if (
    page.cam3dPosition &&
    typeof page.cam3dPosition.x === 'number' &&
    typeof page.cam3dPosition.y === 'number' &&
    typeof page.cam3dPosition.z === 'number'
  ) {
    return page.cam3dPosition;
  }
  return defaultCam3dPosition();
}

/** Three.js camera position from page settings. */
export function pageToThreeCameraPosition(page: Page): [number, number, number] {
  const pos = getCam3dPosition(page);
  const t = userToThree(pos);
  return [t.x, t.y, t.z];
}

/** Three.js orbit target on the ground from page settings. */
export function pageToThreeOrbitTarget(page: Page): [number, number, number] {
  const pos = getCam3dPosition(page);
  const angles = clampCam3dAngles({ yaw: page.cam3dYaw, pitch: page.cam3dPitch });
  const look = userLookAtOnGround(pos, angles.yaw, angles.pitch);
  const t = userToThree({ x: look.x, y: look.y, z: 0 });
  return [t.x, t.y, t.z];
}

/** Default camera position (legacy orbit around pitch centre). */
export function defaultCam3dPosition(): UserPoint {
  const [tx, ty, tz] = legacySphericalCameraPosition(
    CAM3D_DEFAULTS.yaw,
    CAM3D_DEFAULTS.pitch,
    LEGACY_ORBIT_RADIUS,
    { x: 0, z: 0 }
  );
  return threeToUser({ x: tx, y: ty, z: tz });
}

/** Migrate legacy orbit settings to user position + yaw/pitch. */
export function migrateCam3dToUser(page: Page): Pick<Page, 'cam3dPosition' | 'cam3dYaw' | 'cam3dPitch'> {
  if (
    page.cam3dPosition &&
    typeof page.cam3dPosition.x === 'number' &&
    typeof page.cam3dPosition.y === 'number' &&
    typeof page.cam3dPosition.z === 'number'
  ) {
    const angles = clampCam3dAngles({ yaw: page.cam3dYaw, pitch: page.cam3dPitch });
    return {
      cam3dPosition: clampUserCameraPosition(page.cam3dPosition, page.fieldTemplate),
      cam3dYaw: angles.yaw,
      cam3dPitch: angles.pitch
    };
  }

  const targetThree = resolveOrbitTargetWorld(
    page.fieldTemplate,
    page.cam3dTarget,
    page.cam3dDistance
  );
  const angles = clampCam3dAngles({ yaw: page.cam3dYaw, pitch: page.cam3dPitch });
  const radius =
    typeof page.cam3dRadius === 'number' && page.cam3dRadius >= 0
      ? page.cam3dRadius
      : LEGACY_ORBIT_RADIUS;
  const [tx, ty, tz] = legacySphericalCameraPosition(
    angles.yaw,
    angles.pitch,
    radius,
    targetThree
  );
  const position = threeToUser({ x: tx, y: ty, z: tz });
  const lookUser = { x: targetThree.z, y: targetThree.x };
  const oriented = userYawPitchFromLookAt(position, lookUser);
  return {
    cam3dPosition: clampUserCameraPosition(position, page.fieldTemplate),
    cam3dYaw: oriented.yaw,
    cam3dPitch: oriented.pitch
  };
}

/** Legacy UI yaw → orbit yaw (kept for migration). */
function legacyOrbitYawFromUi(uiYaw: number): number {
  return normalizeYaw(180 - normalizeYaw(uiYaw));
}

function legacySphericalCameraPosition(
  yaw: number,
  pitch: number,
  radius: number,
  target: { x: number; z: number }
): [number, number, number] {
  const { yaw: yUi, pitch: p } = clampCam3dAngles({ yaw, pitch });
  const y = legacyOrbitYawFromUi(yUi);
  const r = Math.max(0, Math.round(radius));
  const yr = (y * Math.PI) / 180;
  const pr = (p * Math.PI) / 180;
  return [
    target.x + r * Math.cos(pr) * Math.sin(yr),
    r * Math.sin(pr),
    target.z + r * Math.cos(pr) * Math.cos(yr)
  ];
}

/** Migrate legacy pages where cam3dDistance stored orbit radius (10–210). */
export function migrateCam3dDistance(
  distance: number | undefined,
  radius: number | undefined
): { offsetZ: number; radius: number } {
  const offsetMin = -60;
  const offsetMax = 60;
  let offsetZ = typeof distance === 'number' ? distance : 0;
  let r = typeof radius === 'number' ? radius : LEGACY_ORBIT_RADIUS;
  if (offsetZ > offsetMax || offsetZ < offsetMin) {
    r = Math.max(0, Math.round(offsetZ));
    offsetZ = 0;
  }
  return { offsetZ, radius: Math.max(0, Math.round(r)) };
}

export const ORBIT_POLAR = {
  min: 0,
  max: Math.PI / 2
} as const;

export const ORBIT_AZIMUTH = {
  min: Number.NEGATIVE_INFINITY,
  max: Number.POSITIVE_INFINITY
} as const;

export { PITCH_LENGTH_M };
