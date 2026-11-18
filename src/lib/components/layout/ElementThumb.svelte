<script lang="ts">
  import { boundsOf, paintArrow } from '$lib/schema/arrowPaint';
  import { applyParams } from '$lib/schema/params';
  import { liveElementPreview } from '$lib/schema/preview';
  import { dottedId } from '$lib/schema/scene';
  import { readSvg } from '$lib/schema/svg';
  import { generateTrajectory } from '$lib/trajectory';

  let { file, kind }: { file: string; kind: 'yaml' | 'svg' } = $props();

  let markup = $state('');

  $effect(() => {
    const target = file;
    const shape = kind;
    let alive = true;
    void paint(target, shape).then(svg => {
      if (alive) markup = svg;
    });
    return () => { alive = false; };
  });

  function trackThumb(source: string): string {
    const path = generateTrajectory({ start: { x: 0, y: 0 }, end: { x: 12, y: 0 }, motif: 'none' });
    const markup = paintArrow(readSvg(applyParams(source, {})).markup, path.d, {});
    const box = boundsOf(path.d);
    const pad = 1.2;
    const x = box.minX - pad;
    const y = -(box.maxY + pad);
    const w = Math.max(box.maxX - box.minX + pad * 2, 1);
    const h = Math.max(box.maxY - box.minY + pad * 2, 1);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}"><g transform="scale(1,-1)">${markup}</g></svg>`;
  }

  function drawnSvg(source: string): string {
    if (/\bdata-track="1"/.test(source)) return trackThumb(source);
    return applyParams(source.replace(/<script\b[\s\S]*?<\/script>/gi, ''), {});
  }

  async function paint(target: string, shape: 'yaml' | 'svg'): Promise<string> {
    try {
      const response = await fetch(`/api/elements?file=${encodeURIComponent(target)}`);
      const body = await response.json() as { source?: string };
      if (!response.ok) return '';
      const source = body.source || '';
      if (shape === 'svg') return drawnSvg(source);
      const preview = await liveElementPreview(source, dottedId(target.split('/').pop() || ''));
      return preview.render(0, 0);
    } catch {
      return '';
    }
  }
</script>

{#if markup}
  <span class="draw">{@html markup}</span>
{/if}

<style>
  .draw {
    display: flex;
    width: 100%;
    height: 100%;
    padding: 0.45rem;
  }
  .draw :global(svg) { width: 100%; height: 100%; }
</style>
