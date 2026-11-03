<script lang="ts">
  import RadarChart from './RadarChart.svelte';
  import { domainAverage, formatAverage, parseEvaluation } from '$lib/workspace/evaluation';

  let { markdown = '' } = $props<{ markdown?: string }>();

  const sheet = $derived(parseEvaluation(markdown));
</script>

<div class="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-2">
  {#if sheet.skillsTitle && sheet.domains.length}
    <article class="overflow-hidden rounded-xl border border-default-medium bg-white shadow-[0_4px_14px_rgba(15,23,42,0.14)] dark:bg-neutral-primary dark:shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
      <header class="border-b border-default-medium bg-gray-100 px-2 py-0.5 text-center text-xs font-medium dark:bg-gray-800">{sheet.skillsTitle}</header>
      <RadarChart compact labels={sheet.domains.map(domain => domain.name)} values={sheet.domains.map(domain => domainAverage(sheet, domain))} />
    </article>
  {/if}
  {#each sheet.domains as domain (domain.id)}
    <article class="overflow-hidden rounded-xl border border-default-medium bg-white shadow-[0_4px_14px_rgba(15,23,42,0.14)] dark:bg-neutral-primary dark:shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
      <header class="border-b border-default-medium bg-gray-100 px-2 py-0.5 text-center text-xs font-medium dark:bg-gray-800">{domain.name} · {formatAverage(domainAverage(sheet, domain))}</header>
      <RadarChart compact labels={domain.criteria.map(item => item.name)} values={domain.criteria.map(item => item.score)} />
    </article>
  {/each}
</div>
