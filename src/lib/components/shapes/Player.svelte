<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { updateElement, selectedIds } from '$lib/stores/workspace';

  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();
  
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let originalX = 0;
  let originalY = 0;

  function onPointerDown(e: PointerEvent) {
    e.stopPropagation(); // Avoid background click
    selectedIds.set([element.id]);
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    originalX = element.position.x;
    originalY = element.position.y;
    
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    
    const target = e.target as SVGElement;
    target.setPointerCapture(e.pointerId);
  }
  
  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    
    // Simplistic drag mapping. If the canvas zooms or scales, this needs to be divided by the zoom factor.
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
    
    const target = e.target as SVGElement;
    target.releasePointerCapture(e.pointerId);
  }
</script>

<g 
  class="player-group"
  role="graphics-symbol"
  tabindex="0"
  onpointerdown={onPointerDown}
  style="transform: translate({element.position.x}px, {element.position.y}px);"
>
  <!-- Selection Aura -->
  {#if isSelected}
    <circle cx="0" cy="0" r={(element.radius || 14) + 4} fill="none" stroke="var(--accent-primary)" stroke-width="2" opacity="0.8" />
  {/if}
  
  <!-- Player Body -->
  <circle 
    cx="0" 
    cy="0" 
    r={element.radius || 14} 
    fill={element.color || '#5e6ad2'} 
    stroke="#000" 
    stroke-width="1.5" 
  />
  
  <!-- Label / Number -->
  {#if element.label}
    <text 
      x="0" 
      y="0" 
      text-anchor="middle" 
      dominant-baseline="central"
      fill="#fff"
      font-size={element.radius ? element.radius * 1.0 : 12}
      font-weight="bold"
      pointer-events="none"
    >
      {element.label}
    </text>
  {/if}
</g>

<style>
  .player-group {
    cursor: grab;
  }
  .player-group:active {
    cursor: grabbing;
  }
</style>
