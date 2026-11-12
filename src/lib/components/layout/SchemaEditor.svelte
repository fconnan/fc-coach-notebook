<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { parse } from 'yaml';
  import { childFolders, folderEntries, insertElement, insertShape, libraryIcon, pitchOfSource } from '$lib/schema/assist';
  import { addVia, itemAt, itemOffset, moveKnot, movePoint, paintShape, relocate, removeItems, removeVia, retagShape, setAngle, setSize, setTravel, writeShape, type KnotRole } from '$lib/schema/edit';
  import { DRAW_SHAPES } from '$lib/editor/drawShapes';
  import type { LibraryEntry } from '$lib/schema/types';
  import DrawTools from './DrawTools.svelte';
  import DrawingStage from './DrawingStage.svelte';
  import LoadingIcon from './LoadingIcon.svelte';
  import RawWait from './RawWait.svelte';
  import SchemaPreview from './SchemaPreview.svelte';
  import SplitPane from './SplitPane.svelte';

  let {
    source,
    library,
    loaded = false,
    at = '',
    exerciseId = '',
    element = false,
    elementId = '',
    onchange
  }: {
    source: string;
    library: LibraryEntry[];
    loaded?: boolean;
    at?: string;
    exerciseId?: string;
    element?: boolean;
    elementId?: string;
    onchange: (text: string) => void;
  } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let editorReady = $state(false);
  let fault = $state('');
  let picked = $state('');
  let picker = $state<string | null>(null);
  let pickerDir = $state('');
  let pickerHost = $state<HTMLDivElement | null>(null);
  let look = $state<{ x: number; y: number } | null>(null);
  let fitHome = $state(true);
  let fitZoom = $state<(() => void) | undefined>(undefined);
  let animation = $state<Snippet | undefined>();

  type YamlEditor = {
    setValue(value: string): void;
    getValue(): string;
    dispose(): void;
    focus(): void;
    getModel(): {
      dispose(): void;
      getOffsetAt(position: { lineNumber: number; column: number }): number;
      getPositionAt(offset: number): { lineNumber: number; column: number };
      getFullModelRange(): { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
    } | null;
    getPosition(): { lineNumber: number; column: number } | null;
    onDidChangeCursorPosition(listener: () => void): { dispose(): void };
    setPosition(position: { lineNumber: number; column: number }): void;
    revealPositionInCenter(position: { lineNumber: number; column: number }): void;
    pushUndoStop(): void;
    trigger(source: string, handlerId: string, payload: null): void;
    executeEdits(source: string, edits: { range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; text: string }[]): void;
  };
  let yamlEditor: YamlEditor | null = null;
  let emit: (text: string) => void = (text) => onchange(text);

  $effect(() => {
    emit = onchange;
  });

  const roots = $derived.by(() => {
    const names = new Set<string>();
    for (const entry of library) {
      const parts = entry.dir.split('/');
      if (parts[0] === 'elements' && parts[1]) names.add(parts[1]);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
  });
  const currentPitch = $derived(pitchOfSource(source));
  const pickerFolders = $derived(pickerDir ? childFolders(library, pickerDir) : []);
  const pickerItems = $derived(pickerDir ? folderEntries(library, pickerDir) : []);
  const pickerRoot = $derived(picker ? `elements/${picker}` : '');

  function takeAnimation(bar: Snippet | undefined) {
    animation = bar;
  }

  /** Une action du dessin = un pas d’annulation Monaco. Sans arrêt, Ctrl+Z revient au début. */
  function commitYaml(next: string) {
    const editor = yamlEditor;
    const model = editor?.getModel();
    if (!editor || !model) {
      emit(next);
      return;
    }
    if (next === editor.getValue()) return;
    editor.pushUndoStop();
    editor.executeEdits('schema', [{ range: model.getFullModelRange(), text: next }]);
    editor.pushUndoStop();
  }

  function writeYaml(next: string) {
    commitYaml(next);
  }

  function revealItem(ref: string, focus: boolean) {
    const editor = yamlEditor;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const offset = itemOffset(editor.getValue(), ref);
    if (offset == null) return;
    const position = model.getPositionAt(offset);
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    if (focus) editor.focus();
  }

  function pickItem(ref: string, focus = false) {
    picked = ref;
    if (ref) revealItem(ref, focus);
  }

  function followYaml() {
    const editor = yamlEditor;
    const model = editor?.getModel();
    const position = editor?.getPosition();
    if (!editor || !model || !position) return;
    const ref = itemAt(editor.getValue(), model.getOffsetAt(position));
    if (ref !== picked) picked = ref;
  }

  function turnItem(ref: string, angle: number) {
    const editor = yamlEditor;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const current = editor.getValue();
    const next = setAngle(current, ref, angle);
    if (next !== current) commitYaml(next);
    revealItem(ref, true);
  }

  function moveItemAt(ref: string, x: number, y: number) {
    writeMove(movePoint(yamlEditor?.getValue() || '', ref, x, y), ref);
  }

  function moveMany(
    moves: { ref: string; x: number; y: number }[],
    slides: { ref: string; dx: number; dy: number }[],
    shapes: { ref: string; attrs: Record<string, string> }[] = []
  ) {
    const editor = yamlEditor;
    if (!editor) return;
    let next = relocate(editor.getValue(), moves, slides);
    for (const shape of shapes) next = writeShape(next, shape.ref, shape.attrs);
    const ref = moves[0]?.ref || slides[0]?.ref || shapes[0]?.ref || '';
    writeMove(next, ref);
  }

  function writeMove(next: string, ref: string) {
    const editor = yamlEditor;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const current = editor.getValue();
    if (next !== current) commitYaml(next);
    if (ref) revealItem(ref, true);
  }

  function writeItem(ref: string, next: string, focus = true) {
    const editor = yamlEditor;
    const model = editor?.getModel();
    if (!editor || !model) return;
    if (next !== editor.getValue()) commitYaml(next);
    revealItem(ref, focus);
  }

  function knotItem(ref: string, role: KnotRole, index: number, x: number, y: number) {
    const editor = yamlEditor;
    if (!editor) return;
    writeItem(ref, moveKnot(editor.getValue(), ref, role, index, x, y));
  }

  function viaItem(ref: string, action: 'add' | 'remove', index: number, x = 0, y = 0) {
    const editor = yamlEditor;
    if (!editor) return;
    const current = editor.getValue();
    writeItem(ref, action === 'add' ? addVia(current, ref, index, x, y) : removeVia(current, ref, index));
  }

  function tuneItem(ref: string, key: 'wave' | 'amp', value: number) {
    const editor = yamlEditor;
    if (!editor) return;
    writeItem(ref, setTravel(editor.getValue(), ref, key, value), false);
  }

  function resizeItem(ref: string, w: number | null, h: number | null, x?: number | null, y?: number | null) {
    const editor = yamlEditor;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const current = editor.getValue();
    const next = setSize(current, ref, w, h, x, y);
    if (next !== current) commitYaml(next);
    revealItem(ref, true);
  }

  function assist(change: () => string) {
    try {
      writeYaml(change());
      fault = '';
    } catch (err) {
      fault = err instanceof Error ? err.message : 'YAML illisible';
    }
  }

  function openPicker(folder: string) {
    picker = folder;
    pickerDir = `elements/${folder}`;
  }

  function choose(entry: LibraryEntry) {
    picker = null;
    if (entry.type === 'pitch' && entry.id === currentPitch) return;
    assist(() => insertElement(source, entry, library, look));
  }

  function drawShape(kind: string) {
    try {
      const next = insertShape(source, kind, library, look);
      const doc = parse(next) as { object?: unknown[] };
      const index = Math.max(0, (doc.object?.length || 1) - 1);
      const ref = `object/${index}/${kind}`;
      fault = '';
      writeYaml(next);
      picked = ref;
      revealItem(ref, false);
    } catch (err) {
      fault = err instanceof Error ? err.message : 'YAML illisible';
    }
  }

  function paintDrawn(ref: string, name: 'fill' | 'stroke', value: string) {
    const current = yamlEditor?.getValue() || source;
    writeItem(ref, paintShape(current, ref, name, value), false);
  }

  function forgetDrawn(ref: string | string[]) {
    const refs = (Array.isArray(ref) ? ref : [ref]).filter(Boolean);
    if (!refs.length) return;
    const current = yamlEditor?.getValue() || source;
    writeYaml(removeItems(current, refs));
    if (refs.includes(picked)) picked = '';
  }

  function reshape(ref: string, attrs: Record<string, string>, tag?: string) {
    const current = yamlEditor?.getValue() || source;
    const tagged = retagShape(current, ref, tag || ref.split('/').pop() || '', attrs);
    if (tagged.ref !== ref && picked === ref) picked = tagged.ref;
    writeItem(tagged.ref, tagged.source, false);
  }

  function onPickerKey(event: KeyboardEvent) {
    if (event.key === 'Escape') picker = null;
    const target = event.target;
    if (!(target instanceof Element) || !yamlEditor) return;
    if (target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor')) return;
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    const undo = key === 'z' && !event.shiftKey;
    const redo = key === 'y' || (key === 'z' && event.shiftKey);
    if (!undo && !redo) return;
    event.preventDefault();
    yamlEditor.trigger('keyboard', undo ? 'undo' : 'redo', null);
  }

  $effect(() => {
    const node = pickerHost;
    if (!picker || !node) return;
    if (!node.matches(':popover-open')) node.showPopover();
  });

  $effect(() => {
    if (!loaded) return;
    const node = host;
    if (!node) return;
    const initial = untrack(() => source);
    const entries = untrack(() => library);
    let cancel = false;
    let cursor: { dispose(): void } | null = null;
    let editor: YamlEditor | null = null;
    void (async () => {
      try {
        const monaco = await import('$lib/schema/monaco');
        if (cancel) return;
        editor = monaco.mountYaml(node, initial, entries, (text) => emit(text));
        yamlEditor = editor;
        cursor = editor.onDidChangeCursorPosition(followYaml);
        followYaml();
      } catch (err) {
        fault = err instanceof Error ? err.message : 'Éditeur indisponible';
      }
      if (!cancel) editorReady = true;
    })();
    return () => {
      cancel = true;
      cursor?.dispose();
      editor?.getModel()?.dispose();
      editor?.dispose();
      if (yamlEditor === editor) yamlEditor = null;
      editorReady = false;
    };
  });
</script>

<svelte:window onkeydown={onPickerKey} />

<div class="flex h-full min-h-0 flex-col">
{#if fault}<p class="fault">{fault}</p>{/if}
<SplitPane view={element ? 'element-yaml' : 'exercise-schema'} class="min-h-0 flex-1">
  {#snippet left()}
  <div class="panel editor">
    <RawWait ready={editorReady} error={fault}>
      <div class="monaco" bind:this={host}></div>
    </RawWait>
  </div>
  {/snippet}
  {#snippet right()}
  <DrawingStage class="schema-stage">
    {#snippet top()}
      {#if loaded}
        {#each roots as folder (folder)}
          <button type="button" class="tool" onclick={() => openPicker(folder)}>{folder}</button>
        {/each}
      {:else}
        <LoadingIcon />
      {/if}
    {/snippet}
    {#snippet tools()}
      <DrawTools shapes={DRAW_SHAPES} oninsert={drawShape} {fitHome} onzoom={fitZoom} />
    {/snippet}
    {#snippet bottom()}
      {#if animation}{@render animation()}{/if}
    {/snippet}
    {#if loaded}
      <SchemaPreview {at} {exerciseId} {element} {elementId} {source} editable selected={picked} bind:fitHome bind:fitZoom onpick={pickItem} onmove={moveItemAt} onmoves={moveMany} onknot={knotItem} onvia={viaItem} ontune={tuneItem} onrotate={turnItem} onresize={resizeItem} onlook={(point) => look = point} onfooter={takeAnimation} onshape={reshape} onpaint={paintDrawn} onforget={forgetDrawn} />
    {:else}
      <div class="flex h-full items-center justify-center text-body"><LoadingIcon /></div>
    {/if}
  </DrawingStage>
  {/snippet}
</SplitPane>
</div>
{#if picker}
  <div bind:this={pickerHost} popover="manual" class="veil" role="presentation" onclick={() => picker = null}>
    <div class="picker" role="dialog" aria-label={picker || 'Éléments'} tabindex="-1" onclick={(event) => event.stopPropagation()}>
      {#if pickerDir && pickerDir !== pickerRoot}
        <button type="button" class="back" onclick={() => pickerDir = pickerDir.split('/').slice(0, -1).join('/')}>Retour</button>
      {/if}
      {#if pickerFolders.length || pickerItems.length}
        <div class="icons">
          {#each pickerFolders as folder (folder)}
            <button type="button" class="icon" onclick={() => pickerDir = `${pickerDir}/${folder}`}>
              <span class="glyph folder">{folder.slice(0, 1).toUpperCase()}</span>
              <span class="caption">{folder}</span>
            </button>
          {/each}
          {#each pickerItems as entry (entry.file)}
            <button type="button" class="icon" class:current={entry.type === 'pitch' && entry.id === currentPitch} onclick={() => choose(entry)}>
              <span class="glyph">{@html libraryIcon(entry)}</span>
              <span class="caption">{entry.name || entry.type}</span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="empty">Aucun élément.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .editor { overflow: hidden; }
  .editor {
    display: flex;
    min-height: 0;
    padding: 0.75rem;
  }
  .monaco {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--color-gray-200);
  }
  .panel {
    min-height: 0;
    border: 1px solid var(--color-default-medium);
    border-radius: var(--radius-base);
    background: var(--color-neutral-primary);
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
  :global(.schema-stage .schema) {
    display: flex;
    flex-direction: column;
    height: 100%;
    border: 0;
    background: transparent;
  }
  :global(.schema-stage .pitch) {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
  }
  :global(.schema-stage .lens) {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
  }
  :global(.schema-stage .sheet) {
    flex: none;
    min-height: 0;
  }
  :global(.schema-stage .sheet svg) {
    width: 100%;
    height: 100%;
  }
  .fault {
    margin: 0.35rem 0 0;
    font-size: 0.875rem;
    color: var(--color-red-700, #b91c1c);
  }
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
  .back {
    display: block;
    width: 100%;
    margin-bottom: 0.25rem;
    border: 0;
    border-bottom: 1px solid var(--color-default-medium);
    background: transparent;
    padding: 0.25rem 0.4rem;
    font-size: 0.75rem;
    text-align: left;
    color: var(--color-heading);
  }
  .folder { font-size: 1.4rem; color: #fff; }
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
</style>
