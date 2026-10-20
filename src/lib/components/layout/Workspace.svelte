<script lang="ts">
  import TopMenu from './TopMenu.svelte';
  import SchemaEditor from './SchemaEditor.svelte';
  import { screen, restoring, categoryInfo, seanceFile, seanceHeader, showHome, showCategory, showSeanceScreen } from '$lib/workspace/state';
  import AppShell from './AppShell.svelte';
  import WorkspaceGate from './WorkspaceGate.svelte';
  import WorkspaceBrowser from './WorkspaceBrowser.svelte';
  import ExportDialog from './ExportDialog.svelte';
  import SaveDialog from './SaveDialog.svelte';
  import ConnectionsDialog from './ConnectionsDialog.svelte';
  import {
    deleteSelected, undo, redo, copySelection, cutSelection, pasteClipboard,
    duplicateSelection, showExportDialog, showSaveDialog, showConnections, currentPage
  } from '$lib/stores/workspace';
  import { quickSave } from '$lib/storage';

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

{#if $restoring}
  <AppShell></AppShell>
{:else if $screen === 'gate'}
  <AppShell>
    <WorkspaceGate />
  </AppShell>
{:else if $screen !== 'exercise'}
  <AppShell>
    <WorkspaceBrowser />
  </AppShell>
{:else}
<div class="workspace schema-mode">
  <div class="top-row">
    <TopMenu />
    <nav class="crumb">
      <button type="button" onclick={showHome}>Espace de travail</button>
      {#if $categoryInfo}
        <span>/</span>
        <button type="button" onclick={() => $categoryInfo && showCategory($categoryInfo.id)}>{$categoryInfo.name}</button>
      {/if}
      <span>/</span>
      <button type="button" onclick={showSeanceScreen}>{$seanceHeader.name || 'Séance'}</button>
      <span>/</span>
      <span>Schéma</span>
    </nav>
  </div>

  {#if $categoryInfo && $seanceFile && $currentPage}
    {#key `${$categoryInfo.id}/${$seanceFile}/${$currentPage.id}`}
      <SchemaEditor at={`categories/${$categoryInfo.id}/seances/${$seanceFile}/${$currentPage.id}`} />
    {/key}
  {/if}
</div>
{/if}

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
  .workspace.schema-mode { grid-template-rows: auto 1fr; }
  .workspace {
    display: grid;
    grid-template-rows: auto 1fr 40px;
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

  .crumb {
    display: flex; gap: 6px; align-items: center;
    padding: 6px 12px; font-size: 12px; color: var(--text-muted);
    border-top: 1px solid var(--border-color);
  }
  .crumb button {
    background: transparent; border: none; color: var(--accent-primary); cursor: pointer; font-size: 12px; padding: 0;
  }

  @media print {
    .top-row { display: none !important; }
  }
</style>
