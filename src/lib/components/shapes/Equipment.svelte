<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { beginElementDrag } from '$lib/utils/interactions';

  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();

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
      case 'fullGoal': return { w: 73, h: 22 };
      case 'miniGoal': return { w: 36, h: 16 };
      case 'ladder': return { w: 22, h: 70 };
      case 'hurdle': return { w: 26, h: 18 };
      case 'pole': return { w: 8, h: 44 };
      case 'mannequin': return { w: 20, h: 44 };
      case 'ring': return { w: 30, h: 16 };
      case 'coneTall': return { w: 16, h: 26 };
      default: return { w: 18, h: 14 }; // cone
    }
  });
</script>

<g
  class="equipment"
  data-id={element.id}
  role="button"
  tabindex="0"
  aria-label={element.type}
  onpointerdown={onPointerDown}
  transform="translate({element.position.x}, {element.position.y}) rotate({angle}) scale({scale})"
>
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
    <ellipse cx="0" cy="0" rx="14" ry="7" fill="none" stroke={c} stroke-width="3.5" />
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
  {:else if element.type === 'miniGoal'}
    <path d="M -18 8 L -18 -8 L 18 -8 L 18 8" fill="none" stroke={c} stroke-width="3" stroke-linejoin="round" />
    <line x1="-18" y1="8" x2="18" y2="8" stroke={c} stroke-width="2" opacity="0.5" />
  {:else if element.type === 'fullGoal'}
    <rect x="-36" y="-10" width="72" height="20" fill="none" stroke={c} stroke-width="3" />
    <g stroke={c} stroke-width="0.7" opacity="0.6">
      {#each Array(11) as _, i}
        <line x1={-36 + i * 7.2} y1="-10" x2={-36 + i * 7.2} y2="10" />
      {/each}
      {#each Array(3) as _, i}
        <line x1="-36" y1={-10 + (i + 1) * 5} x2="36" y2={-10 + (i + 1) * 5} />
      {/each}
    </g>
  {/if}

  {#if isSelected}
    <rect
      x={-box.w} y={-box.h} width={box.w * 2} height={box.h * 2}
      fill="none" stroke="var(--accent-primary)" stroke-width={1.5 / scale}
      stroke-dasharray="4,3" pointer-events="none"
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
