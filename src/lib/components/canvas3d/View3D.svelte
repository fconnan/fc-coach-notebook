<script lang="ts">
  import { Canvas } from '@threlte/core';
  import * as THREE from 'three';
  import Scene3D from './Scene3D.svelte';
  import {
    currentPage,
    placeElementAt,
    pushHistory,
    updatePageSettings,
    type ElementType,
    type TeamType
  } from '$lib/stores/workspace';
  import { get } from 'svelte/store';
  import { view3dRenderer, view3dCamera } from '$lib/stores/view3d';
  import { raycastGround, isElementPointerDown } from '$lib/utils/interactions3d';
  import {
    buildCameraDragPatch,
    buildCameraKeyPatch,
    buildCameraWheelPatch,
    isCameraNavKey,
    isTypingTarget
  } from '$lib/utils/camera3dNavigation';

  let containerEl: HTMLDivElement | undefined = $state();
  let camPointerDown = false;
  let camDragging = false;
  let camDragMoved = false;
  let lastClientX = 0;
  let lastClientY = 0;

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

  function onWheel(e: WheelEvent) {
    const page = get(currentPage);
    if (page.view !== '3d') return;
    e.preventDefault();
    const patch = buildCameraWheelPatch(page, e);
    if (patch && Object.keys(patch).length > 0) updatePageSettings(patch);
  }

  function onKeyDown(e: KeyboardEvent) {
    const page = get(currentPage);
    if (page.view !== '3d' || isTypingTarget(e.target) || !isCameraNavKey(e.key)) return;
    e.preventDefault();
    const patch = buildCameraKeyPatch(page, e.key);
    if (patch && Object.keys(patch).length > 0) updatePageSettings(patch);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || get(currentPage).view !== '3d') return;
    camPointerDown = true;
    camDragging = false;
    camDragMoved = false;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
  }

  function onPointerMove(e: PointerEvent) {
    if (!camPointerDown) return;
    if (isElementPointerDown()) {
      camPointerDown = false;
      return;
    }
    const dx = e.clientX - lastClientX;
    const dy = e.clientY - lastClientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    if (!camDragging) {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      camDragging = true;
      containerEl?.setPointerCapture(e.pointerId);
    }
    const page = get(currentPage);
    const patch = buildCameraDragPatch(page, dx, dy, e.shiftKey);
    if (!patch) return;
    camDragMoved = true;
    updatePageSettings(patch, { skipHistory: true });
  }

  function onPointerUp() {
    if (camDragging && camDragMoved) pushHistory(true);
    camPointerDown = false;
    camDragging = false;
    camDragMoved = false;
  }

  $effect(() => {
    if (get(currentPage).view !== '3d') return;
    containerEl?.focus({ preventScroll: true });
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  $effect(() => {
    const el = containerEl;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  $effect(() => {
    const canvas = containerEl?.querySelector('canvas');
    if (!canvas) return;
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  });
</script>

<div
  class="view3d-wrap"
  bind:this={containerEl}
  tabindex="-1"
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
    outline: none;
  }

  .view3d-wrap :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
</style>
