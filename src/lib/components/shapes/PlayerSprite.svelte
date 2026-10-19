<script lang="ts">
  import { onDestroy } from 'svelte';
  import { tintPlayerSprite } from '$lib/utils/recolorSprite';
  import {
    loadPoseManifest,
    resolveSpriteSync,
    type Morphology
  } from '$lib/utils/playerSpriteCatalog';

  let {
    morphology = 'man',
    postureId = 'idle',
    angle = 0,
    shirt = '#5e6ad2',
    short = '#1c1c1c',
    sock = '#F8C008',
    ball = '#F87800',
    displayHeight = 48
  } = $props<{
    morphology?: Morphology;
    postureId?: string;
    angle?: number;
    shirt?: string;
    short?: string;
    sock?: string;
    ball?: string;
    /** Visual height in SVG units (standing figure). */
    displayHeight?: number;
  }>();

  let href = $state<string | null>(null);
  let flip = $state(false);
  let canvasW = $state(160);
  let canvasH = $state(160);
  let failed = $state(false);
  let gen = 0;

  async function reload() {
    const my = ++gen;
    failed = false;
    try {
      const manifest = await loadPoseManifest();
      const resolved = resolveSpriteSync(manifest, {
        morphology,
        postureId,
        angle
      });
      if (!resolved) {
        failed = true;
        href = null;
        return;
      }
      flip = resolved.flip;
      canvasW = resolved.canvasW;
      canvasH = resolved.canvasH;
      const tinted = await tintPlayerSprite({
        url: resolved.url,
        flip: resolved.flip,
        shirt,
        short,
        sock,
        ball,
        sheet: {
          frameIndex: resolved.frameIndex,
          cellW: resolved.cellW,
          cellH: resolved.cellH
        }
      });
      if (my !== gen) return;
      href = tinted;
    } catch {
      if (my !== gen) return;
      failed = true;
      href = null;
    }
  }

  $effect(() => {
    void morphology;
    void postureId;
    void angle;
    void shirt;
    void short;
    void sock;
    void ball;
    reload();
  });

  onDestroy(() => {
    gen++;
  });

  const scale = $derived(displayHeight / canvasH);
  const w = $derived(canvasW * scale);
  const h = $derived(canvasH * scale);
</script>

{#if href}
  <image
    href={href}
    x={-w / 2}
    y={-h}
    width={w}
    height={h}
    preserveAspectRatio="xMidYMax meet"
    pointer-events="none"
  />
{:else if failed}
  <circle cx="0" cy={-displayHeight * 0.35} r={displayHeight * 0.22} fill={shirt} stroke="#111" stroke-width="1" />
  <rect x={-displayHeight * 0.12} y={-displayHeight * 0.22} width={displayHeight * 0.24} height={displayHeight * 0.22} fill={short} />
{/if}
