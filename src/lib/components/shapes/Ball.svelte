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
    e.stopPropagation();
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
  class="ball-group"
  role="graphics-symbol"
  tabindex="0"
  onpointerdown={onPointerDown}
  style="transform: translate({element.position.x}px, {element.position.y}px);"
>
  {#if isSelected}
    <circle cx="0" cy="0" r={(element.radius || 8) + 4} fill="none" stroke="var(--accent-primary)" stroke-width="2" opacity="0.8" />
  {/if}
  
  <circle cx="0" cy="0" r={element.radius || 8} fill="#fff" stroke="#000" stroke-width="1.5" />
  <circle cx="0" cy="0" r={(element.radius || 8) * 0.4} fill="#000" />
  
  <path d="M 0,-3.2 L -2.5,1.5 L 2.5,1.5 Z" fill="#000" />
</g>

<style>
  .ball-group {
    cursor: grab;
  }
  .ball-group:active {
    cursor: grabbing;
  }
</style>
