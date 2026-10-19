<script lang="ts">
  import { T } from '@threlte/core';
  import type { ComponentElement } from '$lib/stores/workspace';
  import { currentPage } from '$lib/stores/workspace';
  import { displayToWorld } from '$lib/utils/field3d';
  import { BALL_RADIUS_M } from '$lib/utils/pitchMarkings';
  import { beginElementDrag3d } from '$lib/utils/interactions3d';

  let { element, isSelected = false } = $props<{ element: ComponentElement; isSelected?: boolean }>();

  const template = $derived($currentPage?.fieldTemplate ?? 'Complet');
  const world = $derived(displayToWorld(element.position.x, element.position.y, template));
  const ballColor = $derived(element.color || $currentPage.ballColor);

  function onPointerDown(e: PointerEvent & { stopPropagation: () => void }) {
    e.stopPropagation();
    beginElementDrag3d(e, element);
  }
</script>

<T.Group position.x={world.x} position.y={BALL_RADIUS_M} position.z={world.z}>
  <T.Mesh castShadow receiveShadow onclick={onPointerDown} onpointerdown={onPointerDown}>
    <T.SphereGeometry args={[BALL_RADIUS_M, 20, 20]} />
    <T.MeshStandardMaterial color={ballColor} />
  </T.Mesh>
  {#if isSelected}
    <T.Mesh>
      <T.SphereGeometry args={[BALL_RADIUS_M * 1.15, 16, 16]} />
      <T.MeshBasicMaterial color="#5e6ad2" wireframe />
    </T.Mesh>
  {/if}
</T.Group>
