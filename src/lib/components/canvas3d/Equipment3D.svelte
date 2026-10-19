<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import type { ComponentElement } from '$lib/stores/workspace';
  import { displayToWorld } from '$lib/utils/field3d';
  import { currentPage } from '$lib/stores/workspace';
  import { EQUIPMENT_3D, equipmentScaleFactor } from '$lib/utils/pitchMarkings';
  import { beginElementDrag3d } from '$lib/utils/interactions3d';
  import Goal3D from './Goal3D.svelte';

  let { element, isSelected = false } = $props<{ element: ComponentElement; isSelected?: boolean }>();

  const template = $derived($currentPage?.fieldTemplate ?? 'Complet');
  const world = $derived(displayToWorld(element.position.x, element.position.y, template));
  const angle = $derived(element.angle || 0);
  const col = $derived(element.color || defaultColor(element.type));
  const sc = $derived(equipmentScaleFactor(element.radius));

  function defaultColor(type: string): string {
    switch (type) {
      case 'cone': return '#e6442e';
      case 'coneTall': return '#ff7a00';
      case 'pole': return '#e6442e';
      case 'hurdle': return '#e6442e';
      case 'mannequin': return '#f5b000';
      default: return '#ffffff';
    }
  }

  function onPointerDown(e: PointerEvent & { stopPropagation: () => void }) {
    e.stopPropagation();
    beginElementDrag3d(e, element);
  }

  const selMat = $derived(isSelected ? '#5e6ad2' : undefined);
  const e = EQUIPMENT_3D;
</script>

<T.Group
  position.x={world.x}
  position.y={0}
  position.z={world.z}
  rotation.y={(-angle * Math.PI) / 180}
  scale={sc}
  onclick={onPointerDown}
  onpointerdown={onPointerDown}
>
  {#if element.type === 'cone'}
    {@const s = e.cone}
    <T.Mesh position={[0, s.height / 2, 0]} castShadow>
      <T.ConeGeometry args={[s.radius, s.height, 12]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'coneTall'}
    {@const s = e.coneTall}
    <T.Mesh position={[0, s.height / 2, 0]} castShadow>
      <T.ConeGeometry args={[s.radius, s.height, 12]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'pole'}
    {@const s = e.pole}
    <T.Mesh position={[0, s.height / 2, 0]} castShadow>
      <T.CylinderGeometry args={[s.radius, s.radius, s.height, 8]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'hurdle'}
    {@const s = e.hurdle}
    <T.Mesh position={[0, s.height / 2, 0]} castShadow>
      <T.BoxGeometry args={[s.width, s.height, s.depth]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'mannequin'}
    {@const s = e.mannequin}
    <T.Mesh position={[0, s.height / 2, 0]} castShadow>
      <T.CapsuleGeometry args={[s.radius, s.height - s.radius * 2, 4, 8]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'miniGoal'}
    {@const s = e.miniGoal}
    {@const hw = s.width / 2}
    {@const post = 0.04}
    <T.Mesh position={[-hw, s.height / 2, 0]} castShadow>
      <T.CylinderGeometry args={[post, post, s.height, 8]} />
      <T.MeshStandardMaterial color="#ffffff" emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
    <T.Mesh position={[hw, s.height / 2, 0]} castShadow>
      <T.CylinderGeometry args={[post, post, s.height, 8]} />
      <T.MeshStandardMaterial color="#ffffff" emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
    <T.Mesh position={[0, s.height, 0]} castShadow>
      <T.BoxGeometry args={[s.width + post * 2, post * 2, post * 2]} />
      <T.MeshStandardMaterial color="#ffffff" emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
    <T.Mesh position={[0, s.height / 2, s.depth / 2]}>
      <T.BoxGeometry args={[s.width, s.height, s.depth]} />
      <T.MeshStandardMaterial color="#ffffff" transparent opacity={0.2} wireframe side={THREE.DoubleSide} />
    </T.Mesh>
  {:else if element.type === 'fullGoal'}
    <Goal3D
      spec={{
        side: 'left',
        mouthCenter: { x: 0, y: 0, z: 0 },
        intoGoal: { x: 0, z: 1 }
      }}
    />
  {/if}
</T.Group>
