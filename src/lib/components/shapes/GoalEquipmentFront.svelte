<script lang="ts">
  import {
    DEFAULT_GOAL_NET_OPACITY,
    goalFrontFramePath,
    goalFrontNetBands,
    type GoalEquipmentFrontLayout
  } from '$lib/utils/goalVisual';

  let {
    layout,
    color = '#ffffff',
    netOpacity = DEFAULT_GOAL_NET_OPACITY
  } = $props<{
    layout: GoalEquipmentFrontLayout;
    color?: string;
    netOpacity?: number;
  }>();

  const bands = $derived(goalFrontNetBands(layout.hw, layout.frontY, layout.depth));
</script>

{#each bands as band}
  <rect
    x={band.x}
    y={band.y}
    width={band.w}
    height={band.h}
    fill={color}
    fill-opacity={netOpacity}
    stroke="none"
  />
{/each}
<path
  d={goalFrontFramePath(layout.hw, layout.frontY, layout.backY)}
  fill="none"
  stroke={color}
  stroke-width={layout.strokeWidth}
  stroke-linejoin="round"
/>
