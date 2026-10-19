<script lang="ts">
  import {
    PITCH,
    pitchDerived,
    lightenGrassColor,
    halfFieldClip,
    grassBackgroundRect,
    buildStripeRects,
    buildOutlineSegments,
    buildMarkingSegments,
    buildCornerArcs,
    buildCenterCircle,
    buildSpotMarkers,
    buildGoalRects,
    cornerArcToSvgPath,
    arcToSvgPath
  } from '$lib/utils/pitchMarkings';

  let {
    template = 'Complet',
    orientation = 'horizontal',
    showStripes = true,
    grassColor = '#2b6b39',
    hideGoals = false,
    hideLines = false
  } = $props<{
    template: 'Complet' | 'Demi' | 'DemiBas';
    orientation: 'horizontal' | 'vertical';
    showStripes?: boolean;
    grassColor?: string;
    hideGoals?: boolean;
    hideLines?: boolean;
  }>();

  const d = pitchDerived();
  const { lengthPx: pw, widthPx: ph, halfLengthPx: hw, halfWidthPx: hh, penAreaW, centerCircleR, penSpotX } = PITCH;

  const dx = -185;
  const dy = 185;

  const halfClip = $derived(halfFieldClip(template));
  const playingClipId = $derived(halfClip ? 'url(#playing-clip)' : undefined);

  const grassRect = grassBackgroundRect();
  const stripes = $derived(showStripes ? buildStripeRects() : []);
  const outline = $derived(buildOutlineSegments(template));
  const markings = $derived(buildMarkingSegments(template));
  const corners = buildCornerArcs();
  const centerCircle = buildCenterCircle();
  const spots = buildSpotMarkers();
  const goals = buildGoalRects();
</script>

<g
  class="pitch-container"
  pointer-events="none"
  clip-path={halfClip ? 'url(#pitch-half-clip)' : undefined}
  transform={orientation === 'vertical' ? `translate(${dx}, ${dy}) rotate(90, ${hw}, ${hh})` : ''}
>
  {#if halfClip}
    <defs>
      <clipPath id="pitch-half-clip">
        <rect x={halfClip.grass.x} y={halfClip.grass.y} width={halfClip.grass.w} height={halfClip.grass.h} />
      </clipPath>
      {#if template === 'Demi'}
        <clipPath id="playing-clip">
          <rect x={halfClip.playing.x} y={halfClip.playing.y} width={halfClip.playing.w} height={halfClip.playing.h} />
        </clipPath>
      {:else}
        <clipPath id="playing-clip">
          <rect x={halfClip.playing.x} y={halfClip.playing.y} width={halfClip.playing.w} height={halfClip.playing.h} />
        </clipPath>
      {/if}
    </defs>
  {/if}

  <rect
    class="bg-rect"
    x={grassRect.x}
    y={grassRect.y}
    width={grassRect.w}
    height={grassRect.h}
    rx="10"
    fill={grassColor}
  />

  {#if showStripes}
    <g class="stripes" pointer-events="none" clip-path={playingClipId}>
      {#each stripes as stripe}
        <rect
          x={stripe.x}
          y={stripe.y}
          width={stripe.w}
          height={stripe.h}
          fill={lightenGrassColor(grassColor)}
        />
      {/each}
    </g>
  {/if}

  {#if !hideLines}
    {#each outline as seg}
      <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} class="line" />
    {/each}

    <g class="field-lines" clip-path={playingClipId}>
      {#each markings as seg}
        <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} class="line" />
      {/each}

      <path d={arcToSvgPath(centerCircle)} fill="none" class="line" />
      <circle cx={hw} cy={hh} r="3" fill="#ffffff" />

      {#each corners as arc}
        <path d={cornerArcToSvgPath(arc)} fill="none" class="line" />
      {/each}

      {#each spots as spot, i}
        {#if i > 0}
          <circle cx={spot.cx} cy={spot.cy} r="3" fill="#ffffff" />
        {/if}
      {/each}

      <g>
        <clipPath id="left-pen-clip">
          <rect x={penAreaW} y="0" width={pw} height={ph} />
        </clipPath>
        <circle cx={penSpotX} cy={hh} r={centerCircleR} fill="none" class="line" clip-path="url(#left-pen-clip)" />
      </g>
      <g>
        <clipPath id="right-pen-clip">
          <rect x="0" y="0" width={pw - penAreaW} height={ph} />
        </clipPath>
        <circle cx={d.penSpotRightX} cy={hh} r={centerCircleR} fill="none" class="line" clip-path="url(#right-pen-clip)" />
      </g>
    </g>
  {/if}

  {#if !hideGoals}
    {#each goals as g}
      <rect
        x={g.rect.x}
        y={g.rect.y}
        width={g.rect.w}
        height={g.rect.h}
        fill="none"
        class="line"
        stroke-opacity="0.5"
      />
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
  }
</style>
