<script lang="ts">
  import { onMount } from 'svelte';
  import { parse } from 'yaml';
  import { Button, Modal, Select } from 'flowbite-svelte';
  import { PauseOutline, PlayOutline } from 'flowbite-svelte-icons';
  import { pages, type Page } from '$lib/stores/workspace';
  import { applyExerciseDocument } from '$lib/workspace/exerciseFile';
  import { registerExerciseLeave, registerExerciseSaver } from '$lib/workspace/exerciseDraft';
  import { persistCursor, screen } from '$lib/workspace/state';
  import { buildScene, libraryFor, renderSvg } from '$lib/schema/scene';
  import type { LibraryEntry, SchemaDoc } from '$lib/schema/types';
  import MarkdownEditor from './MarkdownEditor.svelte';

  let { at, exerciseId = '' }: { at: string; exerciseId?: string } = $props();

  let markdown = $state('');
  let yaml = $state('');
  let markdownDisk = $state('');
  let yamlDisk = $state('');
  let markdownTouched = false;
  let yamlTouched = false;
  let library = $state<LibraryEntry[]>([]);
  let error = $state('');
  let status = $state('');
  let loaded = $state(false);
  let saving = $state(false);
  let preview = $state(false);
  let ask = $state(false);
  let leaveChoice: ((ok: boolean) => void) | null = null;
  const unsaved = { current: false };
  let phase = $state(0);
  let progress = $state(0);
  let playing = $state(false);
  let lastSvg = $state('');
  let host: HTMLDivElement | null = $state(null);

  function canon(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  }

  function same(a: string, b: string): boolean {
    return canon(a) === canon(b);
  }

  function withNewline(text: string, previous: string): string {
    const lf = text.replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n';
    return previous.includes('\r\n') ? lf.replace(/\n/g, '\r\n') : lf;
  }

  const dirty = $derived(loaded && (!same(markdown, markdownDisk) || !same(yaml, yamlDisk)));

  const parsed = $derived.by(() => {
    if (!loaded) return { doc: null as SchemaDoc | null, message: '' };
    try {
      const doc = parse(yaml) as SchemaDoc;
      if (!doc || typeof doc !== 'object') return { doc: null, message: 'YAML illisible' };
      return { doc, message: '' };
    } catch (err) {
      return { doc: null, message: err instanceof Error ? err.message : 'YAML illisible' };
    }
  });

  const scene = $derived.by(() => {
    if (!parsed.doc) return null;
    return buildScene(parsed.doc, libraryFor(at, library, `${at}/schema.yaml`), phase, progress);
  });

  $effect(() => {
    if (scene) lastSvg = renderSvg(scene);
  });

  $effect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const steps = scene?.phases || [];
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

  function onMarkdown(text: string) {
    markdown = text;
    if (!markdownTouched && same(text, markdownDisk)) markdownDisk = text;
    else markdownTouched = true;
  }

  function onYaml(text: string) {
    yaml = text;
    if (!yamlTouched && same(text, yamlDisk)) yamlDisk = text;
    else yamlTouched = true;
  }

  async function load() {
    loaded = false;
    error = '';
    if (!at && !exerciseId) {
      error = 'Ce dossier d’exercice est introuvable.';
      return;
    }
    const query = new URLSearchParams();
    if (at) query.set('at', at);
    if (exerciseId) query.set('id', exerciseId);
    const response = await fetch(`/api/schema?${query}`);
    const body = await response.json() as { source?: string; markdown?: string; library?: LibraryEntry[]; error?: string };
    if (!response.ok) {
      error = body.error || 'Lecture impossible';
      return;
    }
    library = body.library || [];
    markdown = markdownDisk = body.markdown || '';
    yaml = yamlDisk = body.source || 'type: fccn-schema:0\nname: exercise\npitch:\n  template: half\n';
    markdownTouched = false;
    yamlTouched = false;
    loaded = true;
    phase = 0;
    progress = 0;
    playing = false;
    status = '';
  }

  async function save(): Promise<boolean> {
    if (saving || !loaded || (!at && !exerciseId)) return false;
    const next: { at: string; id: string; source?: string; markdown?: string } = { at, id: exerciseId };
    if (!same(markdown, markdownDisk)) next.markdown = withNewline(markdown, markdownDisk);
    if (!same(yaml, yamlDisk)) next.source = withNewline(yaml, yamlDisk);
    if (!next.markdown && !next.source) {
      status = 'Enregistré';
      return true;
    }
    saving = true;
    status = 'Enregistrement…';
    try {
      const response = await fetch('/api/schema', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next)
      });
      if (!response.ok) {
        status = 'Échec de l’enregistrement';
        return false;
      }
      if (next.markdown) {
        markdownDisk = markdown;
        const written = next.markdown;
        pages.update(list => list.map(page => (
          page.id === exerciseId ? applyExerciseDocument({ ...page }, written) as unknown as Page : page
        )));
      }
      if (next.source) yamlDisk = yaml;
      const { warning } = await response.json() as { warning?: string };
      status = warning ? `Enregistré (${warning})` : 'Enregistré';
      return true;
    } catch {
      status = 'Échec de l’enregistrement';
      return false;
    } finally {
      saving = false;
    }
  }

  function finishLeave(ok: boolean) {
    const resolve = leaveChoice;
    leaveChoice = null;
    ask = false;
    resolve?.(ok);
  }

  function askToLeave(): Promise<boolean> {
    if (!dirty) return Promise.resolve(true);
    if (leaveChoice) {
      return new Promise(resolve => {
        const previous = leaveChoice;
        leaveChoice = (ok) => {
          previous?.(ok);
          resolve(ok);
        };
      });
    }
    ask = true;
    return new Promise(resolve => {
      leaveChoice = resolve;
    });
  }

  async function chooseSave() {
    const ok = await save();
    if (!ok) return;
    finishLeave(true);
  }

  function showSeance() {
    screen.set('seance');
    persistCursor();
  }

  async function closeEditor() {
    if (!(await askToLeave())) return;
    showSeance();
  }

  function abandon() {
    showSeance();
  }

  function showPhase(index: number) {
    playing = false;
    phase = index;
    progress = 1;
  }

  function togglePlay() {
    const count = scene?.phases.length || 0;
    if (!count) return;
    playing = !playing;
    if (playing) progress = 0;
  }

  function fieldValue(event: Event): string {
    const target = event.currentTarget;
    return target instanceof HTMLSelectElement ? target.value : '';
  }

  $effect(() => {
    unsaved.current = dirty;
  });

  $effect(() => {
    if (ask || !leaveChoice) return;
    finishLeave(false);
  });

  onMount(() => {
    const stop = registerExerciseSaver(save);
    const stopLeave = registerExerciseLeave(askToLeave);
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsaved.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    let editor: { dispose: () => void; getModel: () => { dispose: () => void } | null } | null = null;
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled || !host) return;
      try {
        const monaco = await import('$lib/schema/monaco');
        if (cancelled || !host) return;
        editor = monaco.mountYaml(host, yaml, library.map(entry => entry.name), onYaml);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Éditeur indisponible';
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', onBeforeUnload);
      finishLeave(false);
      stop();
      stopLeave();
      editor?.getModel()?.dispose();
      editor?.dispose();
    };
  });
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
  <div class="flex shrink-0 items-center gap-3">
    <p class="text-sm text-body">{status}</p>
    <div class="ms-auto flex gap-2">
      <Button size="sm" color="brand" disabled={!dirty || saving} onclick={() => { void save(); }}>Sauver</Button>
      <Button size="sm" color="alternative" disabled={saving} onclick={() => { void closeEditor(); }}>Fermer</Button>
      <Button size="sm" color="alternative" disabled={saving} onclick={abandon}>Annuler</Button>
    </div>
  </div>
  {#if error}<p class="text-sm text-red-700">{error}</p>{/if}
  <div class="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
    <section class="flex min-h-80 flex-col overflow-hidden rounded-xl border border-default-medium bg-neutral-primary lg:min-h-0">
      <header class="flex items-center gap-2 border-b border-default-medium px-3 py-2">
        <h2 class="text-sm font-semibold">Markdown</h2>
        <div class="ms-auto flex gap-1">
          <Button size="xs" color={preview ? 'alternative' : 'brand'} onclick={() => preview = false}>Édition</Button>
          <Button size="xs" color={preview ? 'brand' : 'alternative'} onclick={() => preview = true}>Aperçu</Button>
        </div>
      </header>
      <div class="min-h-0 flex-1">
        {#if loaded}
          <MarkdownEditor embedded {preview} value={markdown} onchange={onMarkdown} />
        {/if}
      </div>
    </section>

    <section class="flex min-h-80 flex-col overflow-hidden rounded-xl border border-default-medium bg-neutral-primary lg:min-h-0">
      <header class="border-b border-default-medium px-3 py-2">
        <h2 class="text-sm font-semibold">YAML</h2>
      </header>
      <div class="yaml min-h-0 flex-1" bind:this={host}></div>
    </section>

    <section class="flex min-h-80 flex-col overflow-hidden rounded-xl border border-default-medium bg-neutral-primary lg:min-h-0">
      <header class="flex flex-wrap items-center gap-2 border-b border-default-medium px-3 py-2">
        <h2 class="text-sm font-semibold">Schéma</h2>
        {#if scene?.phases.length}
          <Select
            size="sm"
            class="ms-auto w-36"
            placeholder=""
            value={String(phase)}
            items={scene.phases.map((item, index) => ({ value: String(index), name: item.name }))}
            onchange={(e) => showPhase(Number(fieldValue(e)))}
          />
          <Button size="xs" color="alternative" onclick={togglePlay}>
            {#if playing}
              <PauseOutline class="me-1 h-3.5 w-3.5" /> Pause
            {:else}
              <PlayOutline class="me-1 h-3.5 w-3.5" /> Lire
            {/if}
          </Button>
        {/if}
      </header>
      <div class="flex min-h-0 flex-1 flex-col gap-2 p-3">
        {#if parsed.message}<p class="text-sm text-red-700">{parsed.message}</p>{/if}
        {#if lastSvg}
          <div class="sheet min-h-0 flex-1">{@html lastSvg}</div>
        {:else}
          <div class="flex flex-1 items-center justify-center rounded-xl bg-[#166534] text-sm text-white/80">Schéma…</div>
        {/if}
      </div>
    </section>
  </div>
  <Modal bind:open={ask} title="Modifications non enregistrées" size="sm">
    <p class="text-sm text-body">Enregistrer avant de quitter ?</p>
    {#snippet footer()}
      <Button color="brand" disabled={saving} onclick={() => { void chooseSave(); }}>Sauver</Button>
      <Button color="alternative" disabled={saving} onclick={() => finishLeave(true)}>Ne pas sauver</Button>
      <Button color="alternative" disabled={saving} onclick={() => finishLeave(false)}>Rester</Button>
    {/snippet}
  </Modal>
</div>

<style>
  .yaml { min-height: 0; }
  .sheet { overflow: hidden; border-radius: 12px; background: #166534; }
  .sheet :global(svg) { display: block; width: 100%; height: 100%; }
</style>
