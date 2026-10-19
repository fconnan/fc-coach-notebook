import type { PlayerPostureId } from '$lib/utils/playerPostures';

/** Map posture id to GLTF animation clip name (Xbot / Mixamo-style rigs). */
export const POSTURE_ANIMATION: Partial<Record<PlayerPostureId, string>> = {
  standing: 'idle',
  ready: 'idle',
  running: 'run',
  running_back: 'run',
  dribbling: 'walk',
  kicking: 'punch',
  jumping: 'jump',
  side_step: 'walk',
  defensive: 'idle',
  gk_ready: 'idle',
  gk_diving: 'fall'
};

/** Fallback clip search order when exact name missing. */
export const ANIMATION_FALLBACKS = ['idle', 'walk', 'run', 'agree', 'idle'];

export function pickAnimationClip(
  animations: { name: string }[],
  posture: PlayerPostureId
): string | undefined {
  const preferred = POSTURE_ANIMATION[posture];
  if (preferred) {
    const hit = animations.find((a) => a.name.toLowerCase().includes(preferred.toLowerCase()));
    if (hit) return hit.name;
  }
  for (const fb of ANIMATION_FALLBACKS) {
    const hit = animations.find((a) => a.name.toLowerCase().includes(fb));
    if (hit) return hit.name;
  }
  return animations[0]?.name;
}

/** Apply team colours to loaded GLTF materials (best-effort name heuristics). */
export function tintPlayerMaterials(
  root: import('three').Object3D,
  shirt: string,
  shortCol: string,
  skin: string
) {
  root.traverse((obj) => {
    const mesh = obj as import('three').Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as import('three').MeshStandardMaterial;
      if (!m.color) continue;
      const n = (mesh.name + mat.name).toLowerCase();
      if (n.includes('skin') || n.includes('head') || n.includes('face')) {
        m.color.set(skin);
      } else if (n.includes('short') || n.includes('pant')) {
        m.color.set(shortCol);
      } else if (n.includes('shirt') || n.includes('body') || n.includes('torso')) {
        m.color.set(shirt);
      }
    }
  });
}
