<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import type { FieldTemplate } from '$lib/utils/fieldBounds';
  import {
    PX_PER_M,
    lightenGrassColor,
    grassBackgroundRect,
    buildVisibleStripeRects,
    stripeRectToWorld,
    buildWorldLinePositions,
    buildPenaltyArcWorldPositions,
    buildSpotMarkers,
    pitchPxToWorld,
    buildGoal3DSpecs
  } from '$lib/utils/pitchMarkings';
  import Goal3D from './Goal3D.svelte';

  let {
    template = 'Complet' as FieldTemplate,
    grassColor = '#2b6b39',
    showStripes = true,
    hideLines = false,
    hideGoals = false
  } = $props<{
    template?: FieldTemplate;
    grassColor?: string;
    showStripes?: boolean;
    hideLines?: boolean;
    hideGoals?: boolean;
  }>();

  const grassRect = grassBackgroundRect();
  const grassSizeM = $derived({
    width: grassRect.h / PX_PER_M,
    length: grassRect.w / PX_PER_M
  });

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
    return buildSpotMarkers().map((s) => pitchPxToWorld(s.cx, s.cy, 0.04));
  });

  const goals = $derived(buildGoal3DSpecs(template));
  const stripeColor = $derived(lightenGrassColor(grassColor));
</script>

<!-- Base grass (same footprint as 2D: field + run-off band) -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={0.001} receiveShadow>
  <T.PlaneGeometry args={[grassSizeM.width, grassSizeM.length]} />
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
    <Goal3D {spec} />
  {/each}
{/if}
