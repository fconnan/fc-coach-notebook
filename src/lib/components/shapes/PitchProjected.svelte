<script lang="ts">
  import type { Projector } from '$lib/utils/projection';
  import type { FieldTemplate } from '$lib/utils/fieldBounds';
  import { contentBox } from '$lib/utils/fieldBounds';

  let {
    template = 'Complet' as FieldTemplate,
    showStripes = true,
    grassColor = '#2b6b39',
    hideGoals = false,
    hideLines = false,
    projector
  } = $props<{
    template: FieldTemplate;
    showStripes?: boolean;
    grassColor?: string;
    hideGoals?: boolean;
    hideLines?: boolean;
    projector: Projector;
  }>();

  function lighten(hex: string, amt = 18): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return '#32753f';
    const r = Math.min(255, parseInt(m[1], 16) + amt);
    const g = Math.min(255, parseInt(m[2], 16) + amt);
    const b = Math.min(255, parseInt(m[3], 16) + amt);
    return `rgb(${r}, ${g}, ${b})`;
  }

  const pw = 1050;
  const ph = 680;
  const hw = pw / 2;
  const band = 28;
  const stripeCount = 18;
  const stripeWidth = pw / stripeCount;

  const goalAreaW = 55;
  const goalAreaH = 183.2;
  const goalAreaY = (ph - goalAreaH) / 2;
  const penAreaW = 165;
  const penAreaH = 403.2;
  const penAreaY = (ph - penAreaH) / 2;
  const centerCircleR = 91.5;
  const penSpotX = 110;
  const penSpotRightX = pw - 110;
  const goalW = 20;
  const goalH = 73.2;
  const goalY = (ph - goalH) / 2;
  const cornerR = 10;

  /** Pitch-local (horizontal layout) → display SVG coords. */
  function toDisplay(lx: number, ly: number) {
    return { x: ly, y: pw - lx };
  }

  function proj(lx: number, ly: number) {
    const d = toDisplay(lx, ly);
    return projector.projectGround(d.x, d.y);
  }

  function quadPath(corners: { lx: number; ly: number }[]) {
    const pts = corners.map((c) => proj(c.lx, c.ly));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  }

  function linePath(x1: number, y1: number, x2: number, y2: number) {
    const a = proj(x1, y1);
    const b = proj(x2, y2);
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }

  function circlePath(cx: number, cy: number, r: number, segments = 48) {
    const pts: string[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const p = proj(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
      pts.push(`${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`);
    }
    return pts.join(' ') + ' Z';
  }

  function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number, segments = 16) {
    const pts: string[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = startDeg + ((endDeg - startDeg) * i) / segments;
      const rad = (t * Math.PI) / 180;
      const p = proj(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r);
      pts.push(`${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`);
    }
    return pts.join(' ');
  }

  const box = $derived(contentBox(template));
  const grassStrips = $derived.by(() => {
    const strips: { path: string; alt: boolean }[] = [];
    const rows = 28;
    const y0 = -band;
    const y1 = ph + band;
    const x0 = -band;
    const x1 = pw + band;
    for (let i = 0; i < rows; i++) {
      const t0 = y0 + ((y1 - y0) * i) / rows;
      const t1 = y0 + ((y1 - y0) * (i + 1)) / rows;
      strips.push({
        path: quadPath([
          { lx: x0, ly: t0 },
          { lx: x1, ly: t0 },
          { lx: x1, ly: t1 },
          { lx: x0, ly: t1 }
        ]),
        alt: i % 2 === 1
      });
    }
    return strips;
  });

  const stripeStrips = $derived.by(() => {
    if (!showStripes) return [];
    const strips: { path: string; alt: boolean }[] = [];
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 !== 1) continue;
      const x0 = i * stripeWidth;
      const x1 = (i + 1) * stripeWidth;
      strips.push({
        path: quadPath([
          { lx: x0, ly: 0 },
          { lx: x1, ly: 0 },
          { lx: x1, ly: ph },
          { lx: x0, ly: ph }
        ]),
        alt: true
      });
    }
    return strips;
  });
</script>

