<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { Button, ButtonGroup } from 'flowbite-svelte';
  import { pages, type Page } from '$lib/stores/workspace';
  import { confirmLeaveEditors, registerEditorGate } from '$lib/workspace/editorLeave';
  import { applyExerciseDocument } from '$lib/workspace/exerciseFile';
  import { exerciseHtml } from '$lib/workspace/markdownHtml';
  import { registerExerciseSaver } from '$lib/workspace/exerciseDraft';
  import { exercisePaths, persistCursor, screen } from '$lib/workspace/state';
  import type { LibraryEntry } from '$lib/schema/types';
  import RawWait from './RawWait.svelte';
  import SplitPane from './SplitPane.svelte';
  import SchemaEditor from './SchemaEditor.svelte';

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
  let editorReady = $state(false);
  let saving = $state(false);
  let markdownHost: HTMLDivElement | null = $state(null);
  type TextEditor = {
    getValue(): string;
    dispose(): void;
    getModel(): { dispose(): void } | null;
    getPosition(): { lineNumber: number; column: number } | null;
    onDidChangeCursorPosition(listener: () => void): { dispose(): void };
  };
  let markdownEditor: TextEditor | null = null;
  let section = $state('');
  let previewBody = $state<HTMLDivElement | null>(null);
  const PART_KEY = 'fctactics_exercise_part';
  let part = $state<'description' | 'schema'>(browser && sessionStorage.getItem(PART_KEY) === 'schema' ? 'schema' : 'description');

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

  $effect(() => {
    const title = section;
    void ficheHtml;
    showHeading(title);
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

  function headingAt(source: string, line: number): string {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const index = Math.min(Math.max(line, 1), lines.length) - 1;
    for (let i = index; i >= 0; i -= 1) {
      const heading = /^(#{1,3})\s+(.*)$/.exec(lines[i] || '');
      if (heading) return heading[2].trim();
    }
    return '';
  }

  function followMarkdown() {
    const editor = markdownEditor;
    const position = editor?.getPosition();
    if (!editor || !position) return;
    const title = headingAt(editor.getValue(), position.lineNumber);
    if (title !== section) section = title;
  }

  function showHeading(title: string) {
    const root = previewBody;
    if (!root) return;
    for (const node of root.querySelectorAll('.here')) node.classList.remove('here');
    if (!title) return;
    const heading = [...root.querySelectorAll('h1, h2, h3')].find(node => node.textContent?.trim() === title);
    if (!(heading instanceof HTMLElement)) return;
    heading.classList.add('here');
    const box = heading.getBoundingClientRect();
    const view = root.getBoundingClientRect();
    if (box.top < view.top) root.scrollTop -= view.top - box.top;
    else if (box.bottom > view.bottom) root.scrollTop += box.bottom - view.bottom;
  }

  function showPart(next: 'description' | 'schema') {
    part = next;
    try { sessionStorage.setItem(PART_KEY, next); } catch { /* quota */ }
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
    yaml = yamlDisk = body.source || 'version: fccn-schema:1\nname: exercise\npitch: half-attack\n';
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
      const { warning, path } = await response.json() as { warning?: string; path?: string };
      if (path && exerciseId) exercisePaths.update(map => ({ ...map, [exerciseId]: path }));
      status = warning ? `Enregistré (${warning})` : 'Enregistré';
      return true;
    } catch {
      status = 'Échec de l’enregistrement';
      return false;
    } finally {
      saving = false;
    }
  }

  function showSeance() {
    screen.set('seance');
    persistCursor();
  }

  async function closeEditor() {
    if (!(await confirmLeaveEditors())) return;
    showSeance();
  }

  onMount(() => {
    const stop = registerExerciseSaver(save);
    const stopLeave = registerEditorGate({
      dirty: () => dirty,
      save,
      discard: () => {}
    });
    const editors: Array<{ dispose: () => void; getModel: () => { dispose: () => void } | null }> = [];
    const cursorStops: { dispose(): void }[] = [];
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled || !markdownHost) return;
      try {
        const monaco = await import('$lib/schema/monaco');
        if (cancelled || !markdownHost) return;
        const markdownEd = monaco.mountMarkdown(markdownHost, markdown, onMarkdown);
        markdownEditor = markdownEd;
        editors.push(markdownEd);
        cursorStops.push(markdownEd.onDidChangeCursorPosition(followMarkdown));
        followMarkdown();
      } catch (err) {
        error = err instanceof Error ? err.message : 'Éditeur indisponible';
      }
      if (!cancelled) editorReady = true;
    })();
    return () => {
      cancelled = true;
      stop();
      stopLeave();
      for (const cursor of cursorStops) cursor.dispose();
      for (const editor of editors) {
        editor.getModel()?.dispose();
        editor.dispose();
      }
      markdownEditor = null;
    };
  });
</script>

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
      <Button size="sm" color="alternative" disabled={saving} onclick={() => { void closeEditor(); }}>Annuler</Button>
    </div>
  </div>
  {#if error}<p class="text-sm text-red-700">{error}</p>{/if}
  <div class={part === 'description' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
    <SplitPane view="exercise-description" class="min-h-0 flex-1">
      {#snippet left()}
      <div class="panel editor">
        <RawWait ready={editorReady} {error}>
          <div class="monaco" bind:this={markdownHost}></div>
        </RawWait>
      </div>
      {/snippet}
      {#snippet right()}
      <div class="panel preview">
        <div class="preview-body" bind:this={previewBody}>
          <div class="exercise-md">{@html ficheHtml}</div>
        </div>
      </div>
      {/snippet}
    </SplitPane>
  </div>
  <div class={part === 'schema' ? 'min-h-0 flex-1' : 'hidden'}>
    <SchemaEditor source={yaml} {library} {loaded} {at} {exerciseId} onchange={onYaml} />
  </div>
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
  .preview-body :global(.here) {
    background: rgba(253, 224, 71, 0.45);
    border-radius: 0.2rem;
  }
  .panel {
    min-height: 0;
    border: 1px solid var(--color-default-medium);
    border-radius: var(--radius-base);
    background: var(--color-neutral-primary);
  }
  .editor { overflow: hidden; }
</style>
