import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Mesh, Object3D, Material } from 'three';
import type { ThrelteGltf } from '@threlte/extras';

export const PLAYER_GLB_URL = '/models/player.glb';

/** Deep-clone a rigged player scene so each Player3D instance has its own mesh. */
export function clonePlayerGltf(base: ThrelteGltf): ThrelteGltf {
  const scene = cloneSkinned(base.scene);
  cloneMaterialsDeep(scene);
  return { ...base, scene: scene as typeof base.scene };
}

function cloneMaterialsDeep(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
  });
}

export function disposePlayerScene(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) (m as Material).dispose?.();
  });
}
