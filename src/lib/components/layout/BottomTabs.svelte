<script lang="ts">
  let pages = $state([
    { id: '1', name: 'Schéma 1' }
  ]);
  let activeId = $state('1');
</script>

<div class="bottom-tabs">
  <div class="tabs">
    {#each pages as page}
      <button 
        class="tab" 
        class:active={page.id === activeId}
        onclick={() => activeId = page.id}
      >
        {page.name}
      </button>
    {/each}
  </div>
  
  <button class="add-btn" title="Nouvelle page">
    ➕
  </button>
</div>

<style>
  .bottom-tabs {
    display: flex;
    background-color: var(--bg-panel);
    border-top: 1px solid var(--border-color);
  }
  
  .tabs {
    display: flex;
    overflow-x: auto;
  }
  
  .tab {
    padding: 0 16px;
    height: 31px;
    font-size: 12px;
    border-right: 1px solid var(--border-color);
    background-color: rgba(0,0,0,0.1);
    color: var(--text-muted);
  }
  
  .tab.active {
    background-color: var(--bg-canvas);
    color: var(--text-main);
    border-top: 2px solid var(--accent-primary);
    margin-top: -1px;
  }
  
  .tab:hover:not(.active) {
    background-color: var(--hover-bg);
  }
  
  .add-btn {
    padding: 0 12px;
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .add-btn:hover {
    color: var(--text-main);
    background-color: var(--hover-bg);
  }
</style>
