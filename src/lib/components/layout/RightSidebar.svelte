<script lang="ts">
  import { selectedElements, updateElement, removeElements } from '$lib/stores/workspace';
  
  // Create a derived state using a small function to update
  function updateColor(e: Event) {
    const input = e.target as HTMLInputElement;
    if ($selectedElements.length > 0) {
      $selectedElements.forEach(el => {
        updateElement(el.id, { color: input.value });
      });
    }
  }

  function updateLabel(e: Event) {
    const input = e.target as HTMLInputElement;
    if ($selectedElements.length === 1) {
      updateElement($selectedElements[0].id, { label: input.value });
    }
  }

  function deleteSelection() {
    if ($selectedElements.length > 0) {
      removeElements($selectedElements.map(el => el.id));
    }
  }

</script>

<div class="right-sidebar">
  <div class="header">Propriétés</div>
  
  <div class="properties-content">
    {#if $selectedElements.length === 0}
      <div class="empty-state">
        Aucun élément sélectionné
      </div>
    {:else}
      <div class="selected-info">
        {$selectedElements.length} élément(s) sélectionné(s)
      </div>
      
      {#if $selectedElements.length === 1 && $selectedElements[0].type === 'player'}
        <div class="prop-group">
          <label for="labelInput">Numéro / Label</label>
          <input id="labelInput" type="text" value={$selectedElements[0].label || ''} oninput={updateLabel} />
        </div>
      {/if}
      
      <div class="prop-group">
        <label for="colorInput">Couleur</label>
        <div class="color-picker-wrap">
          <input 
            id="colorInput"
            type="color" 
            value={$selectedElements[0].color || '#ffffff'} 
            oninput={updateColor} 
          />
        </div>
      </div>
      
      <div class="actions">
        <button class="delete-btn" onclick={deleteSelection}>🗑️ Supprimer</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .right-sidebar {
    width: 260px;
    background-color: var(--bg-panel);
    border-left: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
  }
  
  .header {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
  }
  
  .properties-content {
    padding: 16px;
    flex: 1;
    overflow-y: auto;
  }
  
  .empty-state {
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
    margin-top: 20px;
  }

  .selected-info {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .prop-group {
    margin-bottom: 16px;
  }

  .prop-group label {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .prop-group input[type="text"] {
    width: 100%;
    background: var(--bg-canvas);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 13px;
  }
  
  .prop-group input[type="text"]:focus {
    outline: 1px solid var(--accent-primary);
  }

  .color-picker-wrap {
    display: flex;
    align-items: center;
  }

  input[type="color"] {
    -webkit-appearance: none;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    cursor: pointer;
    background: none;
    padding: 0;
  }
  
  input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  input[type="color"]::-webkit-color-swatch {
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }

  .actions {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .delete-btn {
    width: 100%;
    background-color: rgba(210, 94, 94, 0.1);
    color: #e57373;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid rgba(210, 94, 94, 0.2);
    font-size: 13px;
    transition: all 0.2s;
  }

  .delete-btn:hover {
    background-color: rgba(210, 94, 94, 0.2);
  }
</style>
