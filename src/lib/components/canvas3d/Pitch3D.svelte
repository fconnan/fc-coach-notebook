<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import { currentPage } from '$lib/stores/workspace';
  import { pitchSizeM, pitchHalfClip, PITCH_M_W } from '$lib/utils/field3d';

  let {
    grassColor = '#2b6b39',
    showStripes = true,
    hideLines = false,
    hideGoals = false
  } = $props<{
    grassColor?: string;
    showStripes?: boolean;
    hideLines?: boolean;
    hideGoals?: boolean;
  }>();

  const template = $derived($currentPage?.fieldTemplate ?? 'Complet');
  const size = $derived(pitchSizeM(template));
  const half = $derived(pitchHalfClip(template));
  const hw = PITCH_M_W / 2;
  const hl = $derived(size.length / 2);

  function lighten(hex: string, amt: number): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    return `rgb(${Math.min(255, parseInt(m[1], 16) + amt)},${Math.min(255, parseInt(m[2], 16) + amt)},${Math.min(255, parseInt(m[3], 16) + amt)})`;
  }

  const grassTex = $derived.by(() => {
    if (typeof document === 'undefined') return undefined;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, 0, 256, 256);
    if (showStripes) {
      for (let i = 0; i < 12; i++) {
        if (i % 2 === 1) {
          ctx.fillStyle = lighten(grassColor, 14);
          ctx.fillRect((i / 12) * 256, 0, 256 / 12, 256);
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, size.length / PITCH_M_W);
    return tex;
  });

  const outlineGeo = $derived.by(() => {
    const zMin = half === 'bottom' ? 0 : -hl;
    const zMax = half === 'top' ? 0 : hl;
    const pts = new Float32Array([
      -hw, 0.03, zMin, hw, 0.03, zMin,
      hw, 0.03, zMin, hw, 0.03, zMax,
      hw, 0.03, zMax, -hw, 0.03, zMax,
      -hw, 0.03, zMax, -hw, 0.03, zMin
    ]);
    if (half === 'full') {
      const mid = new Float32Array([0, 0.03, zMin, 0, 0.03, zMax]);
      return [new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3)), new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mid, 3))];
    }
    return [new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3))];
  });
</script>

<T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
  <T.PlaneGeometry args={[PITCH_M_W + 6, size.length + 6]} />
  <T.MeshStandardMaterial map={grassTex} color={grassColor} />
</T.Mesh>

{#if !hideLines}
  {#each outlineGeo as geo}
    <T.LineSegments geometry={geo}>
      <T.LineBasicMaterial color="#ffffff" />
    </T.LineSegments>
  {/each}
{/if}

{#if !hideGoals}
  <T.Mesh position={[-hw + 3.66, 1.2, -hl - 1.1]} castShadow>
    <T.BoxGeometry args={[7.32, 2.4, 2.2]} />
    <T.MeshStandardMaterial color="#eeeeee" wireframe />
  </T.Mesh>
  {#if half !== 'top'}
    <T.Mesh position={[-hw + 3.66, 1.2, hl + 1.1]} castShadow>
      <T.BoxGeometry args={[7.32, 2.4, 2.2]} />
      <T.MeshStandardMaterial color="#eeeeee" wireframe />
    </T.Mesh>
  {/if}
{/if}
