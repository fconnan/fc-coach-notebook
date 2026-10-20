<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { currentPage } from '$lib/stores/workspace';
  import { beginElementDrag } from '$lib/utils/interactions';
  import { getPerspectiveContext } from '$lib/utils/perspectiveContext';

  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();

  const projector = $derived(getPerspectiveContext());
  const anchor = $derived(
    projector ? projector.projectGround(element.position.x, element.position.y) : null
  );

  function onPointerDown(e: PointerEvent) {
    beginElementDrag(e, element);
  }
 
  const radius = $derived(element.radius || $currentPage.ballSize);
  const ballColor = $derived(element.color || $currentPage.ballColor);
  const groundScale = $derived(anchor ? anchor.scale : 1);
</script>

<g 
  class="ball-group"
  data-id={element.id}
  role="graphics-symbol"
  tabindex="0"
  onpointerdown={onPointerDown}
  transform={anchor ? `translate(${anchor.x}, ${anchor.y}) scale(${groundScale})` : `translate(${element.position.x}, ${element.position.y})`}
>
  {#if anchor}
    <ellipse cx="0" cy="0" rx={radius + 2} ry={radius * 0.45} fill="#000" opacity="0.25" />
  {/if}
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
