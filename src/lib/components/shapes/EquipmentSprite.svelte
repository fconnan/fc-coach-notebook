<script lang="ts">
  import { tintPlayerSprite } from '$lib/utils/recolorSprite';
  import {
    EQUIPMENT_SPRITE_IDS,
    loadEquipmentManifest,
    resolveEquipmentSync
  } from '$lib/utils/playerSpriteCatalog';

  let {
    type,
    angle = 0,
    color = '#e6442e',
    ballColor = '#F87800',
    displaySize = 40
  } = $props<{
    type: string;
    angle?: number;
    color?: string;
    ballColor?: string;
    displaySize?: number;
  }>();

  const equipmentId = $derived(EQUIPMENT_SPRITE_IDS[type] ?? null);
  let href = $state<string | null>(null);
  let canvasW = $state(160);
  let canvasH = $state(160);
  let gen = 0;

  async function reload() {
    const my = ++gen;
    if (!equipmentId) {
      href = null;
      return;
    }
    try {
      const manifest = await loadEquipmentManifest();
      const resolved = resolveEquipmentSync(manifest, { equipmentId, angle });
      if (!resolved) {
        href = null;
        return;
      }
      canvasW = resolved.canvasW;
      canvasH = resolved.canvasH;
      const sheet = {
        frameIndex: resolved.frameIndex,
        cellW: resolved.cellW,
        cellH: resolved.cellH
      };
      const needsBall = resolved.meta.recolor === 'ball';
      const url = await tintPlayerSprite({
        url: resolved.url,
        flip: resolved.flip,
        sheet,
        ...(needsBall ? { ball: ballColor } : {})
      });
      if (my !== gen) return;
      href = url;
    } catch {
      if (my !== gen) return;
      href = null;
    }
  }

  $effect(() => {
    void equipmentId;
    void angle;
    void ballColor;
    reload();
  });

  const scale = $derived(displaySize / canvasH);
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
{/if}
