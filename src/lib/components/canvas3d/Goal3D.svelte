<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import type { Goal3DSpec } from '$lib/utils/pitchMarkings';
  import { GOAL_M } from '$lib/utils/pitchMarkings';
  import { DEFAULT_GOAL_NET_OPACITY } from '$lib/utils/goalVisual';

  let {
    spec,
    width = GOAL_M.width,
    height = GOAL_M.height,
    depth = GOAL_M.depth,
    netOpacity = DEFAULT_GOAL_NET_OPACITY,
    postColor = '#ffffff'
  } = $props<{
    spec: Goal3DSpec;
    width?: number;
    height?: number;
    depth?: number;
    netOpacity?: number;
    postColor?: string;
  }>();

  const hw = $derived(width / 2);
  const post = $derived(Math.max(0.025, Math.min(GOAL_M.postRadius, width * 0.025)));
  const mouthY = $derived(height / 2);
  const dz = $derived(spec.intoGoal.z);
  const backZ = $derived(dz * depth);
  const netMat = $derived({
    color: postColor,
    transparent: true,
    opacity: netOpacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });
</script>

<T.Group position.x={spec.mouthCenter.x} position.y={0} position.z={spec.mouthCenter.z}>
  <!-- Front frame: two posts + crossbar -->
  <T.Mesh position={[-hw, mouthY, 0]} castShadow>
    <T.CylinderGeometry args={[post, post, height, 12]} />
    <T.MeshStandardMaterial color={postColor} metalness={0.25} roughness={0.4} />
  </T.Mesh>
  <T.Mesh position={[hw, mouthY, 0]} castShadow>
    <T.CylinderGeometry args={[post, post, height, 12]} />
    <T.MeshStandardMaterial color={postColor} metalness={0.25} roughness={0.4} />
  </T.Mesh>
  <T.Mesh position={[0, height, 0]} castShadow>
    <T.BoxGeometry args={[width + post * 2, post * 2, post * 2]} />
    <T.MeshStandardMaterial color={postColor} metalness={0.25} roughness={0.4} />
  </T.Mesh>

  <!-- Net faces: top, left, right, back (solid transparent — no wireframe) -->
  <T.Mesh position={[-hw, mouthY, backZ / 2]} rotation.y={Math.PI / 2}>
    <T.PlaneGeometry args={[depth, height]} />
    <T.MeshStandardMaterial {...netMat} />
  </T.Mesh>
  <T.Mesh position={[hw, mouthY, backZ / 2]} rotation.y={-Math.PI / 2}>
    <T.PlaneGeometry args={[depth, height]} />
    <T.MeshStandardMaterial {...netMat} />
  </T.Mesh>
  <T.Mesh position={[0, height, backZ / 2]} rotation.x={-Math.PI / 2}>
    <T.PlaneGeometry args={[width, depth]} />
    <T.MeshStandardMaterial {...netMat} />
  </T.Mesh>
  <T.Mesh position={[0, mouthY, backZ]} rotation.y={dz > 0 ? Math.PI : 0}>
    <T.PlaneGeometry args={[width, height]} />
    <T.MeshStandardMaterial {...netMat} />
  </T.Mesh>
</T.Group>
