<script lang="ts">
  import { T, useThrelte } from '@threlte/core';
  import { Color } from 'three';
  import { OrbitControls, interactivity } from '@threlte/extras';
  import {
    currentPage,
    selectedIds,
    isPlaying,
    playbackElements,
    clearSelection,
    updatePageSettings,
    EQUIPMENT_TYPES,
    type ComponentElement
  } from '$lib/stores/workspace';
  import { isStandingElement } from '$lib/utils/projection';
  import { view3dRenderer, view3dCamera } from '$lib/stores/view3d';
  import {
    sphericalCameraPosition,
    cameraToSpherical,
    ORBIT_RADIUS,
    ORBIT_POLAR,
    ORBIT_AZIMUTH,
    clampCam3dAngles,
    clampOffsetZ,
    clampOrbitRadius
  } from '$lib/utils/camera3d';
  import { register3dDragContext } from '$lib/utils/interactions3d';
  import Pitch3D from './Pitch3D.svelte';
  import Player3D from './Player3D.svelte';
  import Ball3D from './Ball3D.svelte';
  import Equipment3D from './Equipment3D.svelte';
  import Annotations3D from './Annotations3D.svelte';

  interactivity();

  const { camera, dom, renderer } = useThrelte();

  $effect(() => {
    if (!renderer) return;
    const css =
      typeof document !== 'undefined'
        ? getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim()
        : '';
    renderer.setClearColor(new Color(css || '#eef0f4'));
  });

  $effect(() => {
    if (renderer) view3dRenderer.set(renderer);
    return () => view3dRenderer.set(null);
  });

  $effect(() => {
    if ($camera) view3dCamera.set($camera);
    return () => view3dCamera.set(null);
  });

  $effect(() => {
    if ($camera && dom) register3dDragContext($camera, dom);
  });

  const displayElements = $derived($isPlaying ? $playbackElements : ($currentPage?.elements ?? []));

  const flatElements = $derived(displayElements.filter((el) => !isStandingElement(el.type)));
  const standingElements = $derived(
    displayElements.filter((el) => isStandingElement(el.type))
  );

  const offsetZ = $derived(clampOffsetZ($currentPage?.cam3dDistance ?? 0));
  const target = $derived({ x: 0, z: offsetZ });

  const angles = $derived(
    clampCam3dAngles({
      yaw: $currentPage?.cam3dYaw,
      pitch: $currentPage?.cam3dPitch
    })
  );

  const radius = $derived(clampOrbitRadius($currentPage?.cam3dRadius ?? ORBIT_RADIUS.default));

  const camPos = $derived(
    sphericalCameraPosition(angles.yaw, angles.pitch, radius, target)
  );

  function onControlsChange() {
    if (!$camera) return;
    const c = $camera.position;
    const sph = cameraToSpherical({ x: c.x, y: c.y, z: c.z }, target);
    updatePageSettings({
      cam3dYaw: sph.yaw,
      cam3dPitch: sph.pitch,
      cam3dRadius: sph.radius
    });
  }

  function onGroundPointerDown(e: PointerEvent & { stopPropagation: () => void }) {
    if ($isPlaying) return;
    clearSelection();
  }
</script>

<T.PerspectiveCamera makeDefault position={camPos} fov={45} near={0.1} far={500} />
<OrbitControls
  target={[target.x, 0, target.z]}
  enableDamping
  dampingFactor={0.08}
  minAzimuthAngle={ORBIT_AZIMUTH.min}
  maxAzimuthAngle={ORBIT_AZIMUTH.max}
  minPolarAngle={ORBIT_POLAR.min}
  maxPolarAngle={ORBIT_POLAR.max}
  minDistance={ORBIT_RADIUS.min}
  maxDistance={ORBIT_RADIUS.max}
  onchange={onControlsChange}
/>

<T.AmbientLight intensity={0.55} />
<T.DirectionalLight
  position={[40, 80, 30]}
  intensity={1.1}
  castShadow
  shadow.mapSize={[2048, 2048]}
  shadow.camera.left={-60}
  shadow.camera.right={60}
  shadow.camera.top={60}
  shadow.camera.bottom={-60}
/>

<Pitch3D
  template={$currentPage?.fieldTemplate ?? 'Complet'}
  grassColor={$currentPage?.backgroundColor}
  showStripes={$currentPage?.showFieldStripes}
  hideLines={$currentPage?.hidePitchLines}
  hideGoals={$currentPage?.hideGoals}
/>

<!-- Invisible ground for background clicks -->
<T.Mesh
  rotation.x={-Math.PI / 2}
  position.y={-0.01}
  onpointerdown={onGroundPointerDown}
>
  <T.PlaneGeometry args={[200, 200]} />
  <T.MeshBasicMaterial visible={false} />
</T.Mesh>

{#each flatElements as element (element.id)}
  {@const sel = !$isPlaying && $selectedIds.includes(element.id)}
  {#if element.type === 'ball'}
    <Ball3D {element} isSelected={sel} />
  {:else}
    <Annotations3D {element} isSelected={sel} />
  {/if}
{/each}

{#each standingElements as element (element.id)}
  {@const sel = !$isPlaying && $selectedIds.includes(element.id)}
  {#if element.type === 'player'}
    <Player3D {element} isSelected={sel} />
  {:else if EQUIPMENT_TYPES.includes(element.type)}
    <Equipment3D {element} isSelected={sel} />
  {/if}
{/each}
