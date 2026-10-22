<script lang="ts">
  import { navDoor, screen, restoring } from '$lib/workspace/state';
  import AppShell from './AppShell.svelte';
  import WorkspaceGate from './WorkspaceGate.svelte';
  import WorkspaceBrowser from './WorkspaceBrowser.svelte';
  import WorkspacePath from './WorkspacePath.svelte';
  import ExportDialog from './ExportDialog.svelte';
  import SaveDialog from './SaveDialog.svelte';
  import ConnectionsDialog from './ConnectionsDialog.svelte';
  import {
    deleteSelected, undo, redo, copySelection, cutSelection, pasteClipboard,
    duplicateSelection, showExportDialog, showSaveDialog, showConnections
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

<svelte:window onkeydowncapture={handleGlobalKeydown} />

{#if $restoring}
  <AppShell></AppShell>
{:else if $screen === 'gate'}
  <AppShell>
    <WorkspaceGate />
  </AppShell>
{:else if !$navDoor}
  <AppShell>
    <WorkspaceBrowser />
  </AppShell>
{:else}
  <AppShell fill={$screen === 'exercise'}>
    {#snippet bar()}
      <WorkspacePath />
    {/snippet}
    <WorkspaceBrowser />
  </AppShell>
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

