<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { currentPage } from '$lib/stores/workspace';
  import { beginElementDrag } from '$lib/utils/interactions';

  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();

  function onPointerDown(e: PointerEvent) {
    beginElementDrag(e, element);
  }
 
  const radius = $derived(element.radius || $currentPage.ballSize);
  const ballColor = $derived(element.color || $currentPage.ballColor);
</script>

<g 
  class="ball-group"
  role="graphics-symbol"
  tabindex="0"
  onpointerdown={onPointerDown}
  style="transform: translate({element.position.x}px, {element.position.y}px);"
>
  {#if isSelected}
    <circle cx="0" cy="0" r={radius + 4} fill="none" stroke="var(--accent-primary)" stroke-width="2" opacity="0.8" />
  {/if}
  
  <circle cx="0" cy="0" r={radius} fill={ballColor} stroke="#000" stroke-width="1.5" />
  <circle cx="0" cy="0" r={radius * 0.4} fill="#000" />
  
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
