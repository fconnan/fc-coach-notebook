<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { updateElement, selectedIds } from '$lib/stores/workspace';
 
  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();
  
  let isDragging = false;
  let isRotating = false;
  let startX = 0;
  let startY = 0;
  let originalX = 0;
  let originalY = 0;
  let svgElement: SVGSVGElement | null = null;
 
  function onPointerDown(e: PointerEvent) {
    if (isRotating) return;
    e.stopPropagation(); 
    selectedIds.set([element.id]);
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    originalX = element.position.x;
    originalY = element.position.y;
    
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    
    const target = e.currentTarget as SVGElement;
    target.setPointerCapture(e.pointerId);
  }
  
  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    updateElement(element.id, {
      position: {
        x: originalX + dx,
        y: originalY + dy
      }
    });
  }
  
  function onPointerUp(e: PointerEvent) {
    isDragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    
    const target = e.currentTarget as SVGElement;
    if (target) target.releasePointerCapture(e.pointerId);
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
  const radius = $derived(element.radius || 14);
  const leftLegH = $derived(element.leftLegLength || 10);
  const rightLegH = $derived(element.rightLegLength || 10);
  const armW = 12;
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
    <!-- Selection Aura -->
    {#if isSelected}
      <circle cx="0" cy="0" r={radius + 4} fill="none" stroke="var(--accent-primary)" stroke-width="2" opacity="0.4" />
    {/if}
    
    <!-- Player Stance (Action legs) -->
    <!-- Left Leg -->
    <rect x="-11" y="6" width="8" height={leftLegH - 6} rx="0" fill={element.label === 'G' ? '#d4ff00' : (element.color || '#5e6ad2')} stroke="#000" stroke-width="0.5" />
    <rect x="-11" y={6 + leftLegH - 6} width="8" height="6" rx="3" fill="#111" />
    
    <!-- Right Leg -->
    <rect x="3" y="6" width="8" height={rightLegH - 6} rx="0" fill={element.label === 'G' ? '#d4ff00' : (element.color || '#5e6ad2')} stroke="#000" stroke-width="0.5" />
    <rect x="3" y={6 + rightLegH - 6} width="8" height="6" rx="3" fill="#111" />

    <!-- Player Arms (Curved from shoulders forward) -->
    <!-- Left Arm -->
    <path 
      d="M -13.5 -7 Q -26 -2 -22 6" 
      fill="none" 
      stroke={element.label === 'G' ? '#d4ff00' : (element.color || '#5e6ad2')} 
      stroke-width="4" 
      stroke-linecap="round" 
    />
    <path 
      d="M -13.5 -7 Q -26 -2 -22 6" 
      fill="none" 
      stroke="#000" 
      stroke-width="5" 
      stroke-linecap="round" 
      opacity="0.2"
    />

    <!-- Right Arm -->
    <path 
      d="M 13.5 -7 Q 26 -2 22 6" 
      fill="none" 
      stroke={element.label === 'G' ? '#d4ff00' : (element.color || '#5e6ad2')} 
      stroke-width="4" 
      stroke-linecap="round" 
    />
    <path 
      d="M 13.5 -7 Q 26 -2 22 6" 
      fill="none" 
      stroke="#000" 
      stroke-width="5" 
      stroke-linecap="round" 
      opacity="0.2"
    />

    <!-- Player Body -->
    <circle 
      cx="0" 
      cy="0" 
      r={radius} 
      fill={element.label === 'G' ? '#d4ff00' : (element.color || '#5e6ad2')} 
      stroke={element.label === 'G' ? (element.color || '#5e6ad2') : '#000'} 
      stroke-width={element.label === 'G' ? 2 : 1.5} 
    />
    
    <!-- Label / Number -->
    {#if element.label}
      <text 
        x="0" 
        y="0" 
        text-anchor="middle" 
        dominant-baseline="central"
        fill={element.label === 'G' ? (element.color || '#5e6ad2') : '#fff'}
        font-size={radius * 0.9}
        font-weight="bold"
        pointer-events="none"
      >
        {element.label}
      </text>
    {/if}

    <!-- Rotation Handle (Only when selected) -->
    {#if isSelected}
      <g class="rotation-handle-group" onpointerdown={onRotateDown} role="button" aria-label="Rotate player" tabindex="0">
        <line x1="0" y1={-radius} x2="0" y2="-45" stroke="var(--accent-primary)" stroke-width="1.5" stroke-dasharray="2,2" />
        <circle cx="0" cy="-45" r="6" fill="var(--bg-panel)" stroke="var(--accent-primary)" stroke-width="2" class="handle-dot" />
      </g>
    {/if}
  </g>
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
