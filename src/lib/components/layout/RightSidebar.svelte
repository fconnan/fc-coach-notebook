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

  function updatePosition(axis: 'x' | 'y', e: Event) {
    const input = e.target as HTMLInputElement;
    const value = parseInt(input.value);
    if ($selectedElements.length === 1 && !isNaN(value)) {
      const el = $selectedElements[0];
      updateElement(el.id, {
        position: {
          ...el.position,
          [axis]: value
        }
      });
    }
  }

  function updateLabel(e: Event) {
    const input = e.target as HTMLInputElement;
    if ($selectedElements.length === 1) {
      updateElement($selectedElements[0].id, { label: input.value });
    }
  }

  function updateRotation(e: Event) {
    const input = e.target as HTMLInputElement;
    const angle = parseInt(input.value);
    if ($selectedElements.length > 0) {
      $selectedElements.forEach(el => {
        updateElement(el.id, { angle });
      });
    }
  }

  function updateLegStance(side: 'left' | 'right', length: number) {
    if ($selectedElements.length > 0) {
      $selectedElements.forEach(el => {
        if (side === 'left') {
          // If advancing left, right must be in support (10)
          const updates: Partial<ComponentElement> = { leftLegLength: length };
          if (length > 10) updates.rightLegLength = 10;
          updateElement(el.id, updates);
        } else {
          // If advancing right, left must be in support (10)
          const updates: Partial<ComponentElement> = { rightLegLength: length };
          if (length > 10) updates.leftLegLength = 10;
          updateElement(el.id, updates);
        }
      });
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
                  <!-- Feet in library (Leg + Shoe) -->
                  <!-- Left -->
                  <rect x="17" y="34" width="8" height="6" rx="0" fill={item.color || '#5e6ad2'} stroke="#000" stroke-width="0.5" opacity="0.6" />
                  <rect x="17" y="40" width="8" height="6" rx="3" fill="#111" opacity="0.6" />
                  <!-- Right -->
                  <rect x="31" y="34" width="8" height="6" rx="0" fill={item.color || '#5e6ad2'} stroke="#000" stroke-width="0.5" opacity="0.6" />
                  <rect x="31" y="40" width="8" height="6" rx="3" fill="#111" opacity="0.6" />
                  
                  <!-- Arms in library (Lateral/Horizontal) -->
                  <rect x="6" y="24" width="10" height="8" rx="4" fill={item.color || '#5e6ad2'} stroke="#000" stroke-width="1" opacity="0.6" />
                  <rect x="40" y="24" width="10" height="8" rx="4" fill={item.color || '#5e6ad2'} stroke="#000" stroke-width="1" opacity="0.6" />

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
        
        {#if $selectedElements.length === 1}
          <div class="prop-group row">
            <div class="field">
              <label for="posXInput">Position X</label>
              <input id="posXInput" type="number" value={Math.round($selectedElements[0].position.x)} oninput={(e) => updatePosition('x', e)} />
            </div>
            <div class="field">
              <label for="posYInput">Position Y</label>
              <input id="posYInput" type="number" value={Math.round($selectedElements[0].position.y)} oninput={(e) => updatePosition('y', e)} />
            </div>
          </div>
        {/if}

        {#if $selectedElements.length === 1 && $selectedElements[0].type === 'player'}
          <div class="prop-group">
            <label for="labelInput">Numéro / Label</label>
            <input id="labelInput" type="text" value={$selectedElements[0].label || ''} oninput={updateLabel} />
          </div>
          <div class="prop-group">
            <label for="rotationInput">Rotation (Boussole)</label>
            <div class="rotation-control">
              <input 
                id="rotationInput" 
                type="range" 
                min="0" 
                max="360" 
                value={$selectedElements[0].angle || 0} 
                oninput={updateRotation} 
              />
              <input 
                class="angle-num" 
                type="number" 
                min="0" 
                max="360" 
                value={$selectedElements[0].angle || 0} 
                oninput={updateRotation} 
              />
              <span class="unit">°</span>
            </div>
          </div>
        {/if}

        {#if $selectedElements.length === 1 && $selectedElements[0].type === 'player'}
          <div class="prop-group">
            <label>Posture (Appuis & Stance)</label>
            <div class="stance-controls">
              <div class="side-label">Gauche</div>
              <div class="btn-group">
                <button class:active={$selectedElements[0].leftLegLength === 10 || !$selectedElements[0].leftLegLength} onclick={() => updateLegStance('left', 10)}>Appui</button>
                <button class:active={$selectedElements[0].leftLegLength === 16} onclick={() => updateLegStance('left', 16)}>Avancé</button>
                <button class:active={$selectedElements[0].leftLegLength === 24} onclick={() => updateLegStance('left', 24)}>Allongé</button>
              </div>
              
              <div class="side-label">Droite</div>
              <div class="btn-group">
                <button class:active={$selectedElements[0].rightLegLength === 10 || !$selectedElements[0].rightLegLength} onclick={() => updateLegStance('right', 10)}>Appui</button>
                <button class:active={$selectedElements[0].rightLegLength === 16} onclick={() => updateLegStance('right', 16)}>Avancé</button>
                <button class:active={$selectedElements[0].rightLegLength === 24} onclick={() => updateLegStance('right', 24)}>Allongé</button>
              </div>
            </div>
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
  
  .prop-group.row {
    display: flex;
    gap: 12px;
  }
  
  .prop-row {
    display: flex;
    gap: 10px;
  }
  
  .prop-row .field {
    flex: 1;
  }

  .stance-controls {
    display: grid;
    grid-template-columns: 60px 1fr;
    gap: 8px;
    align-items: center;
  }

  .side-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .btn-group {
    display: flex;
    background: var(--bg-canvas);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }

  .btn-group button {
    flex: 1;
    background: transparent;
    border: none;
    padding: 4px 2px;
    font-size: 10px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
    border-right: 1px solid var(--border-color);
  }
  
  .btn-group button:last-child {
    border-right: none;
  }

  .btn-group button.active {
    background: var(--accent-primary);
    color: white;
  }

  .btn-group button:hover:not(.active) {
    background: rgba(255, 255, 255, 0.05);
  }

  .prop-group.row .field {
    flex: 1;
  }

  .prop-group input[type="number"] {
    width: 100%;
    background: var(--bg-canvas);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-family: monospace;
  }
  
  .rotation-control {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .rotation-control input[type="range"] {
    flex: 2;
    accent-color: var(--accent-primary);
  }

  .rotation-control .angle-num {
    flex: 1;
    text-align: center;
    background: var(--bg-canvas);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 4px;
    border-radius: 4px;
    font-size: 12px;
  }

  .rotation-control .unit {
    font-size: 12px;
    color: var(--text-muted);
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
