<script lang="ts">
  import { onMount } from 'svelte';
  import { listTactics, loadTacticByName, createNewTactic, getActiveDirName } from '$lib/services/tacticFileService';
  import { fade, scale } from 'svelte/transition';

  let { onclose } = $props<{ onclose: () => void }>();

  let tactics = $state<string[]>([]);
  let searchQuery = $state('');
  let loading = $state(true);

  async function refresh() {
    loading = true;
    tactics = await listTactics();
    loading = false;
  }

  async function handleSelect(name: string) {
    await loadTacticByName(name);
    onclose();
  }

  async function handleAdd() {
    const name = prompt('Nom de la nouvelle tactique (ex: match_A) :');
    if (name) {
      const success = await createNewTactic(name);
      if (success) {
        onclose();
      } else {
        alert('Erreur lors de la création de la tactique.');
      }
    }
  }

  onMount(refresh);

  const filteredTactics = $derived(
    tactics.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );
</script>

<div class="modal-backdrop" onclick={onclose} role="presentation" transition:fade={{ duration: 200 }}>
  <div class="modal-content" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" transition:scale={{ duration: 200, start: 0.95 }}>
    <div class="modal-header">
      <div class="header-main">
        <h2>Explorateur de tactiques</h2>
        <span class="dir-badge">{getActiveDirName()}</span>
      </div>
      <button class="close-btn" onclick={onclose}>&times;</button>
    </div>

    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input 
        type="text" 
        placeholder="Rechercher une tactique..." 
        bind:value={searchQuery}
      />
    </div>

    <div class="tactic-list">
      {#if loading}
        <div class="loading-state">Chargement...</div>
      {:else if filteredTactics.length === 0}
        <div class="empty-state">
          {searchQuery ? 'Aucun résultat trouvé.' : 'Aucune tactique dans ce dossier.'}
        </div>
      {:else}
        {#each filteredTactics as tactic}
          <button class="tactic-item" onclick={() => handleSelect(tactic)}>
            <div class="tactic-icon">📄</div>
            <div class="tactic-info">
              <span class="tactic-name">{tactic}</span>
              <span class="tactic-meta">.md / .json</span>
            </div>
          </button>
        {/each}
      {/if}
    </div>

    <div class="modal-footer">
      <button class="add-btn" onclick={handleAdd}>
        <span class="plus">+</span> Ajouter une nouvelle tactique
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal-content {
    background-color: #1e1e20;
    width: 500px;
    max-width: 90vw;
    max-height: 80vh;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .header-main h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: white;
  }

  .dir-badge {
    background: rgba(59, 130, 246, 0.1);
    color: var(--accent-primary);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    margin-top: 4px;
    display: inline-block;
    font-family: monospace;
  }

  .close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 24px;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .search-bar {
    padding: 16px 20px;
    position: relative;
    background: rgba(0, 0, 0, 0.2);
  }

  .search-icon {
    position: absolute;
    left: 32px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
    opacity: 0.5;
  }

  .search-bar input {
    width: 100%;
    background: #000;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    padding: 10px 16px 10px 40px;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-bar input:focus {
    border-color: var(--accent-primary);
  }

  .tactic-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    min-height: 300px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tactic-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background 0.1s;
  }

  .tactic-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .tactic-icon {
    font-size: 24px;
    opacity: 0.7;
  }

  .tactic-info {
    display: flex;
    flex-direction: column;
  }

  .tactic-name {
    color: #e2e8f0;
    font-size: 14px;
    font-weight: 500;
  }

  .tactic-meta {
    font-size: 11px;
    color: #64748b;
  }

  .empty-state, .loading-state {
    padding: 40px;
    text-align: center;
    color: #64748b;
    font-style: italic;
  }

  .modal-footer {
    padding: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .add-btn {
    width: 100%;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.2s;
  }

  .add-btn:hover {
    background: #2563eb;
  }

  .plus {
    font-size: 18px;
  }
</style>
