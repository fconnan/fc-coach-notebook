<script lang="ts">
  import { Button, Select } from 'flowbite-svelte';
  import { PauseOutline, PlayOutline } from 'flowbite-svelte-icons';
  import { loadExercisePreview, type ExercisePreview } from '$lib/schema/preview';

  let { at, exerciseId = '', compact = false }: { at: string; exerciseId?: string; compact?: boolean } = $props();

  let preview = $state<ExercisePreview | null>(null);
  let shownFor = $state('');
  let error = $state('');
  let phase = $state(0);
  let progress = $state(0);
  let playing = $state(false);

  const token = $derived(exerciseId || at);
  const active = $derived(preview && shownFor === token ? preview : null);
  const svg = $derived(active ? active.render(phase, progress) : '');
  const phases = $derived(active?.phases || []);

  $effect(() => {
    const path = at;
    const id = exerciseId;
    const key = id || path;
    if (!key) return;
    let cancelled = false;
    void loadExercisePreview(path, id).then(next => {
      if (cancelled) return;
      preview = next;
      shownFor = key;
      error = '';
      phase = 0;
      progress = 0;
      playing = false;
    }).catch(err => {
      if (cancelled) return;
      if (shownFor === key) return;
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
  <div class="overflow-hidden bg-[#166534]">
    {#if svg}
      <div class="sheet" class:compact>{@html svg}</div>
    {:else}
      <div class="flex aspect-[3/2] items-center justify-center px-4 text-center text-sm text-white/80">
        {error || 'Schéma…'}
      </div>
    {/if}
  </div>
  {#if !compact}
  <div class="schema-bar flex items-center gap-1.5 px-1.5">
    {#if phases.length}
      <Select
        size="sm"
        class="w-36"
        placeholder=""
        value={String(phase)}
        items={phases.map((item, index) => ({ value: String(index), name: item.name }))}
        onchange={(e) => showPhase(Number(fieldValue(e)))}
      />
    {/if}
    <Button size="xs" color="alternative" class="shrink-0" disabled={!phases.length} title={phases.length ? undefined : 'Ce schéma n’a pas d’animation'} onclick={togglePlay}>
      {#if playing}
        <PauseOutline class="me-1 h-3.5 w-3.5" /> Pause
      {:else}
        <PlayOutline class="me-1 h-3.5 w-3.5" /> Lire
      {/if}
    </Button>
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
    height: 2.25rem;
    background: var(--color-neutral-secondary-medium);
    border-top: 1px solid var(--color-default-medium);
  }
  .schema-bar :global(select) {
    height: 1.75rem;
    min-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    font-size: 0.75rem;
  }
  .schema-bar :global(button) {
    height: 1.75rem;
    padding-top: 0;
    padding-bottom: 0;
  }
</style>
