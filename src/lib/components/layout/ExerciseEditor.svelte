<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { Button, ButtonGroup, Modal } from 'flowbite-svelte';
  import { pages, type Page } from '$lib/stores/workspace';
  import { applyExerciseDocument } from '$lib/workspace/exerciseFile';
  import { exerciseHtml } from '$lib/workspace/markdownHtml';
  import { registerExerciseLeave, registerExerciseSaver } from '$lib/workspace/exerciseDraft';
  import { persistCursor, screen } from '$lib/workspace/state';
  import { addAnimation, addObject, addShape, choosePitch, libraryIcon, ofKind, templateOf } from '$lib/schema/assist';
  import type { LibraryEntry } from '$lib/schema/types';
  import SchemaPreview from './SchemaPreview.svelte';

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
  let ask = $state(false);
  let leaveChoice: ((ok: boolean) => void) | null = null;
  const unsaved = { current: false };
  let markdownHost: HTMLDivElement | null = $state(null);
  let yamlHost: HTMLDivElement | null = $state(null);
  let yamlEditor: { setValue: (value: string) => void } | null = null;
  const PART_KEY = 'fctactics_exercise_part';
  let part = $state<'description' | 'schema'>(browser && sessionStorage.getItem(PART_KEY) === 'schema' ? 'schema' : 'description');
  let picker = $state<'pitches' | 'objects' | 'shapes' | 'animations' | null>(null);
  let pickerHost = $state<HTMLDivElement | null>(null);

  const ficheHtml = $derived.by(() => {
    if (!loaded) return '';
    return exerciseHtml(applyExerciseDocument({ id: exerciseId, name: '' }, markdown) as Page);
  });

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

  const pitches = $derived(ofKind(library, 'pitches'));
  const objects = $derived(ofKind(library, 'objects'));
  const shapes = $derived(ofKind(library, 'shapes'));
  const animations = $derived(ofKind(library, 'animations'));
  const currentPitch = $derived(templateOf(yaml));
  const pickerItems = $derived(
    picker === 'pitches' ? pitches
    : picker === 'objects' ? objects
    : picker === 'shapes' ? shapes
    : picker === 'animations' ? animations
    : []
  );

  function pitchLabel(name: string): string {
    if (name === 'full') return 'Complet';
    if (name === 'half') return 'Demi';
    if (name === 'two-thirds') return 'Deux tiers';
    if (name === 'penalty') return 'Surface';
    if (name === 'penalty-wide') return 'Surface élargie';
    const sized = /^rect-(\d+)x(\d+)$/.exec(name);
    if (sized) return `${sized[1]} × ${sized[2]}`;
    return name.replace(/-/g, ' ');
  }

  function caption(entry: LibraryEntry): string {
    return picker === 'pitches' ? pitchLabel(entry.name) : entry.name;
  }

  function writeYaml(next: string) {
    if (yamlEditor) yamlEditor.setValue(next);
    else yaml = next;
  }

  function assist(change: () => string) {
    try {
      writeYaml(change());
      error = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'YAML illisible';
    }
  }

  function choose(entry: LibraryEntry) {
    const kind = picker;
    picker = null;
    if (kind === 'pitches') {
      if (entry.name !== currentPitch) assist(() => choosePitch(yaml, entry.name));
    } else if (kind === 'objects') assist(() => addObject(yaml, entry.name, library));
    else if (kind === 'shapes') assist(() => addShape(yaml, entry.name));
    else if (kind === 'animations') assist(() => addAnimation(yaml, entry));
  }

  function showPart(next: 'description' | 'schema') {
    part = next;
    try { sessionStorage.setItem(PART_KEY, next); } catch { /* quota */ }
  }

  function onPickerKey(event: KeyboardEvent) {
    if (event.key === 'Escape') picker = null;
  }

  $effect(() => {
    const node = pickerHost;
    if (!picker || !node) return;
    if (!node.matches(':popover-open')) node.showPopover();
  });

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
    const editors: Array<{ dispose: () => void; getModel: () => { dispose: () => void } | null }> = [];
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled || !markdownHost || !yamlHost) return;
      try {
        const monaco = await import('$lib/schema/monaco');
        if (cancelled || !markdownHost || !yamlHost) return;
        const yamlEd = monaco.mountYaml(yamlHost, yaml, library.map(entry => entry.name), onYaml);
        yamlEditor = yamlEd;
        editors.push(monaco.mountMarkdown(markdownHost, markdown, onMarkdown));
        editors.push(yamlEd);
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
      for (const editor of editors) {
        editor.getModel()?.dispose();
        editor.dispose();
      }
      yamlEditor = null;
    };
  });
</script>

<svelte:window onkeydown={onPickerKey} />

