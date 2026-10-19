import { PITCH, PX_PER_M } from '$lib/utils/pitchMarkings';

const PITCH_LENGTH_M = PITCH.lengthPx / PX_PER_M;
const HALF_LENGTH_M = PITCH_LENGTH_M / 2;

/** Allowed 3D camera ranges (stored in page settings). */
export const CAM3D_LIMITS = {
  yawMin: 0,
  yawMax: 180,
  pitchMin: 0,
  pitchMax: 90,
  /** Longitudinal offset from pitch centre along the field axis (m). */
  offsetMin: -60,
  offsetMax: 60
} as const;

/** Orbit radius (zoom) — mouse wheel only, not the sidebar « distance » slider. */
export const ORBIT_RADIUS = {
  default: Math.round(PITCH_LENGTH_M * 0.9),
  min: 15,
  max: Math.round(PITCH_LENGTH_M * 2)
} as const;

export const CAM3D_DEFAULTS = {
  yaw: 45,
  pitch: 55,
  offsetZ: 0,
  radius: ORBIT_RADIUS.default
} as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalizeYaw(yaw: number): number {
  let y = ((yaw % 360) + 360) % 360;
  if (y > 180) y = 360 - y;
  return clamp(Math.round(y), CAM3D_LIMITS.yawMin, CAM3D_LIMITS.yawMax);
}

export function clampPitch(pitch: number): number {
  return clamp(Math.round(pitch), CAM3D_LIMITS.pitchMin, CAM3D_LIMITS.pitchMax);
}

/** Sidebar « distance » = position le long du terrain (m). */
export function clampOffsetZ(offset: number): number {
  return clamp(Math.round(offset), CAM3D_LIMITS.offsetMin, CAM3D_LIMITS.offsetMax);
}

export function clampOrbitRadius(radius: number): number {
  return clamp(Math.round(radius), ORBIT_RADIUS.min, ORBIT_RADIUS.max);
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

/** Camera position: orbit around target with given radius; pitch 0=horizon, 90=top-down. */
export function sphericalCameraPosition(
  yaw: number,
  pitch: number,
  radius: number,
  target: { x: number; z: number }
): [number, number, number] {
  const { yaw: y, pitch: p } = clampCam3dAngles({ yaw, pitch });
  const r = clampOrbitRadius(radius);
  const yr = (y * Math.PI) / 180;
  const pr = (p * Math.PI) / 180;
  return [
    target.x + r * Math.cos(pr) * Math.sin(yr),
    r * Math.sin(pr),
    target.z + r * Math.cos(pr) * Math.cos(yr)
  ];
}

/** Read yaw/pitch/radius from camera — does NOT touch longitudinal offset. */
export function cameraToSpherical(
  cam: { x: number; y: number; z: number },
  target: { x: number; z: number }
) {
  const dx = cam.x - target.x;
  const dy = cam.y;
  const dz = cam.z - target.z;
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const pitch = (Math.asin(Math.max(0, Math.min(1, dy / radius))) * 180) / Math.PI;
  const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
  return {
    ...clampCam3dAngles({ yaw, pitch }),
    radius: clampOrbitRadius(radius)
  };
}

export const ORBIT_POLAR = {
  min: 0,
  max: Math.PI / 2
} as const;

export const ORBIT_AZIMUTH = {
  min: 0,
  max: Math.PI
} as const;

export function cam3dOffsetHint(): string {
  return `−${Math.abs(CAM3D_LIMITS.offsetMin)} m → but défense · 0 = centre · +${CAM3D_LIMITS.offsetMax} m → but attaque (terrain ${PITCH_LENGTH_M} m)`;
}

/** Migrate legacy pages where cam3dDistance stored orbit radius (10–210). */
export function migrateCam3dDistance(
  distance: number | undefined,
  radius: number | undefined
): { offsetZ: number; radius: number } {
  let offsetZ = typeof distance === 'number' ? distance : CAM3D_DEFAULTS.offsetZ;
  let r = typeof radius === 'number' ? radius : CAM3D_DEFAULTS.radius;
  if (offsetZ > CAM3D_LIMITS.offsetMax || offsetZ < CAM3D_LIMITS.offsetMin) {
    r = clampOrbitRadius(offsetZ);
    offsetZ = CAM3D_DEFAULTS.offsetZ;
  }
  return { offsetZ: clampOffsetZ(offsetZ), radius: clampOrbitRadius(r) };
}

export { PITCH_LENGTH_M, HALF_LENGTH_M };
