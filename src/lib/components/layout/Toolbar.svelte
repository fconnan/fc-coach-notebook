<script lang="ts">
  import {
    zoom, pan, undo, redo, canUndo, canRedo,
    deleteSelected, selectedIds,
    bringToFront, sendToBack, toggleLockSelection,
    duplicateSelection, showExportDialog, currentPage, updatePageSettings,
    showNotes, theme
  } from '$lib/stores/workspace';
  import { showLeft, showRight } from '$lib/stores/layout';

  function toggleNotes() {
    showNotes.update(v => !v);
  }
  function toggleTheme() {
    theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }
  function toggleLeft() {
    showLeft.update(v => !v);
  }
  function toggleRight() {
    showRight.update(v => !v);
  }

  const hasSelection = $derived($selectedIds.length > 0);
  const isPerspective = $derived($currentPage?.view === 'perspective');

  function toggleView() {
    updatePageSettings({ view: isPerspective ? '2d' : 'perspective' });
  }

  function zoomIn() {
    zoom.update(z => Math.min(6, z * 1.15));
  }
  function zoomOut() {
    zoom.update(z => Math.max(0.3, z / 1.15));
  }
  function resetView() {
    zoom.set(1);
    pan.set({ x: 0, y: 0 });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
</script>

<div class="toolbar">
  <div class="toolbar-left">
    <button class="tool-btn" class:active={$showLeft} title="Afficher/masquer les éléments" onclick={toggleLeft}>▤</button>
    <div class="divider"></div>
    <button class="tool-btn" title="Zoom avant" onclick={zoomIn}>➕</button>
    <button class="tool-btn" title="Zoom arrière" onclick={zoomOut}>➖</button>
    <button class="tool-btn" title="Réinitialiser la vue (100%)" onclick={resetView}>
      <span class="zoom-label">{Math.round($zoom * 100)}%</span>
    </button>
    <div class="divider"></div>
    <button class="tool-btn" title="Annuler (Ctrl+Z)" onclick={undo} disabled={!$canUndo}>↩️</button>
    <button class="tool-btn" title="Rétablir (Ctrl+Y)" onclick={redo} disabled={!$canRedo}>↪️</button>
    <div class="divider"></div>
    <button class="tool-btn" title="Dupliquer (Ctrl+D)" onclick={duplicateSelection} disabled={!hasSelection}>⧉</button>
    <button class="tool-btn" title="Verrouiller / Déverrouiller" onclick={toggleLockSelection} disabled={!hasSelection}>🔒</button>
    <button class="tool-btn" title="Mettre au premier plan" onclick={() => bringToFront($selectedIds)} disabled={!hasSelection}>🔼</button>
    <button class="tool-btn" title="Mettre en arrière-plan" onclick={() => sendToBack($selectedIds)} disabled={!hasSelection}>🔽</button>
    <div class="divider"></div>
    <button class="tool-btn danger" title="Supprimer (Suppr)" onclick={deleteSelected} disabled={!hasSelection}>🗑️</button>
  </div>

  <div class="toolbar-right">
    <button class="tool-btn notes-btn" class:active={$showNotes} title="Notes de séance" onclick={toggleNotes}>
      <span>📝</span><span class="btn-text">Notes</span>
    </button>
    <div class="divider"></div>
    <button class="tool-btn" class:active={isPerspective} title="Vue perspective (présentation)" onclick={toggleView}>🎥</button>
    <button class="tool-btn" title="Exporter (PDF / Image)" onclick={() => showExportDialog.set(true)}>📤</button>
    <button class="tool-btn" title={$theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'} onclick={toggleTheme}>{$theme === 'dark' ? '☀️' : '🌙'}</button>
    <button class="tool-btn" title="Plein Écran" onclick={toggleFullscreen}>⛶</button>
    <button class="tool-btn" class:active={$showRight} title="Propriétés" onclick={toggleRight}>⚙️</button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: var(--bg-panel);
    padding: 4px 12px;
    height: 40px;
  }

  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .divider {
    width: 1px;
    height: 20px;
    background-color: var(--border-color);
    margin: 0 4px;
  }

  .tool-btn {
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .tool-btn:hover:not(:disabled) {
    background-color: var(--hover-bg);
  }

  .tool-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .tool-btn.active {
    background-color: var(--active-bg);
    color: var(--accent-primary);
  }

  .tool-btn.danger:hover:not(:disabled) {
    background-color: rgba(210, 94, 94, 0.2);
  }

  .zoom-label {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    min-width: 34px;
  }

  .notes-btn { gap: 6px; padding: 0 10px; }
  .btn-text { font-size: 12px; font-weight: 500; }
</style>
