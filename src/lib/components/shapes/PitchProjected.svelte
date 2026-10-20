<script lang="ts">
  import type { Projector } from '$lib/utils/projection';
  import type { FieldTemplate } from '$lib/utils/fieldBounds';
  import {
    PITCH,
    pitchDerived,
    lightenGrassColor,
    visibleGrassRect,
    buildVisibleStripeRects,
    buildOutlinePolygon,
    buildGoalRects
  } from '$lib/utils/pitchMarkings';
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

  /** Pitch-local → display SVG coords (same as the 2D vertical rotation). */
  function toDisplay(lx: number, ly: number) {
    return { x: ph - ly, y: lx };
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

  function rectPath(rect: { x: number; y: number; w: number; h: number }) {
    return quadPath([
      { lx: rect.x, ly: rect.y },
      { lx: rect.x + rect.w, ly: rect.y },
      { lx: rect.x + rect.w, ly: rect.y + rect.h },
      { lx: rect.x, ly: rect.y + rect.h }
    ]);
  }

  const showLeft = $derived(template !== 'DemiBas');
  const showRight = $derived(template !== 'Demi');

  const grassPath = $derived(rectPath(visibleGrassRect(template)));

  const stripeStrips = $derived.by(() => {
    if (!showStripes) return [];
    return buildVisibleStripeRects(template).map((stripe) => rectPath(stripe));
  });

  const outlinePath = $derived(
    quadPath(buildOutlinePolygon(template).map((p) => ({ lx: p.x, ly: p.y })))
  );
</script>

<g class="pitch-projected" pointer-events="none">
  <path class="bg-rect pitch-surface" d={grassPath} fill={grassColor} />

  {#each stripeStrips as path}
    <path d={path} fill={lightenGrassColor(grassColor)} pointer-events="none" />
  {/each}

  {#if !hideLines}
    <path class="line" fill="none" d={outlinePath} />
    {#if template === 'Complet'}
      <path class="line" d={linePath(hw, 0, hw, ph)} />
      <path class="line" d={circlePath(hw, ph / 2, centerCircleR)} fill="none" />
    {:else if template === 'Demi'}
      <path class="line" d={arcPath(hw, ph / 2, centerCircleR, 90, 270)} fill="none" />
    {:else}
      <path class="line" d={arcPath(hw, ph / 2, centerCircleR, -90, 90)} fill="none" />
    {/if}
    <circle cx={proj(hw, ph / 2).x} cy={proj(hw, ph / 2).y} r={2.5 * proj(hw, ph / 2).scale} fill="#fff" />

    {#if showLeft}
      <path class="line" d={arcPath(0, 0, cornerR, 0, 90)} fill="none" />
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
    {/if}

    {#if showRight}
      <path class="line" d={arcPath(pw, 0, cornerR, 90, 180)} fill="none" />
      <path class="line" d={arcPath(pw, ph, cornerR, 180, 270)} fill="none" />
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
  {/if}

  {#if !hideGoals}
    {#each pitchGoals.filter((g) => (g.side === 'left' ? showLeft : showRight)) as g}
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
