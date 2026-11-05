<script lang="ts">
  import RadarChart from './RadarChart.svelte';
  import { domainAverage, formatAverage, parseEvaluation, type SkillsMarker } from '$lib/workspace/evaluation';

  let { markdown = '', marker = null, zoom = 1 } = $props<{ markdown?: string; marker?: SkillsMarker | null; zoom?: number }>();

  const sheet = $derived(parseEvaluation(markdown, marker));
</script>

<div class="charts" style:--chart-zoom={zoom}>
  {#if sheet.skillsTitle && sheet.domains.length}
    <article class="chart-card overflow-hidden rounded-xl border border-default-medium bg-white shadow-[0_4px_14px_rgba(15,23,42,0.14)] dark:bg-neutral-primary dark:shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
      <header class="border-b border-default-medium bg-gray-100 px-2 py-0.5 text-center text-xs font-medium dark:bg-gray-800">{sheet.skillsTitle}</header>
      <RadarChart compact labels={sheet.domains.map(domain => domain.name)} values={sheet.domains.map(domain => domainAverage(sheet, domain))} />
    </article>
  {/if}
  {#each sheet.domains as domain (domain.id)}
    <article class="chart-card overflow-hidden rounded-xl border border-default-medium bg-white shadow-[0_4px_14px_rgba(15,23,42,0.14)] dark:bg-neutral-primary dark:shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
      <header class="border-b border-default-medium bg-gray-100 px-2 py-0.5 text-center text-xs font-medium dark:bg-gray-800">{domain.name} · {formatAverage(domainAverage(sheet, domain))}</header>
      <RadarChart compact labels={domain.criteria.map(item => item.name)} values={domain.criteria.map(item => item.score)} />
    </article>
  {/each}
</div>

<style>
  .charts {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.75rem;
    width: max(100%, calc(26rem * var(--chart-zoom) + 1.5rem));
  }

  .chart-card {
    flex: 0 0 calc(26rem * var(--chart-zoom));
    width: calc(26rem * var(--chart-zoom));
  }
</style>