<g class="pitch-projected" pointer-events="none">
  {#each grassStrips as strip}
    <path class="bg-rect pitch-surface" d={strip.path} fill={grassColor} />
  {/each}

  {#each stripeStrips as strip}
    <path d={strip.path} fill={lighten(grassColor)} pointer-events="none" />
  {/each}

  {#if !hideLines}
    {#if template === 'Complet'}
      <path class="line" d={linePath(0, 0, pw, 0)} />
      <path class="line" d={linePath(pw, 0, pw, ph)} />
      <path class="line" d={linePath(pw, ph, 0, ph)} />
      <path class="line" d={linePath(0, ph, 0, 0)} />
      <path class="line" d={linePath(hw, 0, hw, ph)} />
    {:else if template === 'Demi'}
      <path class="line" d={linePath(0, 0, hw, 0)} />
      <path class="line" d={linePath(hw, 0, hw, ph)} />
      <path class="line" d={linePath(hw, ph, 0, ph)} />
      <path class="line" d={linePath(0, ph, 0, 0)} />
    {:else}
      <path class="line" d={linePath(hw, 0, pw, 0)} />
      <path class="line" d={linePath(pw, 0, pw, ph)} />
      <path class="line" d={linePath(pw, ph, hw, ph)} />
      <path class="line" d={linePath(hw, ph, hw, 0)} />
    {/if}

    <path class="line" d={circlePath(hw, ph / 2, centerCircleR)} fill="none" />
    <circle cx={proj(hw, ph / 2).x} cy={proj(hw, ph / 2).y} r={2.5 * proj(hw, ph / 2).scale} fill="#fff" />

    <path class="line" d={arcPath(0, cornerR, cornerR, 180, 270)} fill="none" />
    <path class="line" d={arcPath(pw - cornerR, 0, cornerR, 270, 360)} fill="none" />
    <path class="line" d={arcPath(pw, ph - cornerR, cornerR, 0, 90)} fill="none" />
    <path class="line" d={arcPath(cornerR, ph, cornerR, 90, 180)} fill="none" />

    <path class="line" d={quadPath([
      { lx: 0, ly: penAreaY },
      { lx: penAreaW, ly: penAreaY },
      { lx: penAreaW, ly: penAreaY + penAreaH },
      { lx: 0, ly: penAreaY + penAreaH }
    ])} fill="none" />
    <path class="line" d={quadPath([
      { lx: 0, ly: goalAreaY },
      { lx: goalAreaW, ly: goalAreaY },
      { lx: goalAreaW, ly: goalAreaY + goalAreaH },
      { lx: 0, ly: goalAreaY + goalAreaH }
    ])} fill="none" />
    <circle cx={proj(penSpotX, ph / 2).x} cy={proj(penSpotX, ph / 2).y} r={2.5 * proj(penSpotX, ph / 2).scale} fill="#fff" />

    <path class="line" d={quadPath([
      { lx: pw - penAreaW, ly: penAreaY },
      { lx: pw, ly: penAreaY },
      { lx: pw, ly: penAreaY + penAreaH },
      { lx: pw - penAreaW, ly: penAreaY + penAreaH }
    ])} fill="none" />
    <path class="line" d={quadPath([
      { lx: pw - goalAreaW, ly: goalAreaY },
      { lx: pw, ly: goalAreaY },
      { lx: pw, ly: goalAreaY + goalAreaH },
      { lx: pw - goalAreaW, ly: goalAreaY + goalAreaH }
    ])} fill="none" />
    <circle
      cx={proj(penSpotRightX, ph / 2).x}
      cy={proj(penSpotRightX, ph / 2).y}
      r={2.5 * proj(penSpotRightX, ph / 2).scale}
      fill="#fff"
    />
  {/if}

  {#if !hideGoals}
    <path class="line" d={quadPath([
      { lx: -goalW, ly: goalY },
      { lx: 0, ly: goalY },
      { lx: 0, ly: goalY + goalH },
      { lx: -goalW, ly: goalY + goalH }
    ])} fill="none" stroke-opacity="0.5" />
    <path class="line" d={quadPath([
      { lx: pw, ly: goalY },
      { lx: pw + goalW, ly: goalY },
      { lx: pw + goalW, ly: goalY + goalH },
      { lx: pw, ly: goalY + goalH }
    ])} fill="none" stroke-opacity="0.5" />
  {/if}
</g>

<style>
  .line {
    stroke: #ffffff;
    stroke-width: 2.5;
    stroke-opacity: 0.9;
    stroke-linejoin: miter;
    stroke-linecap: butt;
    fill: none;
  }
</style>
