/**
 * Quantize orientation to sprite sheet yaw frames.
 * Full turn 0..345 step 15 (24 frames). No mirroring — assets cover all angles.
 * Convention: 0° = front; increasing yaw = character turns to THEIR LEFT
 * (0 → left 3/4 → left profile 90° → back 180° → right profile 270° → front).
 */
export const YAW_STEP = 15;
export const YAW_COUNT = 24; // 360 / 15

/** Canonical yaw list stored in sheets left → right. */
export const YAW_STEPS: number[] = Array.from(
  { length: YAW_COUNT },
  (_, i) => i * YAW_STEP
); // 0,15,...,345

export function resolveYaw(
  angleDeg: number,
  available: number[] = YAW_STEPS
): { yaw: number; flip: boolean; frameIndex: number } {
  let a = ((angleDeg % 360) + 360) % 360;
  // Snap to 15° grid
  const stepped = (Math.round(a / YAW_STEP) * YAW_STEP) % 360;

  if (available.length === 0) {
    return { yaw: stepped, flip: false, frameIndex: 0 };
  }

  let best = available[0];
  let bestD = Infinity;
  let bestI = 0;
  for (let i = 0; i < available.length; i++) {
    const y = available[i];
    // Circular distance on 0..360
    let d = Math.abs(y - stepped);
    if (d > 180) d = 360 - d;
    if (d < bestD) {
      bestD = d;
      best = y;
      bestI = i;
    }
  }
  return { yaw: best, flip: false, frameIndex: bestI };
}
