<script lang="ts">
  import { DOMAINS, domainAverage, formatAverage, parseEvaluation } from '$lib/workspace/evaluation';
  import { longFrenchDate } from '$lib/workspace/calendar';

  let {
    rows,
    season,
    player,
    onopen
  } = $props<{
    rows: { date: string; markdown: string }[];
    season: string;
    player: string;
    onopen: (date: string) => void;
  }>();

  const colors = ['#eb4f27', '#2563eb', '#16a34a', '#7c3aed', '#ca8a04', '#0891b2'];
  const width = 1100;
  const height = 300;
  const scaleX = 28;
  const plotLeft = 56;
  const padRight = 36;
  const padTop = 16;
  const padBottom = 32;
  const plotWidth = width - plotLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const sheets = $derived(rows.map((row: { markdown?: string }) => parseEvaluation(row.markdown || '')));
  const series = $derived.by(() => {
    const found = new Map<string, { id: string; name: string; short: string }>();
    for (const sheet of sheets) {
      for (const domain of sheet.domains) found.set(domain.name, domain);
    }
    const ordered = DOMAINS.filter(domain => found.has(domain.name)).map(domain => found.get(domain.name)!);
    for (const domain of found.values()) {
      if (!ordered.some(item => item.name === domain.name)) ordered.push(domain);
    }
    return ordered;
  });
  const points = $derived([...rows].sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)).map((row: { date: string; markdown?: string }) => {
    const sheet = parseEvaluation(row.markdown || '');
    return {
      date: row.date,
      label: axisDate(row.date),
      title: longFrenchDate(row.date),
      values: series.map(domain => {
        const match = sheet.domains.find(item => item.name === domain.name);
        return match ? domainAverage(sheet, match) : null;
      })
    };
  }));

  function axisDate(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    if (!year || !month || !day) return iso;
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day));
  }

  function slotWidth(): number {
    return plotWidth / Math.max(points.length, 1);
  }

  function xAt(index: number): number {
    return plotLeft + slotWidth() * index + slotWidth() / 2;
  }

  function bandAt(index: number): { x: number; w: number } {
    return { x: plotLeft + slotWidth() * index, w: slotWidth() };
  }

  function yAt(value: number): number {
    return padTop + (1 - value / 5) * plotHeight;
  }

  function lineRuns(series: number): string[] {
    const runs: string[] = [];
    let current: string[] = [];
    points.forEach((point, index) => {
      const value = point.values[series];
      if (value == null) {
        if (current.length) runs.push(current.join(' '));
        current = [];
        return;
      }
      current.push(`${xAt(index)},${yAt(value)}`);
    });
    if (current.length) runs.push(current.join(' '));
    return runs;
  }

  let solo = $state<string | null>(null);
  const shown = $derived(solo && series.some(domain => domain.id === solo) ? solo : null);

  function openPoint(event: MouseEvent, date: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onopen(date);
  }

  function showOnly(event: MouseEvent, id: string) {
    event.stopPropagation();
    solo = id;
  }

  function showAll(event: MouseEvent) {
    const target = event.target;
    if (target instanceof Element && target.closest('a.column, button')) return;
    solo = null;
  }
</script>

{#if points.length}
  <svg viewBox="0 0 {width} {height}" class="trend block h-auto w-full" role="group" aria-label="Progression par domaine" onclick={showAll}>
    {#each [0, 1, 2, 3, 4, 5] as level (level)}
      <line x1={plotLeft} y1={yAt(level)} x2={width - padRight} y2={yAt(level)} class="stroke-gray-200 dark:stroke-gray-700" stroke-width="1" />
      <text x={scaleX} y={yAt(level) + 4} text-anchor="end" class="fill-gray-500 text-[12px]">{level}</text>
    {/each}
    {#each series as domain, index (domain.id)}
      {#if !shown || shown === domain.id}
        {#each lineRuns(index) as run (run)}
          <polyline points={run} fill="none" stroke={colors[index % colors.length]} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {/each}
      {/if}
    {/each}
    {#each points as point, index (point.date)}
      {#each series as domain, item (domain.id)}
        {#if point.values[item] != null && (!shown || shown === domain.id)}
          <circle cx={xAt(index)} cy={yAt(point.values[item] ?? 0)} r="2.5" fill={colors[item % colors.length]} pointer-events="none">
            <title>{domain.name} · {formatAverage(point.values[item])} · {point.title}</title>
          </circle>
        {/if}
      {/each}
    {/each}
    {#each points as point, index (point.date)}
      {@const band = bandAt(index)}
      <a
        href="/seasons/{season}/{player}/{point.date}"
        class="column"
        aria-label="Ouvrir l'évaluation du {point.title}"
        onclick={(event) => openPoint(event, point.date)}
      >
        <rect class="band" x={band.x} y="0" width={band.w} height={height} />
        <text class="date" x={xAt(index)} y={height - 8} text-anchor="middle">{point.label}</text>
      </a>
    {/each}
  </svg>
  <ul class="legend mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm" onclick={showAll}>
    {#each series as domain, index (domain.id)}
      <li>
        <button
          type="button"
          class="legend-item"
          class:is-off={shown !== null && shown !== domain.id}
          aria-pressed={shown === domain.id}
          onclick={(event) => showOnly(event, domain.id)}
        >
          <span class="inline-block h-2.5 w-2.5 rounded-full" style="background: {colors[index % colors.length]}"></span>
          {domain.name}
        </button>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-sm text-gray-500">Aucune évaluation</p>
{/if}

<style>
  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .legend-item.is-off { opacity: 0.35; }
  .column { cursor: pointer; }
  .band { fill: transparent; }
  .date { fill: #4b5563; font-size: 12px; }
  .column:hover .band { fill: rgb(235 79 39 / 0.12); }
  .column:hover .date { fill: var(--color-brand); }
  :global(.dark) .date { fill: #d1d5db; }
</style>
