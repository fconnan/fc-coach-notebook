<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import type { FieldTemplate } from '$lib/utils/fieldBounds';
  import {
    lightenGrassColor,
    visibleGrassRect,
    buildVisibleStripeRects,
    stripeRectToWorld,
    buildWorldLinePositions,
    buildPenaltyArcWorldPositions,
    buildVisibleSpotMarkers,
    pitchPxToWorld,
    buildGoal3DSpecs
  } from '$lib/utils/pitchMarkings';
  import Goal3D from './Goal3D.svelte';
  import { DEFAULT_GOAL_NET_OPACITY } from '$lib/utils/goalVisual';

  let {
    template = 'Complet' as FieldTemplate,
    grassColor = '#2b6b39',
    showStripes = true,
    hideLines = false,
    hideGoals = false,
    goalNetOpacity = DEFAULT_GOAL_NET_OPACITY
  } = $props<{
    template?: FieldTemplate;
    grassColor?: string;
    showStripes?: boolean;
    hideLines?: boolean;
    hideGoals?: boolean;
    goalNetOpacity?: number;
  }>();

  const grassRect = $derived(visibleGrassRect(template));
  const grassWorld = $derived(stripeRectToWorld(grassRect));

  const stripes = $derived(showStripes ? buildVisibleStripeRects(template) : []);

  const lineGeo = $derived.by(() => {
    const positions = buildWorldLinePositions(template);
    const penPositions = buildPenaltyArcWorldPositions(template);
    const merged = new Float32Array(positions.length + penPositions.length);
    merged.set(positions, 0);
    merged.set(penPositions, positions.length);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(merged, 3));
    return geo;
  });

  const spotPositions = $derived.by(() => {
    return buildVisibleSpotMarkers(template).map((s) => pitchPxToWorld(s.cx, s.cy, 0.04));
  });

  const goals = $derived(buildGoal3DSpecs(template));
  const stripeColor = $derived(lightenGrassColor(grassColor));
</script>

<!-- Base grass (half-field + run-off band, same footprint as 2D clip) -->
<T.Mesh rotation.x={-Math.PI / 2} position={[grassWorld.cx, 0.001, grassWorld.cz]} receiveShadow>
  <T.PlaneGeometry args={[grassWorld.w, grassWorld.d]} />
  <T.MeshStandardMaterial color={grassColor} />
</T.Mesh>

<!-- Mowing stripes: same rects as Pitch.svelte, placed as ground quads -->
{#each stripes as stripe}
  {@const w = stripeRectToWorld(stripe)}
  <T.Mesh rotation.x={-Math.PI / 2} position={[w.cx, 0.002, w.cz]} receiveShadow>
    <T.PlaneGeometry args={[w.w, w.d]} />
    <T.MeshStandardMaterial color={stripeColor} />
  </T.Mesh>
{/each}

{#if !hideLines}
  <T.LineSegments geometry={lineGeo}>
    <T.LineBasicMaterial color="#ffffff" />
  </T.LineSegments>

  {#each spotPositions as pos}
    <T.Mesh position={pos} rotation.x={-Math.PI / 2}>
      <T.CircleGeometry args={[0.12, 16]} />
      <T.MeshBasicMaterial color="#ffffff" />
    </T.Mesh>
  {/each}
{/if}

{#if !hideGoals}
  {#each goals as spec}
    <Goal3D {spec} netOpacity={goalNetOpacity} />
  {/each}
{/if}
