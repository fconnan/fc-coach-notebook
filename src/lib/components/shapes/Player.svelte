<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { updateElement, currentPage } from '$lib/stores/workspace';
  import { beginElementDrag } from '$lib/utils/interactions';
  import { resolvePosture } from '$lib/utils/playerPostures';
  import PlayerFigure from './PlayerFigure.svelte';

  let { element, isSelected } = $props<{ element: ComponentElement; isSelected: boolean }>();

  let isRotating = false;
  let svgElement: SVGSVGElement | null = null;

  function onPointerDown(e: PointerEvent) {
    if (isRotating) return;
    beginElementDrag(e, element);
  }

  function onRotateDown(e: PointerEvent) {
    e.stopPropagation();
    isRotating = true;
    const g = e.currentTarget as SVGElement;
    svgElement = g.ownerSVGElement;
    window.addEventListener('pointermove', onRotateMove);
    window.addEventListener('pointerup', onRotateUp);
  }

  function onRotateMove(e: PointerEvent) {
    if (!isRotating || !svgElement) return;
    const playerGroup = document.querySelector(`[data-id="${element.id}"]`);
    if (!playerGroup) return;
    const playerRect = playerGroup.getBoundingClientRect();
    const centerX = playerRect.left + playerRect.width / 2;
    const centerY = playerRect.top + playerRect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    angle = (angle + 360) % 360;
    updateElement(element.id, { angle: Math.round(angle) });
  }

  function onRotateUp() {
    isRotating = false;
    window.removeEventListener('pointermove', onRotateMove);
    window.removeEventListener('pointerup', onRotateUp);
  }

  const angle = $derived(element.angle || 0);
  const radius = $derived(
    element.radius ||
      (element.team === 'team1'
        ? $currentPage.team1Size
        : element.team === 'team2'
          ? $currentPage.team2Size
          : 14)
  );
  const isGK = $derived(element.role === 'goalkeeper' || element.label === 'G');
  const teamColor = $derived(
    element.team === 'team1'
      ? $currentPage.team1Color
      : element.team === 'team2'
        ? $currentPage.team2Color
        : '#ffffff'
  );
  const shirtColor = $derived(isGK ? '#d4ff00' : element.shirtColor || element.color || teamColor);
  const shortColor = $derived(element.shortColor || '#1c1c1c');
  const skinColor = $derived(element.skinColor || '#e8b58c');
  const pattern = $derived(element.shirtPattern || 'solid');
  const strokeCol = $derived(isGK ? element.color || teamColor : '#111');
  const leftLegH = $derived(element.leftLegLength || 10);
  const rightLegH = $derived(element.rightLegLength || 10);
  const useFigure = $derived($currentPage.view === 'perspective');
  const posture = $derived(resolvePosture(element));
  const figScale = $derived((radius / 12) * 1.2);

  function contrast(hex: string): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return '#ffffff';
    const lum =
      parseInt(m[1], 16) * 0.299 + parseInt(m[2], 16) * 0.587 + parseInt(m[3], 16) * 0.114;
    return lum > 150 ? '#1a1a1a' : '#ffffff';
  }
  const patternColor = $derived(contrast(shirtColor));
  const canRotate = $derived(isSelected && (useFigure || $currentPage.showPlayerDetails));
</script>

<g
  class="player-group"
  data-id={element.id}
  role="button"
  tabindex="0"
  onpointerdown={onPointerDown}
  style="transform: translate({element.position.x}px, {element.position.y}px);"
