/** Default perspective settings (match original CSS look). */
export const PERSPECTIVE_DEFAULTS = {
  tilt: 34,
  intensity: 62,
  scale: 0.86
} as const;

/** Map UI intensity (0 = léger, 100 = prononcé) to CSS perspective distance (px). */
export function perspectiveDistancePx(intensity: number): number {
  const t = Math.max(0, Math.min(100, intensity)) / 100;
  return Math.round(2800 - t * 2100); // 2800px → 700px
}

export function resolvePerspective(page: {
  perspectiveTilt?: number;
  perspectiveIntensity?: number;
  perspectiveScale?: number;
}) {
  const tilt = page.perspectiveTilt ?? PERSPECTIVE_DEFAULTS.tilt;
  const intensity = page.perspectiveIntensity ?? PERSPECTIVE_DEFAULTS.intensity;
  const scale = page.perspectiveScale ?? PERSPECTIVE_DEFAULTS.scale;
  return {
    tilt,
    intensity,
    scale,
    distancePx: perspectiveDistancePx(intensity)
  };
}
