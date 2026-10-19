<script lang="ts">
  import { T } from '@threlte/core';
  import type { ComponentElement } from '$lib/stores/workspace';
  import { currentPage } from '$lib/stores/workspace';
  import { displayToWorld } from '$lib/utils/field3d';
  import { beginElementDrag3d } from '$lib/utils/interactions3d';

  let { element, isSelected = false } = $props<{ element: ComponentElement; isSelected?: boolean }>();

  const template = $derived($currentPage?.fieldTemplate ?? 'Complet');
  const world = $derived(displayToWorld(element.position.x, element.position.y, template));
  const c = $derived(element.color || '#ffffff');
  const r = $derived(element.radius || $currentPage.ballSize);
  const ballColor = $derived(element.color || $currentPage.ballColor);
  const s = $derived(r / 8);

  function onPointerDown(e: PointerEvent & { stopPropagation: () => void }) {
    e.stopPropagation();
    beginElementDrag3d(e, element);
  }
</script>

<T.Group position.x={world.x} position.y={s} position.z={world.z} scale={s}>
  <T.Mesh castShadow receiveShadow onclick={onPointerDown} onpointerdown={onPointerDown}>
    <T.SphereGeometry args={[1, 16, 16]} />
    <T.MeshStandardMaterial color={ballColor} />
  </T.Mesh>
  {#if isSelected}
    <T.Mesh>
      <T.SphereGeometry args={[1.15, 12, 12]} />
      <T.MeshBasicMaterial color="#5e6ad2" wireframe />
    </T.Mesh>
  {/if}
</T.Group>