>
  <g transform="rotate({angle})">
    {#if isSelected}
      {#if useFigure}
        <rect
          x="-22"
          y="-36"
          width="44"
          height="48"
          rx="6"
          fill="none"
          stroke="#fff"
          stroke-width="2"
          stroke-dasharray="4,2"
        />
      {:else if $currentPage.showPlayerDetails}
        <rect
          x="-40"
          y="-14"
          width="80"
          height="46"
          rx="6"
          fill="none"
          stroke="#fff"
          stroke-width="2"
          stroke-dasharray="4,2"
        />
      {:else}
        <rect
          x="-18"
          y="-18"
          width="36"
          height="36"
          rx="6"
          fill="none"
          stroke="#fff"
          stroke-width="2"
          stroke-dasharray="4,2"
        />
      {/if}
    {/if}

    {#if useFigure}
      <g transform="translate(0, 4)">
        <PlayerFigure
          {posture}
          shirt={shirtColor}
          short={shortColor}
          skin={skinColor}
          {pattern}
          {patternColor}
          stroke={strokeCol}
          scale={figScale}
          uid={element.id}
        />
      </g>
    {:else if $currentPage.showPlayerDetails}
      <rect x="-11" y="6" width="8" height={leftLegH - 6} rx="0" fill={shortColor} stroke="#000" stroke-width="0.5" />
      <rect x="-11" y={6 + leftLegH - 6} width="8" height="6" rx="3" fill="#111" />
      <rect x="3" y="6" width="8" height={rightLegH - 6} rx="0" fill={shortColor} stroke="#000" stroke-width="0.5" />
      <rect x="3" y={6 + rightLegH - 6} width="8" height="6" rx="3" fill="#111" />
      <path
        d="M -42 8 Q 0 -35 42 8"
        fill="none"
        stroke="#000"
        stroke-width={isGK ? 2 : 1.5}
        stroke-linecap="round"
      />
    {/if}

    {#if !useFigure}
      <defs>
        <clipPath id="pclip-{element.id}">
          <circle cx="0" cy="0" r={radius} />
        </clipPath>
      </defs>
      <circle
        cx="0"
        cy="0"
        r={radius}
        fill={shirtColor}
        stroke={strokeCol}
        stroke-width={isGK ? 2 : 1.5}
      />
      {#if !isGK && pattern === 'stripes'}
        <g clip-path="url(#pclip-{element.id})" pointer-events="none">
          {#each [-radius + radius * 0.5, -radius + radius * 1.17, -radius + radius * 1.83] as sx}
            <rect
              x={sx}
              y={-radius}
              width={radius * 0.33}
              height={radius * 2}
              fill={patternColor}
              opacity="0.85"
            />
          {/each}
        </g>
      {:else if !isGK && pattern === 'hoops'}
        <g clip-path="url(#pclip-{element.id})" pointer-events="none">
          <rect x={-radius} y={-radius * 0.55} width={radius * 2} height={radius * 0.5} fill={patternColor} opacity="0.85" />
          <rect x={-radius} y={radius * 0.1} width={radius * 2} height={radius * 0.5} fill={patternColor} opacity="0.85" />
        </g>
      {/if}
    {/if}
  </g>

  {#if element.label}
  <text
    x="0"
    y={useFigure ? -8 : 0}
    text-anchor="middle"
    dominant-baseline="central"
    fill={useFigure ? '#ffffff' : isGK ? element.color || teamColor : patternColor}
    font-size={useFigure ? 9 : radius * 0.9}
    font-weight="bold"
    style={useFigure ? 'paint-order: stroke; stroke: rgba(0,0,0,0.75); stroke-width: 2px;' : undefined}
    pointer-events="none"
  >
    {element.label}
  </text>
  {/if}

  {#if element.name}
    <text
      x="0"
      y={useFigure ? radius + 18 : radius + 11}
      text-anchor="middle"
      fill="#ffffff"
      font-size="11"
      font-weight="600"
      style="paint-order: stroke; stroke: rgba(0,0,0,0.6); stroke-width: 2px;"
      pointer-events="none"
    >
      {element.name}
    </text>
  {/if}

  {#if canRotate}
    <g transform="rotate({angle})">
      <g
        class="rotation-handle-group"
        onpointerdown={onRotateDown}
        role="button"
        aria-label="Rotate player"
        tabindex="0"
      >
        <line
          x1="0"
          y1={useFigure ? -38 : -radius}
          x2="0"
          y2={useFigure ? -52 : -45}
          stroke="var(--accent-primary)"
          stroke-width="1.5"
          stroke-dasharray="2,2"
        />
        <circle
          cx="0"
          cy={useFigure ? -52 : -45}
          r="6"
          fill="var(--bg-panel)"
          stroke="var(--accent-primary)"
          stroke-width="2"
          class="handle-dot"
        />
      </g>
    </g>
  {/if}
</g>

<style>
  .player-group {
    cursor: grab;
    outline: none;
  }
  .player-group:active {
    cursor: grabbing;
  }
  .rotation-handle-group {
    cursor: crosshair;
  }
  .handle-dot {
    transition: r 0.2s;
  }
  .handle-dot:hover {
    r: 8;
    fill: var(--accent-primary);
  }
</style>
