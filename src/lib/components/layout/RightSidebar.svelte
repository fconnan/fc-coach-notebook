<script lang="ts">
  import { selectedElements, updateElement, removeElements, setFieldTemplate } from '$lib/stores/workspace';
  
  // Library Data
  const categories = [
    { title: 'Équipe 1', type: 'player', team: 'team1', items: [{ icon: '🔵', label: '1' }, { icon: '🧤', label: 'G' }] },
    { title: 'Équipe 2', type: 'player', team: 'team2', items: [{ icon: '🔴', label: '1' }, { icon: '🧤', label: 'G' }] },
    { title: 'Éléments', type: 'ball', team: 'none', items: [{ icon: '⚽', label: '' }, { icon: '🚩', label: '' }] },
    { title: 'Tracés', type: 'arrow', team: 'none', items: [{ icon: '↗️', label: '' }, { icon: '➡️', label: '' }] },
    { title: 'Terrains', type: 'field', team: 'none', items: [{ icon: '🟩', label: 'Complet' }, { icon: '🟢', label: 'Demi' }] }
  ];

  // Drag & Click Handlers for Library
  function onDragStart(e: DragEvent, type: string, team: string, label: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('type', type);
      e.dataTransfer.setData('team', team);
      e.dataTransfer.setData('label', label);
      e.dataTransfer.effectAllowed = 'copy';
    }
  }

  function onItemClick(type: string, label: string) {
    if (type === 'field') {
      setFieldTemplate(label === 'Demi' ? 'Demi' : 'Complet');
    }
  }

  // Property Handlers
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

<div class="sidebar">
  <!-- Top Section: Library -->
  <div class="library">
    <div class="header">Bibliothèque</div>
    <div class="library-content">
      {#each categories as category}
        <div class="category">
          <div class="category-header">{category.title}</div>
          <div class="category-items">
            {#each category.items as item}
              <div 
                class="item" 
                draggable="true" 
                role="button"
                tabindex="0"
                title={item.label || category.title}
                ondragstart={(e) => onDragStart(e, category.type, category.team, item.label)}
                onclick={() => onItemClick(category.type, item.label)}
                onkeydown={(e) => e.key === 'Enter' && onItemClick(category.type, item.label)}
              >
                <span class="icon">{item.icon}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Bottom Section: Properties -->
  <div class="properties">
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
</div>

<style>
  .sidebar {
    width: 280px;
    background-color: var(--bg-panel);
    border-left: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  
  .header {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
    background-color: rgba(0, 0, 0, 0.1);
  }

  /* Library Styles */
  .library {
    flex: 2;
    display: flex;
    flex-direction: column;
    min-height: 300px;
    overflow: hidden;
    border-bottom: 1px solid var(--border-color);
  }

  .library-content {
    flex: 1;
    overflow-y: auto;
  }
  
  .category-header {
    padding: 10px 14px;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--text-muted);
    letter-spacing: 0.5px;
    background-color: rgba(255, 255, 255, 0.03);
  }
  
  .category-items {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 12px;
  }
  
  .item {
    aspect-ratio: 1;
    background-color: var(--bg-canvas);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    transition: all 0.2s;
  }
  
  .item:hover {
    border-color: var(--accent-primary);
    background-color: var(--hover-bg);
  }

  .icon {
    font-size: 24px;
  }

  /* Properties Styles */
  .properties {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 200px;
    background-color: rgba(0, 0, 0, 0.05);
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
  
  .color-picker-wrap {
    display: flex;
    align-items: center;
  }

  input[type="color"] {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    cursor: pointer;
    background: none;
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
</style>
