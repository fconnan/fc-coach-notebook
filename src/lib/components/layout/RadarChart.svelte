<script lang="ts">
  let { labels, values, compact = false }: { labels: string[]; values: (number | null)[]; compact?: boolean } = $props();

  const fontSize = 12;
  const lineHeight = 14;
  const compactRadius = 64;
  const compactReach = compactRadius + 12;

  function estimate(text: string): number {
    let width = 0;
    for (const char of text) {
      if (char === ' ') width += 3.6;
      else if ("iljI'’.,".includes(char)) width += 3.3;
      else if ('mwMW'.includes(char)) width += 10.2;
      else if (char.toUpperCase() === char && char.toLowerCase() !== char) width += 8.1;
      else width += 6.8;
    }
    return width;
  }

  function wrapLabel(text: string): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && estimate(next) > 108) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  const labelLines = $derived(labels.map(label => wrapLabel(label)));
  const labelWidth = $derived(labelLines.length ? Math.max(72, ...labelLines.flat().map(line => Math.ceil(estimate(line)) + 8)) : 72);
  const maxLines = $derived(labelLines.length ? Math.max(1, ...labelLines.map(lines => lines.length)) : 1);
  const extra = $derived(compact ? (maxLines - 1) * lineHeight : 0);
  const compactSide = $derived(compactReach * Math.cos(Math.PI / 10) + labelWidth);
  const width = $derived(compact ? Math.ceil(compactSide * 2 + 8) : 420);
  const centerX = $derived(compact ? width / 2 : 210);
  const centerY = $derived(compact ? compactReach + fontSize + 2 + extra : 168);
  const height = $derived(compact ? Math.ceil(centerY + compactReach + fontSize + 4 + extra) : 340);
  const radius = $derived(compact ? compactRadius : 78);
  const labelReach = $derived(compact ? compactReach : radius + 22);

  function at(index: number, value: number, reach = radius) {
    const count = Math.max(labels.length, 1);
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      x: centerX + Math.cos(angle) * (value / 5) * reach,
      y: centerY + Math.sin(angle) * (value / 5) * reach,
      angle
    };
  }

  const rings = $derived([1, 2, 3, 4, 5].map(level => labels.map((_, index) => at(index, level)).map(point => `${point.x},${point.y}`).join(' ')));
  const axes = $derived(labels.map((_, index) => at(index, 5)));
  const runs = $derived.by(() => {
    const count = values.length;
    const groups: number[][] = [];
    let current: number[] = [];
    for (let index = 0; index < count; index += 1) {
      if (values[index] == null) {
        if (current.length) groups.push(current);
        current = [];
      } else current.push(index);
    }
    if (current.length) groups.push(current);
    if (groups.length > 1 && values[0] != null && values[count - 1] != null) {
      groups[0] = [...groups[groups.length - 1], ...groups[0]];
      groups.pop();
    }
    return groups;
  });
  const closed = $derived(runs.length === 1 && runs[0].length === values.length);
  const points = $derived(labels.map((_, index) => values[index] == null ? null : at(index, values[index] as number)));
</script>

<svg viewBox="0 0 {width} {height}" class={compact ? 'h-auto w-full' : 'mx-auto h-72 w-full max-w-md'} role="img">
  {#each rings as points, index (index)}
    <polygon points={points} fill="none" stroke="currentColor" stroke-opacity={index === 4 ? 0.45 : 0.18} />
  {/each}
  {#each axes as point, index (index)}
    <line x1={centerX} y1={centerY} x2={point.x} y2={point.y} stroke="currentColor" stroke-opacity="0.18" />
    {@const label = at(index, 5, labelReach)}
    {@const lines = labelLines[index]}
    {@const shift = Math.sin(label.angle) > 0.45 ? 0 : Math.sin(label.angle) < -0.45 ? -((lines.length - 1) * lineHeight) : -((lines.length - 1) * lineHeight) / 2}
    <text
      x={label.x}
      y={label.y}
      text-anchor={Math.cos(label.angle) > 0.35 ? 'start' : Math.cos(label.angle) < -0.35 ? 'end' : 'middle'}
      dominant-baseline={Math.sin(label.angle) > 0.45 ? 'hanging' : Math.sin(label.angle) < -0.45 ? 'auto' : 'middle'}
      font-size={compact ? fontSize : undefined}
      class={compact ? 'fill-current' : 'fill-current text-[10px]'}
    >{#each lines as line, row (row)}<tspan x={label.x} dy={row === 0 ? shift : lineHeight}>{line}</tspan>{/each}</text>
  {/each}
  {#if closed}
    <polygon
      points={points.filter(point => point).map(point => `${point?.x},${point?.y}`).join(' ')}
      fill="var(--color-brand)"
      fill-opacity="0.2"
      stroke="var(--color-brand)"
      stroke-width="2"
    />
  {:else}
    {#each runs as run, index (index)}
      {#if run.length > 1}
        <polyline
          points={run.map(item => { const point = at(item, values[item] as number); return `${point.x},${point.y}`; }).join(' ')}
          fill="none"
          stroke="var(--color-brand)"
          stroke-width="2"
        />
      {/if}
    {/each}
  {/if}
  {#each points as point, index (index)}
    {#if point}
      <circle cx={point.x} cy={point.y} r="3.5" fill="var(--color-brand)" />
    {/if}
  {/each}
</svg>
