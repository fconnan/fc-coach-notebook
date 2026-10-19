<script lang="ts">
  import { currentPage, selectedElements, updateElement, removeElements, setFieldTemplate } from '$lib/stores/workspace';
  
  // Library Data
  const categories = $derived([
    { 
      title: 'Équipe 1', 
      type: 'player' as const, 
      team: 'team1' as const, 
      items: [
        { label: $currentPage.nextTeam1Number.toString(), isGK: false, color: '#5e6ad2', icon: '' }, 
        { label: 'G', isGK: true, color: '#5e6ad2', icon: '' }
      ] 
    },
    { 
      title: 'Équipe 2', 
      type: 'player' as const, 
      team: 'team2' as const, 
      items: [
        { label: $currentPage.nextTeam2Number.toString(), isGK: false, color: '#d25e5e', icon: '' }, 
        { label: 'G', isGK: true, color: '#d25e5e', icon: '' }
      ] 
    },
    { title: 'Éléments', type: 'ball' as const, team: 'none' as const, items: [{ icon: '⚽', label: '', isGK: false, color: '' }, { icon: '🚩', label: '', isGK: false, color: '' }] },
    { title: 'Tracés', type: 'arrow' as const, team: 'none' as const, items: [{ icon: '↗️', label: '', isGK: false, color: '' }, { icon: '➡️', label: '', isGK: false, color: '' }] },
    { 
      title: 'Terrains', 
      type: 'field' as const, 
      team: 'none' as const, 
      items: [
        { icon: '', label: 'Complet', isGK: false, color: '' }, 
        { icon: '', label: 'Demi', isGK: false, color: '' }, 
        { icon: '', label: 'DemiBas', isGK: false, color: '' }
      ] 
    }
  ]);

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
      const template = label as 'Complet' | 'Demi' | 'DemiBas';
      setFieldTemplate(template);
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
      <div class="all-items">
        {#each categories as category}
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
              {#if category.type === 'player'}
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill={item.isGK ? '#d4ff00' : item.color} stroke={item.isGK ? item.color : 'white'} stroke-width="4" />
                  <text x="28" y="28" dy=".35em" text-anchor="middle" fill={item.isGK ? item.color : 'white'} font-size="20" font-weight="bold">
                    {item.label}
                  </text>
                </svg>
              {:else if category.type === 'field'}
                <svg 
                  width="46" 
                  height={item.label === 'Complet' ? "64" : "33"} 
                  viewBox={
                    item.label === 'Complet' ? "0 0 68 105" : 
                    item.label === 'Demi' ? "0 0 68 53.5" : 
                    "0 51.5 68 53.5"
                  }
                >
                  <rect width="68" height="105" fill="#2b6b39" rx="2" />
                  <rect x="2" y="2" width="64" height="101" fill="none" stroke="white" stroke-width="2" />
                  <line x1="2" y1="52.5" x2="66" y2="52.5" stroke="white" stroke-width="2" />
                  {#if item.label === 'Complet'}
                    <circle cx="34" cy="52.5" r="10" fill="none" stroke="white" stroke-width="2" />
                  {:else if item.label === 'Demi'}
                    <path d="M 24,52.5 A 10,10 0 0 1 44,52.5" fill="none" stroke="white" stroke-width="2" />
                  {:else if item.label === 'DemiBas'}
                    <path d="M 24,52.5 A 10,10 0 0 0 44,52.5" fill="none" stroke="white" stroke-width="2" />
                  {/if}
                </svg>
              {:else}
                <span class="icon">{item.icon}</span>
              {/if}
            </div>
          {/each}
        {/each}
      </div>
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
    border-bottom: 1px solid var(--border-color);
    background-color: rgba(255, 255, 255, 0.02);
    display: flex;
    flex-direction: column;
    max-height: 40%; /* Save space for properties */
  }

  .library-content {
    padding: 12px;
    overflow-y: auto;
  }
  
  .all-items {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .item {
    width: 72px;
    height: 72px;
    background-color: var(--bg-app);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    transition: all 0.15s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  .item:hover {
    border-color: var(--accent-primary);
    background-color: var(--hover-bg);
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(0,0,0,0.2);
  }

  .item:active {
    cursor: grabbing;
    transform: scale(0.95);
  }

  .icon {
    font-size: 36px;
  }

  /* Properties Styles */
  .properties {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
