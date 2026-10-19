/** Spherical camera position from yaw/pitch/distance around a ground target. */
export function sphericalCameraPosition(
  yaw: number,
  pitch: number,
  distance: number,
  target: { x: number; z: number }
): [number, number, number] {
  const yr = (yaw * Math.PI) / 180;
  const pr = (pitch * Math.PI) / 180;
  return [
    target.x + distance * Math.cos(pr) * Math.sin(yr),
    distance * Math.sin(pr),
    target.z + distance * Math.cos(pr) * Math.cos(yr)
  ];
}

/** Extract yaw/pitch/distance from camera position and target (for persisting OrbitControls). */
export function cameraToSpherical(
  cam: { x: number; y: number; z: number },
  target: { x: number; z: number }
) {
  const dx = cam.x - target.x;
  const dy = cam.y;
  const dz = cam.z - target.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, dy / distance))) * 180) / Math.PI;
  const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
  return { yaw, pitch, distance };
}
