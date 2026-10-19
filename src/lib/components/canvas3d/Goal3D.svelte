<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import type { Goal3DSpec } from '$lib/utils/pitchMarkings';
  import { GOAL_M } from '$lib/utils/pitchMarkings';

  let { spec } = $props<{ spec: Goal3DSpec }>();

  const hw = GOAL_M.width / 2;
  const post = GOAL_M.postRadius;
  const mouthY = GOAL_M.height / 2;
  const dz = $derived(spec.intoGoal.z);
</script>

<T.Group position.x={spec.mouthCenter.x} position.y={0} position.z={spec.mouthCenter.z}>
  <T.Mesh position={[-hw, mouthY, 0]} castShadow>
    <T.CylinderGeometry args={[post, post, GOAL_M.height, 12]} />
    <T.MeshStandardMaterial color="#ffffff" metalness={0.25} roughness={0.4} />
  </T.Mesh>
  <T.Mesh position={[hw, mouthY, 0]} castShadow>
    <T.CylinderGeometry args={[post, post, GOAL_M.height, 12]} />
    <T.MeshStandardMaterial color="#ffffff" metalness={0.25} roughness={0.4} />
  </T.Mesh>
  <T.Mesh position={[0, GOAL_M.height, 0]} castShadow>
    <T.BoxGeometry args={[GOAL_M.width + post * 2, post * 2, post * 2]} />
    <T.MeshStandardMaterial color="#ffffff" metalness={0.25} roughness={0.4} />
  </T.Mesh>
  <T.Mesh position={[-hw, mouthY, dz * GOAL_M.depth]} castShadow>
    <T.CylinderGeometry args={[post * 0.85, post * 0.85, GOAL_M.height, 12]} />
    <T.MeshStandardMaterial color="#f0f0f0" metalness={0.2} roughness={0.45} />
  </T.Mesh>
  <T.Mesh position={[hw, mouthY, dz * GOAL_M.depth]} castShadow>
    <T.CylinderGeometry args={[post * 0.85, post * 0.85, GOAL_M.height, 12]} />
    <T.MeshStandardMaterial color="#f0f0f0" metalness={0.2} roughness={0.45} />
  </T.Mesh>
  <T.Mesh position={[0, GOAL_M.height, dz * GOAL_M.depth]} castShadow>
    <T.BoxGeometry args={[GOAL_M.width + post * 2, post * 2, post * 2]} />
    <T.MeshStandardMaterial color="#f0f0f0" metalness={0.2} roughness={0.45} />
  </T.Mesh>
  <T.Mesh position={[-hw, post, dz * (GOAL_M.depth / 2)]} castShadow>
    <T.BoxGeometry args={[post * 2, post * 2, GOAL_M.depth]} />
    <T.MeshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.45} />
  </T.Mesh>
  <T.Mesh position={[hw, post, dz * (GOAL_M.depth / 2)]} castShadow>
    <T.BoxGeometry args={[post * 2, post * 2, GOAL_M.depth]} />
    <T.MeshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.45} />
  </T.Mesh>
  <T.Mesh position={[0, mouthY, dz * (GOAL_M.depth / 2)]}>
    <T.BoxGeometry args={[GOAL_M.width, GOAL_M.height, GOAL_M.depth]} />
    <T.MeshStandardMaterial
      color="#ffffff"
      transparent
      opacity={0.18}
      wireframe
      side={THREE.DoubleSide}
    />
  </T.Mesh>
  <T.Mesh position={[0, GOAL_M.height, dz * (GOAL_M.depth / 2)]} rotation.x={Math.PI / 2}>
    <T.PlaneGeometry args={[GOAL_M.width, GOAL_M.depth]} />
    <T.MeshStandardMaterial color="#ffffff" transparent opacity={0.12} wireframe side={THREE.DoubleSide} />
  </T.Mesh>
  <T.Mesh position={[0, mouthY, dz * GOAL_M.depth]} rotation.y={Math.PI / 2}>
    <T.PlaneGeometry args={[GOAL_M.depth, GOAL_M.height]} />
    <T.MeshStandardMaterial color="#ffffff" transparent opacity={0.14} wireframe side={THREE.DoubleSide} />
  </T.Mesh>
</T.Group>
