<script lang="ts">
  import TopMenu from './TopMenu.svelte';
  import Toolbar from './Toolbar.svelte';
  import LeftSidebar from './LeftSidebar.svelte';
  import RightSidebar from './RightSidebar.svelte';
  import BottomTabs from './BottomTabs.svelte';
  import CanvasArea from '../canvas/CanvasArea.svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import ExportDialog from './ExportDialog.svelte';
  import SaveDialog from './SaveDialog.svelte';
  import ConnectionsDialog from './ConnectionsDialog.svelte';
  import Resizer from './Resizer.svelte';
  import {
    currentPage, setMarkdownContent, refreshCounter,
    deleteSelected, undo, redo, copySelection, cutSelection, pasteClipboard,
    duplicateSelection, showExportDialog, showSaveDialog, showConnections, showNotes
  } from '$lib/stores/workspace';
  import {
    leftWidth, notesWidth, rightWidth, showLeft, showRight,
    clamp, LEFT_MIN, LEFT_MAX, NOTES_MIN, NOTES_MAX, RIGHT_MIN, RIGHT_MAX
  } from '$lib/stores/layout';
  import { quickSave } from '$lib/storage';

  function handleMarkdownChange(newVal: string) {
    setMarkdownContent(newVal);
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      quickSave();
      return;
    }
    if (isInput) return;

    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelection(); return; }
    if (mod && e.key.toLowerCase() === 'x') { e.preventDefault(); cutSelection(); return; }
    if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteClipboard(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="workspace">
  <div class="top-row">
    <TopMenu />
    <Toolbar />
  </div>

  <div class="main-row">
    {#if $showLeft}
      <LeftSidebar width={$leftWidth} />
      <Resizer onDelta={(dx) => leftWidth.set(clamp($leftWidth + dx, LEFT_MIN, LEFT_MAX))} />
    {/if}

    <div class="canvas-region">
      {#key $refreshCounter}
        <CanvasArea />
      {/key}
    </div>

    {#if $showNotes}
      <Resizer onDelta={(dx) => notesWidth.set(clamp($notesWidth - dx, NOTES_MIN, NOTES_MAX))} />
      <div class="notes-pane" style:width="{$notesWidth}px">
        <div class="notes-head">Notes de séance</div>
        <div class="notes-body">
          <MarkdownEditor value={$currentPage?.markdownContent || ''} onchange={handleMarkdownChange} />
        </div>
      </div>
    {/if}

    {#if $showRight}
      <Resizer onDelta={(dx) => rightWidth.set(clamp($rightWidth - dx, RIGHT_MIN, RIGHT_MAX))} />
      <RightSidebar width={$rightWidth} />
    {/if}
  </div>

  <BottomTabs />
</div>

{#if $showExportDialog}
  <ExportDialog />
{/if}
{#if $showSaveDialog}
  <SaveDialog />
{/if}
{#if $showConnections}
  <ConnectionsDialog />
{/if}

<style>
  .workspace {
    display: grid;
    grid-template-rows: auto 1fr 32px;
    height: 100vh;
    width: 100vw;
    background-color: var(--bg-app);
  }

  .top-row {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--border-color);
    z-index: 100;
  }

  .main-row {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  .canvas-region {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    display: flex;
    background-color: var(--bg-canvas);
  }

  .notes-pane {
    flex: 0 0 auto;
    border-left: 1px solid var(--border-color);
    background-color: var(--bg-panel);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .notes-head {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
  }
  .notes-body { flex: 1; overflow: hidden; padding: 12px; }

  @media print {
    .top-row, :global(.bottom-tabs), .notes-pane :global(*) {
      display: none !important;
    }
  }
</style>
