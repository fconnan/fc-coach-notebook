<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { get } from 'svelte/store';
  import type { AnimationAction } from 'three';
  import { GLTF, useGltfAnimations, HTML, Outlines } from '@threlte/extras';
  import * as THREE from 'three';
  import type { ComponentElement } from '$lib/stores/workspace';
  import { currentPage } from '$lib/stores/workspace';
  import { displayToWorld } from '$lib/utils/field3d';
  import { PLAYER_HEIGHT_M } from '$lib/utils/pitchMarkings';
  import { resolvePosture } from '$lib/utils/playerPostures';
  import { pickAnimationClip, tintPlayerMaterials } from '$lib/utils/player3dAnimations';
  import { beginElementDrag3d } from '$lib/utils/interactions3d';

  let {
    element,
    isSelected = false
  } = $props<{ element: ComponentElement; isSelected?: boolean }>();

  const template = $derived($currentPage?.fieldTemplate ?? 'Complet');
  const posture = $derived(resolvePosture(element));
  const isGK = $derived(element.role === 'goalkeeper' || element.label === 'G');
  const teamColor = $derived(
    element.team === 'team1'
      ? $currentPage.team1Color
      : element.team === 'team2'
        ? $currentPage.team2Color
        : '#ffffff'
  );
  const shirt = $derived(isGK ? '#d4ff00' : element.shirtColor || element.color || teamColor);
  const shortCol = $derived(element.shortColor || '#1c1c1c');
  const skin = $derived(element.skinColor || '#e8b58c');
  const angle = $derived(element.angle || 0);

  const world = $derived(displayToWorld(element.position.x, element.position.y, template));

  let gltf = $state<import('@threlte/extras').ThrelteGltf | undefined>();
  let useFallback = $state(false);
  /** Locked once from bind pose — animations must not change scale. */
  let modelScale = $state(1);
  let footOffsetY = $state(0);
  let scaleLocked = $state(false);

  const { actions, mixer } = useGltfAnimations(() => gltf);

  function calibrateScale(scene: THREE.Object3D) {
    if (scaleLocked) return;
    const acts = get(actions) as Record<string, AnimationAction>;
    Object.values(acts).forEach((a) => {
      a?.stop();
      a?.reset();
    });
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const h = box.max.y - box.min.y;
    if (h <= 0) return;
    modelScale = PLAYER_HEIGHT_M / h;
    footOffsetY = -box.min.y * modelScale;
    scaleLocked = true;
  }

  $effect.pre(() => {
    if (gltf?.scene && !scaleLocked) calibrateScale(gltf.scene);
  });

  $effect(() => {
    if (!gltf?.scene || !scaleLocked) return;
    tintPlayerMaterials(gltf.scene, shirt, shortCol, skin);
    const clipName = gltf.animations?.length
      ? pickAnimationClip(gltf.animations, posture)
      : undefined;
    const acts = get(actions) as Record<string, AnimationAction>;
    if (clipName && acts[clipName]) {
      Object.values(acts).forEach((a) => a?.stop());
      acts[clipName]?.reset().fadeIn(0.2).play();
    }
  });

  $effect(() => {
    if (useFallback && !scaleLocked) {
      modelScale = 1;
      footOffsetY = 0;
      scaleLocked = true;
    }
  });

  useTask((dt) => mixer?.update(dt));

  function onPointerDown(e: PointerEvent & { stopPropagation: () => void }) {
    e.stopPropagation();
    beginElementDrag3d(e, element);
  }
</script>

<T.Group
  position.x={world.x}
  position.y={footOffsetY}
  position.z={world.z}
  rotation.y={(-angle * Math.PI) / 180}
  scale={modelScale}
>
  {#if !useFallback}
    <GLTF
      url="/models/player.glb"
      bind:gltf
      onload={(g) => calibrateScale(g.scene)}
      onerror={() => (useFallback = true)}
      castShadow
      receiveShadow
      onclick={onPointerDown}
      onpointerdown={onPointerDown}
    />
  {:else}
    <T.Group onclick={onPointerDown} onpointerdown={onPointerDown}>
      <T.Mesh position={[0, 0.55, 0]} castShadow>
        <T.CapsuleGeometry args={[0.22, 0.55, 4, 8]} />
        <T.MeshStandardMaterial color={shirt} />
      </T.Mesh>
      <T.Mesh position={[0, 1.55, 0]} castShadow>
        <T.SphereGeometry args={[0.18, 12, 12]} />
        <T.MeshStandardMaterial color={skin} />
      </T.Mesh>
      <T.Mesh position={[-0.12, 0.28, 0]} castShadow>
        <T.CapsuleGeometry args={[0.1, 0.42, 4, 8]} />
        <T.MeshStandardMaterial color={shortCol} />
      </T.Mesh>
      <T.Mesh position={[0.12, 0.28, 0]} castShadow>
        <T.CapsuleGeometry args={[0.1, 0.42, 4, 8]} />
        <T.MeshStandardMaterial color={shortCol} />
      </T.Mesh>
    </T.Group>
  {/if}

  {#if isSelected}
    <Outlines color="#5e6ad2" thickness={0.04} />
  {/if}

  {#if element.label}
    <HTML center position={[0, PLAYER_HEIGHT_M + 0.15, 0]} transform occlude>
      <div class="player-label">{element.label}</div>
    </HTML>
  {/if}
</T.Group>

<style>
  .player-label {
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.9);
    pointer-events: none;
    user-select: none;
  }
</style>
