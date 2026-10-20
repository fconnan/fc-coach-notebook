<script lang="ts">
  import { onMount } from 'svelte';
  import { parse } from 'yaml';
  import { buildScene, libraryFor, renderSvg } from '$lib/schema/scene';
  import type { LibraryEntry, SchemaDoc } from '$lib/schema/types';

  let { at }: { at: string } = $props();

  let source = $state('');
  let library = $state<LibraryEntry[]>([]);
  let error = $state('');
  let saved = $state('');
  let phase = $state(0);
  let progress = $state(0);
  let playing = $state(false);
  let host: HTMLDivElement | null = $state(null);
  let loaded = $state(false);

  let lastSvg = $state('');
  const parsed = $derived.by(() => {
    if (!loaded) return { doc: null as SchemaDoc | null, message: '' };
    try {
      const doc = parse(source) as SchemaDoc;
      if (!doc || typeof doc !== 'object') return { doc: null, message: 'YAML illisible' };
      return { doc, message: '' };
    } catch (err) {
      return { doc: null, message: err instanceof Error ? err.message : 'YAML illisible' };
    }
  });
  const scene = $derived.by(() => {
    if (!parsed.doc) return null;
    const names = libraryFor(at, library, `${at}/schema.yaml`);
    return buildScene(parsed.doc, names, phase, progress);
  });
  $effect(() => {
    if (scene) lastSvg = renderSvg(scene);
  });

  async function load() {
    loaded = false;
    const response = await fetch(`/api/schema?at=${encodeURIComponent(at)}`);
    const body = await response.json() as { source?: string; library?: LibraryEntry[]; error?: string };
    if (!response.ok) {
      error = body.error || 'Lecture impossible';
      return;
    }
    library = body.library || [];
    source = body.source || 'type: fc-tactics-schema\nversion: 0\nname: exercise\npitch:\n  template: half\n';
    loaded = true;
    phase = 0;
    progress = 0;
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleSave(text: string) {
    saved = 'Modification…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const response = await fetch('/api/schema', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ at, source: text })
      });
      saved = response.ok ? 'Enregistré' : 'Échec de l’enregistrement';
    }, 500);
  }

  function onSource(text: string) {
    source = text;
    scheduleSave(text);
  }

  onMount(() => {
    let editor: { dispose: () => void; getModel: () => { dispose: () => void } | null } | null = null;
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled || !host) return;
      try {
        const monaco = await import('$lib/schema/monaco');
        if (cancelled || !host) return;
        editor = monaco.mountYaml(host, source, library.map(entry => entry.name), onSource);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Éditeur indisponible';
      }
    })();
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!playing || !scene || !scene.phases.length) {
        last = now;
        return;
      }
      const duration = (scene.phases[phase]?.duration || 4) * 1000;
      progress = Math.min(1, progress + (now - last) / duration);
      last = now;
      if (progress >= 1) {
        progress = 0;
        phase = (phase + 1) % scene.phases.length;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(saveTimer);
      editor?.getModel()?.dispose();
      editor?.dispose();
    };
  });
</script>

<div class="schema">
  <div class="yaml" bind:this={host}></div>
  <div class="preview">
    <div class="bar">
      {#each scene?.phases || [] as item, index}
        <button type="button" class:on={index === phase} onclick={() => { playing = false; phase = index; progress = 1; }}>
          {item.name}
        </button>
      {/each}
      <button type="button" class:on={playing} onclick={() => { playing = !playing; if (playing) progress = 0; }}>
        {playing ? 'Pause' : 'Lire'}
      </button>
      <span class="state">{saved}</span>
    </div>
    {#if parsed.message || error}<p class="error">{parsed.message || error}</p>{/if}
    {#if lastSvg}
      <div class="sheet">{@html lastSvg}</div>
    {/if}
  </div>
</div>

<style>
  .schema { display: flex; min-height: 0; flex: 1; background: #f8fafc; }
  .yaml { flex: 1; min-width: 0; border-right: 1px solid #e2e8f0; }
  .preview { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 12px; gap: 8px; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  button { border: 1px solid #d4d4d4; background: #fff; color: #0f172a; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
  button.on { background: #2563eb; color: #fff; border-color: #2563eb; }
  .state { margin-left: auto; color: #64748b; font-size: 13px; }
  .error { margin: 0; color: #b91c1c; font-size: 13px; }
  .sheet { flex: 1; min-height: 0; background: #14532d; border-radius: 12px; overflow: hidden; }
  .sheet :global(svg) { width: 100%; height: 100%; display: block; }
</style>
