<script lang="ts">
  import { PauseOutline, PlayOutline } from 'flowbite-svelte-icons';
  import { liveExercisePreview, loadExercisePreview, type ExercisePreview } from '$lib/schema/preview';

  let { at = '', exerciseId = '', compact = false, source = undefined as string | undefined }: {
    at?: string;
    exerciseId?: string;
    compact?: boolean;
    source?: string;
  } = $props();

  let preview = $state<ExercisePreview | null>(null);
  let shownFor = $state('');
  let error = $state('');
  let phase = $state(0);
  let progress = $state(0);
  let playing = $state(false);

  const token = $derived(source === undefined ? (exerciseId || at) : `live:${exerciseId || at}`);
  const active = $derived(preview && shownFor === token ? preview : null);
  const svg = $derived(active ? active.render(phase, progress) : '');
  const phases = $derived(active?.phases || []);

  $effect(() => {
    const path = at;
    const id = exerciseId;
    const live = source;
    const key = live === undefined ? (id || path) : `live:${id || path}`;
    if (!key) return;
    let cancelled = false;
    const task = live === undefined ? loadExercisePreview(path, id) : liveExercisePreview(live, path, id);
    void task.then(next => {
      if (cancelled) return;
      preview = next;
      shownFor = key;
      error = '';
      if (live === undefined || phase >= next.phases.length) {
        phase = 0;
        progress = 0;
        playing = false;
      }
    }).catch(err => {
      if (cancelled) return;
      if (live === undefined && shownFor === key) return;
      preview = null;
      shownFor = '';
      error = err instanceof Error ? err.message : 'Schéma illisible';
    });
    return () => { cancelled = true; };
  });

  $effect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const steps = phases;
      if (!steps.length) {
        last = now;
        return;
      }
      const duration = (steps[phase]?.duration || 4) * 1000;
      const delta = last ? now - last : 0;
      last = now;
      const next = progress + delta / duration;
      if (next >= 1) {
        progress = 0;
        phase = (phase + 1) % steps.length;
      } else {
        progress = next;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  function showPhase(index: number) {
    playing = false;
    phase = index;
    progress = 1;
  }

  function togglePlay() {
    if (!phases.length) return;
    playing = !playing;
    if (playing) progress = 0;
  }

  function fieldValue(event: Event): string {
    const target = event.currentTarget;
    return target instanceof HTMLSelectElement ? target.value : '';
  }
</script>

<div class="schema">
  <div class="pitch overflow-hidden bg-[#166534]">
    {#if svg}
      <div class="sheet" class:compact>{@html svg}</div>
    {:else}
      <div class="flex aspect-[3/2] items-center justify-center px-4 text-center text-sm text-white/80">
        {error || 'Schéma…'}
      </div>
    {/if}
  </div>
  {#if !compact}
  <div class="schema-bar">
    <button type="button" class="bar-btn" disabled={!phases.length} title={phases.length ? undefined : 'Ce schéma n’a pas d’animation'} onclick={togglePlay}>
      {#if playing}
        <PauseOutline class="bar-icon" /> Pause
      {:else}
        <PlayOutline class="bar-icon" /> Lire
      {/if}
    </button>
    {#if phases.length}
      <select class="bar-select" aria-label="Phase" value={String(phase)} onchange={(e) => showPhase(Number(fieldValue(e)))}>
        {#each phases as item, index (item.name + index)}
          <option value={String(index)}>{item.name}</option>
        {/each}
      </select>
    {/if}
  </div>
  {/if}
</div>

<style>
  .schema {
    overflow: hidden;
    border: 1px solid var(--color-default-medium);
    border-radius: 0;
  }
  .sheet :global(svg) { display: block; width: 100%; height: auto; }
  .sheet.compact { display: flex; justify-content: center; height: 7.5rem; }
  .sheet.compact :global(svg) { width: auto; max-width: 100%; height: 100%; }
  .schema-bar {
    display: flex;
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
  .bar-select { margin-left: auto; border-left: 1px solid var(--color-default-medium); }
  .bar-btn:disabled { color: var(--color-body); }
  .bar-select:hover,
  .bar-btn:hover:not(:disabled) { background: var(--color-neutral-secondary-medium); }
</style>
