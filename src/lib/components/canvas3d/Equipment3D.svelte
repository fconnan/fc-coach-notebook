<script lang="ts">
  import { T } from '@threlte/core';
  import type { ComponentElement } from '$lib/stores/workspace';
  import { displayToWorld } from '$lib/utils/field3d';
  import { currentPage } from '$lib/stores/workspace';
  import { beginElementDrag3d } from '$lib/utils/interactions3d';

  let { element, isSelected = false } = $props<{ element: ComponentElement; isSelected?: boolean }>();

  const template = $derived($currentPage?.fieldTemplate ?? 'Complet');
  const world = $derived(displayToWorld(element.position.x, element.position.y, template));
  const angle = $derived(element.angle || 0);
  const col = $derived(element.color || defaultColor(element.type));
  const sc = $derived((element.radius || 14) / 14);

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
    <T.Mesh position={[0, 0.25, 0]} castShadow>
      <T.ConeGeometry args={[0.35, 0.5, 12]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'coneTall'}
    <T.Mesh position={[0, 0.45, 0]} castShadow>
      <T.ConeGeometry args={[0.22, 0.9, 12]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'pole'}
    <T.Mesh position={[0, 1.1, 0]} castShadow>
      <T.CylinderGeometry args={[0.04, 0.04, 2.2, 8]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'hurdle'}
    <T.Mesh position={[0, 0.35, 0]} castShadow>
      <T.BoxGeometry args={[1.2, 0.7, 0.08]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'mannequin'}
    <T.Mesh position={[0, 0.9, 0]} castShadow>
      <T.CapsuleGeometry args={[0.2, 1.2, 4, 8]} />
      <T.MeshStandardMaterial color={col} emissive={selMat} emissiveIntensity={selMat ? 0.3 : 0} />
    </T.Mesh>
  {:else if element.type === 'miniGoal'}
    <T.Mesh position={[0, 0.4, 0]} castShadow>
      <T.BoxGeometry args={[1.8, 0.8, 0.6]} />
      <T.MeshStandardMaterial color="#ffffff" wireframe emissive={selMat} emissiveIntensity={selMat ? 0.5 : 0} />
    </T.Mesh>
  {:else if element.type === 'fullGoal'}
    <T.Mesh position={[0, 1.2, 0]} castShadow>
      <T.BoxGeometry args={[7.32, 2.4, 2.2]} />
      <T.MeshStandardMaterial color="#ffffff" wireframe emissive={selMat} emissiveIntensity={selMat ? 0.5 : 0} />
    </T.Mesh>
  {/if}
</T.Group>
