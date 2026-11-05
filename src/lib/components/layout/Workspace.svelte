<script lang="ts">
  import { screen, catalogReady } from '$lib/workspace/state';
  import LoadingIcon from './LoadingIcon.svelte';
  import AppShell from './AppShell.svelte';
  import WorkspaceGate from './WorkspaceGate.svelte';
  import WorkspaceBrowser from './WorkspaceBrowser.svelte';
  import WorkspacePath from './WorkspacePath.svelte';
  import ExportDialog from './ExportDialog.svelte';
  import SaveDialog from './SaveDialog.svelte';
  import ConnectionsDialog from './ConnectionsDialog.svelte';
  import UnsavedLeave from './UnsavedLeave.svelte';
  import {
    deleteSelected, undo, redo, copySelection, cutSelection, pasteClipboard,
    duplicateSelection, showExportDialog, showSaveDialog, showConnections
  } from '$lib/stores/workspace';
  import { quickSave } from '$lib/storage';

  function inField(target: HTMLElement): boolean {
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return true;
    if (target.getAttribute('role') === 'textbox') return true;
    return Boolean(target.closest('.monaco-editor, .native-edit-context'));
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInput = inField(target);
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
    if (mod && e.key.toLowerCase() === 'v') {
      if ($screen === 'exercise') { e.preventDefault(); pasteClipboard(); }
      return;
    }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
  }
</script>

<svelte:window onkeydowncapture={handleGlobalKeydown} />

{#if !$catalogReady}
  <AppShell>
    {#snippet bar()}
      <WorkspacePath />
    {/snippet}
    <div class="flex min-h-0 flex-1 items-center justify-center text-body" role="status">
      <LoadingIcon />
    </div>
  </AppShell>
{:else if $screen === 'gate'}
  <AppShell>
    <WorkspaceGate />
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
<UnsavedLeave />

