<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import type { ComponentElement } from '$lib/stores/workspace';
  import { currentPage } from '$lib/stores/workspace';
  import { displayToWorld } from '$lib/utils/field3d';
  import { beginElementDrag3d } from '$lib/utils/interactions3d';

  let { element, isSelected = false } = $props<{ element: ComponentElement; isSelected?: boolean }>();

  const template = $derived($currentPage?.fieldTemplate ?? 'Complet');
  const world = $derived(displayToWorld(element.position.x, element.position.y, template));
  const stroke = $derived(element.color || '#ffffff');
  const w = $derived((element.width || 120) / 10);
  const h = $derived((element.height || 80) / 10);
  const angle = $derived(element.angle || 0);

  function onPointerDown(e: PointerEvent & { stopPropagation: () => void }) {
    e.stopPropagation();
    beginElementDrag3d(e, element);
  }

  const arrowPoints = $derived.by(() => {
    if (element.type !== 'arrow') return null;
    const pts = element.pathPoints || [
      element.position,
      element.endPosition || { x: element.position.x + 50, y: element.position.y }
    ];
    const flat: number[] = [];
    for (const p of pts) {
      const wpt = displayToWorld(p.x, p.y, template);
      flat.push(wpt.x, 0.05, wpt.z);
    }
    return new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(flat), 3)
    );
  });
</script>

{#if element.type === 'arrow' && arrowPoints}
  <T.Line
    geometry={arrowPoints}
    onclick={onPointerDown}
    onpointerdown={onPointerDown}
  >
    <T.LineBasicMaterial color={stroke} linewidth={2} />
  </T.Line>
{:else if element.type === 'rect' || element.type === 'zone' || element.type === 'ellipse'}
  <T.Group
    position.x={world.x}
    position.y={0.04}
    position.z={world.z}
    rotation.y={(-angle * Math.PI) / 180}
    onclick={onPointerDown}
    onpointerdown={onPointerDown}
  >
    <T.Mesh rotation.x={-Math.PI / 2}>
      {#if element.type === 'ellipse'}
        <T.CircleGeometry args={[w / 2, 32]} />
      {:else}
        <T.PlaneGeometry args={[w, h]} />
      {/if}
      <T.MeshStandardMaterial
        color={element.fillColor || (element.type === 'zone' ? '#9bd64a' : stroke)}
        transparent
        opacity={element.type === 'zone' ? (element.fillOpacity ?? 0.25) : 0.35}
        side={THREE.DoubleSide}
      />
    </T.Mesh>
    {#if isSelected}
      <T.Mesh rotation.x={-Math.PI / 2} position.y={0.01}>
        <T.PlaneGeometry args={[w + 0.2, h + 0.2]} />
        <T.MeshBasicMaterial color="#5e6ad2" wireframe />
      </T.Mesh>
    {/if}
  </T.Group>
{:else if element.type === 'ring'}
  <T.Mesh
    position.x={world.x}
    position.y={0.03}
    position.z={world.z}
    rotation.x={-Math.PI / 2}
    onclick={onPointerDown}
    onpointerdown={onPointerDown}
  >
    <T.RingGeometry args={[0.8, 1.2, 24]} />
    <T.MeshStandardMaterial color={stroke} side={THREE.DoubleSide} />
  </T.Mesh>
{:else if element.type === 'text' || element.type === 'callout'}
  <T.Mesh
    position.x={world.x}
    position.y={0.05}
    position.z={world.z}
    rotation.x={-Math.PI / 2}
    onclick={onPointerDown}
    onpointerdown={onPointerDown}
  >
    <T.PlaneGeometry args={[2, 0.6]} />
    <T.MeshBasicMaterial color="#ffffff" transparent opacity={0.85} />
  </T.Mesh>
{/if}
