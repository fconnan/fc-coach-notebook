<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { updateElement, currentPage } from '$lib/stores/workspace';
  import { beginElementDrag } from '$lib/utils/interactions';
 
  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();
  
  let isRotating = false;
  let svgElement: SVGSVGElement | null = null;
 
  function onPointerDown(e: PointerEvent) {
    if (isRotating) return;
    beginElementDrag(e, element);
  }

  // --- Rotation Logic ---
  function onRotateDown(e: PointerEvent) {
    e.stopPropagation();
    isRotating = true;
    
    // Find the SVG root to calculate screen coordinates
    const g = e.currentTarget as SVGElement;
    svgElement = g.ownerSVGElement;
    
    window.addEventListener('pointermove', onRotateMove);
    window.addEventListener('pointerup', onRotateUp);
  }

  function onRotateMove(e: PointerEvent) {
    if (!isRotating || !svgElement) return;

    // Get player center in screen coordinates
    const rect = svgElement.getBoundingClientRect();
    
    // We need the player's position in SVG units converted to screen units
    // or just calculate the angle from the mouse relative to center of the player's circle
    const playerGroup = document.querySelector(`[data-id="${element.id}"]`);
    if (!playerGroup) return;
    
    const playerRect = playerGroup.getBoundingClientRect();
    const centerX = playerRect.left + playerRect.width / 2;
    const centerY = playerRect.top + playerRect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    
    // atan2 returns radians, we need degrees. 
    // +90 because the handle is at the "top" (Y negative in SVG)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    
    // Normalize to 0-360
    angle = (angle + 360) % 360;
    
    updateElement(element.id, { angle: Math.round(angle) });
  }

  function onRotateUp() {
    isRotating = false;
    window.removeEventListener('pointermove', onRotateMove);
    window.removeEventListener('pointerup', onRotateUp);
  }

  // Pre-calculate rotation and stance
  const angle = $derived(element.angle || 0);
  const radius = $derived(element.radius || (element.team === 'team1' ? $currentPage.team1Size : (element.team === 'team2' ? $currentPage.team2Size : 14)));
  const isGK = $derived(element.role === 'goalkeeper' || element.label === 'G');
  const teamColor = $derived(element.team === 'team1' ? $currentPage.team1Color : (element.team === 'team2' ? $currentPage.team2Color : '#ffffff'));
  const shirtColor = $derived(isGK ? '#d4ff00' : (element.shirtColor || element.color || teamColor));
  const shortColor = $derived(element.shortColor || '#1c1c1c');
  const skinColor = $derived(element.skinColor || '#e8b58c');
  const pattern = $derived(element.shirtPattern || 'solid');
  const strokeCol = $derived(isGK ? (element.color || teamColor) : '#000');
  const playerColor = $derived(shirtColor);
  const leftLegH = $derived(element.leftLegLength || 10);
  const rightLegH = $derived(element.rightLegLength || 10);
  // A readable contrasting colour for shirt patterns
  function contrast(hex: string): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return '#ffffff';
    const lum = (parseInt(m[1], 16) * 0.299 + parseInt(m[2], 16) * 0.587 + parseInt(m[3], 16) * 0.114);
    return lum > 150 ? '#1a1a1a' : '#ffffff';
  }
  const patternColor = $derived(contrast(shirtColor));
</script>
 
<g 
  class="player-group"
  data-id={element.id}
  role="button"
  tabindex="0"
  onpointerdown={onPointerDown}
  style="transform: translate({element.position.x}px, {element.position.y}px);"
>
  <!-- Main Orientation Group -->
  <g transform="rotate({angle})">
    <!-- Selection Box (Enveloping Rectangle) -->
    {#if isSelected}
      {#if $currentPage.showPlayerDetails}
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
    
    <!-- Conditional Player Details -->
    {#if $currentPage.showPlayerDetails}
      <!-- Player Stance (Action legs use the short colour) -->
      <!-- Left Leg -->
      <rect x="-11" y="6" width="8" height={leftLegH - 6} rx="0" fill={shortColor} stroke="#000" stroke-width="0.5" />
      <rect x="-11" y={6 + leftLegH - 6} width="8" height="6" rx="3" fill="#111" />
      
      <!-- Right Leg -->
      <rect x="3" y="6" width="8" height={rightLegH - 6} rx="0" fill={shortColor} stroke="#000" stroke-width="0.5" />
      <rect x="3" y={6 + rightLegH - 6} width="8" height="6" rx="3" fill="#111" />
      
      <!-- Schematic Arch (Back/Structure) -->
      <path 
        d="M -42 8 Q 0 -35 42 8" 
        fill="none" 
        stroke="#000" 
        stroke-width={isGK ? 2 : 1.5} 
        stroke-linecap="round" 
      />
    {/if}

    <!-- Player Body (shirt) -->
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

    <!-- Shirt pattern -->
    {#if !isGK && pattern === 'stripes'}
      <g clip-path="url(#pclip-{element.id})" pointer-events="none">
        {#each [-radius + radius * 0.5, -radius + radius * 1.17, -radius + radius * 1.83] as sx}
          <rect x={sx} y={-radius} width={radius * 0.33} height={radius * 2} fill={patternColor} opacity="0.85" />
        {/each}
      </g>
    {:else if !isGK && pattern === 'hoops'}
      <g clip-path="url(#pclip-{element.id})" pointer-events="none">
        <rect x={-radius} y={-radius * 0.55} width={radius * 2} height={radius * 0.5} fill={patternColor} opacity="0.85" />
        <rect x={-radius} y={radius * 0.1} width={radius * 2} height={radius * 0.5} fill={patternColor} opacity="0.85" />
      </g>
    {/if}
  </g>

  <!-- Label / Number (Always horizontal for readability) -->
  {#if element.label}
    <text 
      x="0" 
      y="0" 
      text-anchor="middle" 
      dominant-baseline="central"
      fill={isGK ? (element.color || teamColor) : patternColor}
      font-size={radius * 0.9}
      font-weight="bold"
      pointer-events="none"
    >
      {element.label}
    </text>
  {/if}

  <!-- Player name (below token) -->
  {#if element.name}
    <text
      x="0"
      y={radius + 11}
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

  <!-- Rotation Handle (Only when selected and details are enabled) -->
  {#if isSelected && $currentPage.showPlayerDetails}
    <g transform="rotate({angle})">
      <g class="rotation-handle-group" onpointerdown={onRotateDown} role="button" aria-label="Rotate player" tabindex="0">
        <line x1="0" y1={-radius} x2="0" y2="-45" stroke="var(--accent-primary)" stroke-width="1.5" stroke-dasharray="2,2" />
        <circle cx="0" cy="-45" r="6" fill="var(--bg-panel)" stroke="var(--accent-primary)" stroke-width="2" class="handle-dot" />
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