<div class="flex h-full min-h-0 flex-col gap-3">
  <div class="flex shrink-0 items-center gap-3">
    <ButtonGroup size="sm" aria-label="Partie de l’exercice">
      <Button size="sm" color={part === 'description' ? 'brand' : 'alternative'} onclick={() => showPart('description')}>Description</Button>
      <Button size="sm" color={part === 'schema' ? 'brand' : 'alternative'} onclick={() => showPart('schema')}>Schéma</Button>
    </ButtonGroup>
    <p class="text-sm text-body">{status}</p>
    <div class="ms-auto flex items-center gap-2">
      <Button size="sm" color="brand" disabled={!dirty || saving} onclick={() => { void save(); }}>Sauver</Button>
      <Button size="sm" color="alternative" disabled={saving} onclick={() => { void closeEditor(); }}>Fermer</Button>
      <Button size="sm" color="alternative" disabled={saving} onclick={abandon}>Annuler</Button>
    </div>
  </div>
  {#if error}<p class="text-sm text-red-700">{error}</p>{/if}
  <div class={part === 'description' ? 'grid min-h-0 flex-1 grid-cols-2 gap-3' : 'hidden'}>
    <div class="panel editor"><div class="monaco" bind:this={markdownHost}></div></div>
    <div class="panel preview">
      <div class="preview-body">
        <div class="exercise-md">{@html ficheHtml}</div>
      </div>
    </div>
  </div>
  <div class={part === 'schema' ? 'grid min-h-0 flex-1 grid-cols-2 gap-3' : 'hidden'}>
    <div class="panel editor"><div class="monaco" bind:this={yamlHost}></div></div>
    <div class="panel schema-slot">
      <div class="tools">
        <button type="button" class="tool" onclick={() => picker = 'pitches'}>Terrain</button>
        <button type="button" class="tool" onclick={() => picker = 'shapes'}>Compo</button>
        <button type="button" class="tool" onclick={() => picker = 'objects'}>Objet</button>
        <button type="button" class="tool" onclick={() => picker = 'animations'}>Animation</button>
      </div>
      <div class="schema-fit">
        {#if loaded}
          <SchemaPreview at={at} exerciseId={exerciseId} source={yaml} />
        {/if}
      </div>
    </div>
  </div>
  {#if picker}
    <div bind:this={pickerHost} popover="manual" class="veil" role="presentation" onclick={() => picker = null}>
      <div class="picker" role="dialog" aria-label={picker === 'pitches' ? 'Terrain' : picker === 'objects' ? 'Objet' : picker === 'shapes' ? 'Compo' : 'Animation'} tabindex="-1" onclick={(event) => event.stopPropagation()}>
        {#if pickerItems.length}
          <div class="icons">
            {#each pickerItems as entry (entry.file)}
              <button type="button" class="icon" class:current={picker === 'pitches' && entry.name === currentPitch} onclick={() => choose(entry)}>
                <span class="glyph">{@html libraryIcon(entry, picker || '')}</span>
                <span class="caption">{caption(entry)}</span>
              </button>
            {/each}
          </div>
        {:else}
          <p class="empty">Aucun élément dans le studio.</p>
        {/if}
      </div>
    </div>
  {/if}
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
  .editor,
  .preview {
    display: flex;
    min-height: 0;
    padding: 0.75rem;
  }
  .monaco,
  .preview-body {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }
  .monaco { border: 1px solid var(--color-gray-200); }
  .preview-body { overflow: auto; }
  .panel {
    min-height: 0;
    border: 1px solid var(--color-default-medium);
    border-radius: var(--radius-base);
    background: var(--color-neutral-primary);
  }
  .editor,
  .schema-slot { overflow: hidden; }
  .schema-slot {
    display: flex;
    flex-direction: column;
    padding: 0;
  }
  .tools {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-default-medium);
  }
  .tool {
    border: 0;
    border-right: 1px solid var(--color-default-medium);
    border-radius: 0;
    background: transparent;
    padding: 0.2rem 0.55rem;
    font-size: 0.75rem;
    color: var(--color-heading);
  }
  .tool:hover { background: var(--color-neutral-secondary-medium); }
  .veil {
    position: fixed;
    inset: 0;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding: 1rem;
  }
  .veil::backdrop { background: rgba(15, 23, 42, 0.28); }
  .picker {
    width: max-content;
    max-width: min(28rem, 100%);
    max-height: 70vh;
    overflow: auto;
    border: 1px solid var(--color-default-medium);
    border-radius: 0;
    background: var(--color-neutral-primary);
    padding: 0.35rem;
  }
  .icons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    width: max-content;
    max-width: 26.5rem;
  }
  .icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    width: 6.4rem;
    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;
    padding: 0.2rem;
    color: var(--color-heading);
  }
  .icon:hover,
  .icon.current { border-color: var(--color-default-medium); }
  .glyph {
    display: flex;
    width: 100%;
    height: 4rem;
    align-items: center;
    justify-content: center;
    background: #166534;
  }
  .glyph :global(svg) { display: block; width: 100%; height: 100%; }
  .caption { font-size: 0.7rem; line-height: 1.1; text-align: center; }
  .empty { margin: 0; padding: 0.4rem 0.55rem; font-size: 0.75rem; }
  .schema-fit {
    flex: 1 1 auto;
    min-height: 0;
  }
  .schema-slot :global(.schema) {
    display: flex;
    flex-direction: column;
    height: 100%;
    border: 0;
  }
  .schema-slot :global(.pitch) {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
  }
  .schema-slot :global(.sheet) {
    flex: 1;
    min-height: 0;
  }
  .schema-slot :global(.sheet svg) {
    width: 100%;
    height: 100%;
  }
</style>
