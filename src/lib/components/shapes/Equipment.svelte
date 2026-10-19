<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { beginElementDrag } from '$lib/utils/interactions';
  import { getPerspectiveContext } from '$lib/utils/perspectiveContext';
  import { isStandingElement } from '$lib/utils/projection';
  import {
    DEFAULT_GOAL_NET_OPACITY,
    goalEquipmentFrontLayout
  } from '$lib/utils/goalVisual';
  import GoalEquipmentFront from './GoalEquipmentFront.svelte';

  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();

  const projector = $derived(getPerspectiveContext());
  const anchor = $derived(
    projector && isStandingElement(element.type)
      ? projector.projectGround(element.position.x, element.position.y)
      : null
  );
  const flatAnchor = $derived(
    projector && !isStandingElement(element.type)
      ? projector.projectGround(element.position.x, element.position.y)
      : null
  );

  const angle = $derived(element.angle || 0);
  const c = $derived(element.color || defaultColor(element.type));
  const scale = $derived((element.radius || 14) / 14);

  function defaultColor(type: string): string {
    switch (type) {
      case 'cone': return '#e6442e';
      case 'coneTall': return '#ff7a00';
      case 'miniGoal':
      case 'fullGoal': return '#ffffff';
      case 'pole': return '#e6442e';
      case 'ladder': return '#f5d000';
      case 'hurdle': return '#e6442e';
      case 'mannequin': return '#f5b000';
      case 'ring': return '#f5d000';
      default: return '#ffffff';
    }
  }

  function onPointerDown(e: PointerEvent) {
    beginElementDrag(e, element);
  }

  // Approximate selection box half-extent per type
  const box = $derived.by(() => {
    switch (element.type) {
      case 'fullGoal': return goalEquipmentFrontLayout('fullGoal').box;
      case 'miniGoal': return goalEquipmentFrontLayout('miniGoal').box;
      case 'ladder': return { w: 22, h: 70 };
      case 'hurdle': return { w: 26, h: 18 };
      case 'pole': return { w: 8, h: 44 };
      case 'mannequin': return { w: 20, h: 44 };
      case 'ring': return { w: 30, h: 16 };
      case 'coneTall': return { w: 16, h: 26 };
      default: return { w: 18, h: 14 }; // cone
    }
  });
  const billboardScale = $derived(anchor ? anchor.scale * scale : scale);
  const footY = $derived(
    element.type === 'cone' ? 6
    : element.type === 'coneTall' ? 14
    : element.type === 'pole' ? 22
    : element.type === 'hurdle' ? 8
    : element.type === 'mannequin' ? 22
    : element.type === 'miniGoal' ? goalEquipmentFrontLayout('miniGoal').footY
    : element.type === 'fullGoal' ? goalEquipmentFrontLayout('fullGoal').footY
    : 6
  );
</script>

<g
  class="equipment"
  data-id={element.id}
  role="button"
  tabindex="0"
  aria-label={element.type}
  onpointerdown={onPointerDown}
  transform={anchor
    ? `translate(${anchor.x}, ${anchor.y}) scale(${billboardScale})`
    : flatAnchor
      ? `translate(${flatAnchor.x}, ${flatAnchor.y}) scale(${flatAnchor.scale * scale})`
      : `translate(${element.position.x}, ${element.position.y}) rotate(${angle}) scale(${scale})`}
>
  <g transform={anchor ? `rotate(${angle}) translate(0, ${-footY})` : flatAnchor ? `rotate(${angle})` : ''}>
  {#if anchor}
    <ellipse cx="0" cy={footY} rx="8" ry="2.5" fill="#000" opacity="0.22" pointer-events="none" />
  {/if}
  {#if element.type === 'cone'}
    <ellipse cx="0" cy="6" rx="11" ry="3.5" fill={c} opacity="0.55" />
    <path d="M -8 6 L 0 -10 L 8 6 Z" fill={c} stroke="#0006" stroke-width="0.5" />
    <rect x="-7" y="0" width="14" height="2.5" fill="#fff8" />
  {:else if element.type === 'coneTall'}
    <ellipse cx="0" cy="14" rx="9" ry="3" fill={c} opacity="0.5" />
    <path d="M -5 14 L 0 -14 L 5 14 Z" fill={c} stroke="#0006" stroke-width="0.5" />
  {:else if element.type === 'pole'}
    <rect x="-1.5" y="-22" width="3" height="44" fill={c} />
    <ellipse cx="0" cy="22" rx="5" ry="2" fill="#0008" />
  {:else if element.type === 'ring'}
    <ellipse cx="0" cy="0" rx="14" ry={flatAnchor ? 4 : 7} fill="none" stroke={c} stroke-width="3.5" />
  {:else if element.type === 'hurdle'}
    <path d="M -12 8 L -12 -6 L 12 -6 L 12 8" fill="none" stroke={c} stroke-width="3" stroke-linejoin="round" />
    <line x1="-12" y1="-6" x2="12" y2="-6" stroke={c} stroke-width="3" />
  {:else if element.type === 'ladder'}
    <rect x="-9" y="-34" width="18" height="68" fill="none" stroke={c} stroke-width="2.5" rx="2" />
    {#each Array(7) as _, i}
      <line x1="-9" y1={-34 + (i + 1) * 8.5} x2="9" y2={-34 + (i + 1) * 8.5} stroke={c} stroke-width="2" />
    {/each}
  {:else if element.type === 'mannequin'}
    <ellipse cx="0" cy="22" rx="8" ry="3" fill="#0008" />
    <line x1="0" y1="22" x2="0" y2="-2" stroke={c} stroke-width="3" />
    <circle cx="0" cy="-12" r="7" fill={c} />
    <path d="M -8 -2 Q 0 6 8 -2" fill={c} />
  {:else if element.type === 'miniGoal' || element.type === 'fullGoal'}
    <GoalEquipmentFront
      layout={goalEquipmentFrontLayout(element.type)}
      color={c}
      netOpacity={element.fillOpacity ?? DEFAULT_GOAL_NET_OPACITY}
    />
  {/if}
  </g>

  {#if isSelected}
    <rect
      x={-box.w} y={-box.h} width={box.w * 2} height={box.h * 2}
      fill="none" stroke="var(--accent-primary)" stroke-width={1.5 / scale}
      stroke-dasharray="4,3" pointer-events="none"
      transform={anchor ? `rotate(${angle}) translate(0, ${-footY})` : ''}
    />
    {#if element.locked}
      <text x="0" y={-box.h - 4} text-anchor="middle" font-size="10" fill="#ffd54f">🔒</text>
    {/if}
  {/if}
</g>

<style>
  .equipment { cursor: grab; outline: none; }
  .equipment:active { cursor: grabbing; }
</style>
