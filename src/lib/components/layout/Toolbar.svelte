<script lang="ts">
  import { currentPage } from '$lib/stores/workspace';
  let { showProperties = $bindable() } = $props();
  
  function toggleProperties() {
    showProperties = !showProperties;
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
    <button class="tool-btn" title="Zoom Select">🔍</button>
    <div class="divider"></div>
    <button class="tool-btn" title="Zoom +">➕</button>
    <button class="tool-btn" title="Zoom -">➖</button>
    <div class="divider"></div>
    <button class="tool-btn" title="Undo">↩️</button>
    <button class="tool-btn" title="Redo">↪️</button>
    <div class="divider"></div>
    <button class="tool-btn" title="Poubelle">🗑️</button>
    <div class="divider"></div>
    <button class="tool-btn" title="Placer en dessous">🔽</button>
  </div>
  
  <div class="toolbar-right">
    <button class="tool-btn" title="Imprimer" onclick={() => window.print()}>🖨️</button>
    <div class="divider"></div>
    <button class="tool-btn" title="Plein Écran" onclick={toggleFullscreen}>⛶</button>
    <button class="tool-btn" class:active={showProperties} title="Propriétés" onclick={toggleProperties}>⚙️</button>
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
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  
  .tool-btn:hover {
    background-color: var(--hover-bg);
  }
  
  .tool-btn.active {
    background-color: var(--active-bg);
    color: var(--accent-primary);
  }
</style>
