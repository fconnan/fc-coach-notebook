<script lang="ts">
  import { goalEquipmentFrontLayout } from '$lib/utils/goalVisual';
  import GoalEquipmentFront from './GoalEquipmentFront.svelte';

  let { type } = $props<{ type: string }>();
</script>

<svg width="40" height="40" viewBox="-22 -22 44 44" aria-hidden="true">
  {#if type === 'cone'}
    <ellipse cx="0" cy="8" rx="13" ry="4" fill="#e6442e" opacity="0.55" />
    <path d="M -10 8 L 0 -12 L 10 8 Z" fill="#e6442e" stroke="#0006" stroke-width="0.6" />
    <rect x="-8" y="0" width="16" height="3" fill="#fff8" />
  {:else if type === 'coneTall'}
    <ellipse cx="0" cy="16" rx="9" ry="3" fill="#ff7a00" opacity="0.5" />
    <path d="M -5 16 L 0 -16 L 5 16 Z" fill="#ff7a00" stroke="#0006" stroke-width="0.6" />
  {:else if type === 'pole'}
    <rect x="-1.6" y="-18" width="3.2" height="36" fill="#e6442e" />
    <ellipse cx="0" cy="18" rx="5" ry="2" fill="#0008" />
  {:else if type === 'ring'}
    <ellipse cx="0" cy="0" rx="16" ry="8" fill="none" stroke="#f5d000" stroke-width="4" />
  {:else if type === 'hurdle'}
    <path d="M -13 9 L -13 -7 L 13 -7 L 13 9" fill="none" stroke="#e6442e" stroke-width="3.2" stroke-linejoin="round" />
  {:else if type === 'ladder'}
    <rect x="-8" y="-18" width="16" height="36" fill="none" stroke="#f5d000" stroke-width="2.6" rx="2" />
    {#each Array(4) as _, i}
      <line x1="-8" y1={-18 + (i + 1) * 7.2} x2="8" y2={-18 + (i + 1) * 7.2} stroke="#f5d000" stroke-width="2.2" />
    {/each}
  {:else if type === 'mannequin'}
    <ellipse cx="0" cy="18" rx="8" ry="3" fill="#0008" />
    <line x1="0" y1="18" x2="0" y2="-4" stroke="#f5b000" stroke-width="3.5" />
    <circle cx="0" cy="-11" r="7" fill="#f5b000" />
    <path d="M -8 -4 Q 0 5 8 -4" fill="#f5b000" />
  {:else if type === 'miniGoal' || type === 'fullGoal'}
    <GoalEquipmentFront layout={goalEquipmentFrontLayout(type as 'miniGoal' | 'fullGoal')} />
  {/if}
</svg>
