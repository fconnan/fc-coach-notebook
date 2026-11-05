<script lang="ts">
  import { untrack } from 'svelte';
  import { childFolders, folderEntries, insertElement, libraryIcon, pitchOfSource } from '$lib/schema/assist';
  import { itemAt, itemOffset, movePoint, setAngle, setSize } from '$lib/schema/edit';
  import type { LibraryEntry } from '$lib/schema/types';
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

  function writeYaml(next: string) {
    if (yamlEditor) yamlEditor.setValue(next);
    else emit(next);
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
    if (next === current) {
      revealItem(ref, true);
      return;
    }
    editor.executeEdits('schema', [{ range: model.getFullModelRange(), text: next }]);
    revealItem(ref, true);
  }

  function moveItemAt(ref: string, x: number, y: number) {
    const editor = yamlEditor;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const current = editor.getValue();
    const next = movePoint(current, ref, x, y);
    if (next === current) {
      revealItem(ref, true);
      return;
    }
    editor.executeEdits('schema', [{ range: model.getFullModelRange(), text: next }]);
    revealItem(ref, true);
  }

  function resizeItem(ref: string, w: number | null, h: number | null) {
    const editor = yamlEditor;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const current = editor.getValue();
    const next = setSize(current, ref, w, h);
    if (next === current) {
      revealItem(ref, true);
      return;
    }
    editor.executeEdits('schema', [{ range: model.getFullModelRange(), text: next }]);
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
    assist(() => insertElement(source, entry, library));
  }

  function onPickerKey(event: KeyboardEvent) {
    if (event.key === 'Escape') picker = null;
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
  <div class="panel schema-slot">
    <div class="tools">
      {#if loaded}
        {#each roots as folder (folder)}
          <button type="button" class="tool" onclick={() => openPicker(folder)}>{folder}</button>
        {/each}
      {:else}
        <LoadingIcon />
      {/if}
    </div>
    <div class="schema-fit">
      {#if loaded}
        <SchemaPreview {at} {exerciseId} {element} {elementId} {source} editable selected={picked} onpick={pickItem} onmove={moveItemAt} onrotate={turnItem} onresize={resizeItem} />
      {:else}
        <div class="flex h-full items-center justify-center text-body"><LoadingIcon /></div>
      {/if}
    </div>
  </div>
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
  .editor,
  .schema-slot { overflow: hidden; }
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
  .schema-slot :global(.lens) {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
  }
  .schema-slot :global(.sheet) {
    flex: none;
    min-height: 0;
  }
  .schema-slot :global(.sheet svg) {
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
