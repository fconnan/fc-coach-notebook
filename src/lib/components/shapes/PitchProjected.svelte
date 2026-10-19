<script lang="ts">
  import type { Projector } from '$lib/utils/projection';
  import type { FieldTemplate } from '$lib/utils/fieldBounds';
  import { contentBox } from '$lib/utils/fieldBounds';
  import { PITCH, pitchDerived, lightenGrassColor, buildStripeRects, buildGoalRects } from '$lib/utils/pitchMarkings';
  import {
    DEFAULT_GOAL_NET_OPACITY,
    goalPlanFrameSegments,
    goalPlanNetBands
  } from '$lib/utils/goalVisual';

  let {
    template = 'Complet' as FieldTemplate,
    showStripes = true,
    grassColor = '#2b6b39',
    hideGoals = false,
    hideLines = false,
    goalNetOpacity = DEFAULT_GOAL_NET_OPACITY,
    projector
  } = $props<{
    template: FieldTemplate;
    showStripes?: boolean;
    grassColor?: string;
    hideGoals?: boolean;
    hideLines?: boolean;
    goalNetOpacity?: number;
    projector: Projector;
  }>();

  const d = pitchDerived();
  const pw = PITCH.lengthPx;
  const ph = PITCH.widthPx;
  const hw = PITCH.halfLengthPx;
  const band = PITCH.bandPx;
  const stripeCount = PITCH.stripeCount;
  const stripeWidth = d.stripeWidth;

  const goalAreaW = PITCH.goalAreaW;
  const goalAreaH = PITCH.goalAreaH;
  const goalAreaY = d.goalAreaY;
  const penAreaW = PITCH.penAreaW;
  const penAreaH = PITCH.penAreaH;
  const penAreaY = d.penAreaY;
  const centerCircleR = PITCH.centerCircleR;
  const penSpotX = PITCH.penSpotX;
  const penSpotRightX = d.penSpotRightX;
  const pitchGoals = $derived(buildGoalRects());
  const cornerR = PITCH.cornerR;

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
    for (const stripe of buildStripeRects()) {
      strips.push({
        path: quadPath([
          { lx: stripe.x, ly: stripe.y },
          { lx: stripe.x + stripe.w, ly: stripe.y },
          { lx: stripe.x + stripe.w, ly: stripe.y + stripe.h },
          { lx: stripe.x, ly: stripe.y + stripe.h }
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
    <path d={strip.path} fill={lightenGrassColor(grassColor)} pointer-events="none" />
  {/each}

  {#if !hideLines}
    {#if template === 'Complet'}
      <path class="line" fill="none" d={quadPath([
        { lx: 0, ly: 0 }, { lx: pw, ly: 0 }, { lx: pw, ly: ph }, { lx: 0, ly: ph }
      ])} />
      <path class="line" d={linePath(hw, 0, hw, ph)} />
    {:else if template === 'Demi'}
      <path class="line" fill="none" d={quadPath([
        { lx: 0, ly: 0 }, { lx: hw, ly: 0 }, { lx: hw, ly: ph }, { lx: 0, ly: ph }
      ])} />
    {:else}
      <path class="line" fill="none" d={quadPath([
        { lx: hw, ly: 0 }, { lx: pw, ly: 0 }, { lx: pw, ly: ph }, { lx: hw, ly: ph }
      ])} />
    {/if}

    <path class="line" d={circlePath(hw, ph / 2, centerCircleR)} fill="none" />
    <circle cx={proj(hw, ph / 2).x} cy={proj(hw, ph / 2).y} r={2.5 * proj(hw, ph / 2).scale} fill="#fff" />

    <path class="line" d={arcPath(0, 0, cornerR, 0, 90)} fill="none" />
    <path class="line" d={arcPath(pw, 0, cornerR, 90, 180)} fill="none" />
    <path class="line" d={arcPath(pw, ph, cornerR, 180, 270)} fill="none" />
    <path class="line" d={arcPath(0, ph, cornerR, 270, 360)} fill="none" />

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
    {#each pitchGoals as g}
      {#each goalPlanNetBands(g.side, g.rect) as band}
        <path
          class="goal-net"
          d={quadPath([
            { lx: band.x, ly: band.y },
            { lx: band.x + band.w, ly: band.y },
            { lx: band.x + band.w, ly: band.y + band.h },
            { lx: band.x, ly: band.y + band.h }
          ])}
          fill="#ffffff"
          fill-opacity={goalNetOpacity}
          stroke="none"
        />
      {/each}
      {#each goalPlanFrameSegments(g.side, g.rect) as seg}
        <path class="line" d={linePath(seg.x1, seg.y1, seg.x2, seg.y2)} />
      {/each}
    {/each}
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
