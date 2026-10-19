<script lang="ts">
  import { Canvas } from '@threlte/core';
  import * as THREE from 'three';
  import Scene3D from './Scene3D.svelte';
  import {
    currentPage,
    placeElementAt,
    type ElementType,
    type TeamType
  } from '$lib/stores/workspace';
  import { get } from 'svelte/store';
  import { view3dRenderer, view3dCamera } from '$lib/stores/view3d';
  import { raycastGround } from '$lib/utils/interactions3d';

  let containerEl: HTMLDivElement | undefined = $state();

  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer?.getData('type') as ElementType | '';
    const team = (e.dataTransfer?.getData('team') || 'none') as TeamType;
    const label = e.dataTransfer?.getData('label') || '';
    if (!type || type === 'field' || !containerEl) return;

    const renderer = get(view3dRenderer);
    const camera = get(view3dCamera);
    const canvas = containerEl.querySelector('canvas');
    if (!renderer || !canvas || !camera) return;

    const rect = canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const page = get(currentPage);
    const pos = raycastGround(camera, ndcX, ndcY, page.fieldTemplate);
    if (pos) placeElementAt(pos, { type, team, label });
  }
</script>

<div
  class="view3d-wrap"
  bind:this={containerEl}
  ondragover={onDragOver}
  ondrop={onDrop}
  role="region"
  aria-label="Vue 3D"
>
  <Canvas
    createRenderer={(canvas) =>
      new THREE.WebGLRenderer({
        canvas,
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: false
      })}
    shadows
  >
    <Scene3D />
  </Canvas>
</div>

<style>
  .view3d-wrap {
    flex: 1;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    background: var(--bg-canvas);
  }

  .view3d-wrap :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
</style>
