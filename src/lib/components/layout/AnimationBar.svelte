<script lang="ts">
  import { PauseOutline, PlayOutline, RefreshOutline } from 'flowbite-svelte-icons';

  let {
    phases,
    phase,
    playing,
    onphase,
    onreset,
    ontoggle
  }: {
    phases: { name: string }[];
    phase: number;
    playing: boolean;
    onphase: (index: number) => void;
    onreset: () => void;
    ontoggle: () => void;
  } = $props();

  function fieldValue(event: Event): string {
    const target = event.currentTarget;
    return target instanceof HTMLSelectElement ? target.value : '';
  }
</script>

<div class="schema-bar">
  {#if phases.length}
    <select class="bar-select" aria-label="Phase" value={String(phase)} onchange={(event) => onphase(Number(fieldValue(event)))}>
      {#each phases as item, index (item.name + index)}
        <option value={String(index)}>{item.name}</option>
      {/each}
    </select>
  {/if}
  <button type="button" class="bar-btn" disabled={!phases.length} onclick={onreset}>
    <RefreshOutline class="bar-icon" /> Reset
  </button>
  <button type="button" class="bar-btn" disabled={!phases.length} title={phases.length ? undefined : 'Ce schéma n’a pas d’animation'} onclick={ontoggle}>
    {#if playing}
      <PauseOutline class="bar-icon" /> Pause
    {:else}
      <PlayOutline class="bar-icon" /> Lire
    {/if}
  </button>
</div>

<style>
  .schema-bar {
    display: flex;
    flex-shrink: 0;
    background: var(--color-neutral-primary);
    border-top: 1px solid var(--color-default-medium);
  }
  .bar-select,
  .bar-btn {
    height: 1.5rem;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding: 0 0.45rem;
    font-size: 0.75rem;
    color: var(--color-heading);
  }
  .bar-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
  }
  .bar-btn :global(.bar-icon) { width: 0.85rem; height: 0.85rem; }
  .schema-bar > * + * { border-left: 1px solid var(--color-default-medium); }
  .bar-btn:disabled { color: var(--color-body); }
  .bar-select:hover,
  .bar-btn:hover:not(:disabled) { background: var(--color-neutral-secondary-medium); }
</style>
