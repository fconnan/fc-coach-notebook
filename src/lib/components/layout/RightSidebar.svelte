<script lang="ts">
  import { activeTool, currentPage, selectedElements, updateElement, removeElements, setFieldTemplate, setShowPlayerDetails, updatePageSettings, type ComponentElement } from '$lib/stores/workspace';
  
  // Library Data
  const categories = $derived([
    { 
      title: 'Équipe 1', 
      type: 'player' as const, 
      team: 'team1' as const, 
      items: [
        { label: $currentPage.nextTeam1Number.toString(), isGK: false, color: $currentPage.team1Color, icon: '' }, 
        { label: 'G', isGK: true, color: $currentPage.team1Color, icon: '' }
      ] 
    },
    { 
      title: 'Équipe 2', 
      type: 'player' as const, 
      team: 'team2' as const, 
      items: [
        { label: $currentPage.nextTeam2Number.toString(), isGK: false, color: $currentPage.team2Color, icon: '' }, 
        { label: 'G', isGK: true, color: $currentPage.team2Color, icon: '' }
      ] 
    },
    { title: 'Éléments', type: 'ball' as const, team: 'none' as const, items: [{ icon: '⚽', label: '', isGK: false, color: $currentPage.ballColor }] },
    { title: 'Tracés', type: 'arrow' as const, team: 'none' as const, items: [{ icon: '↗️', label: '', isGK: false, color: '' }] }
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
    if (type === 'arrow') {
      activeTool.update(current => current === 'arrow' ? null : 'arrow');
    } else if (type === 'field') {
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

  function addPoint() {
    const el = $selectedElements[0];
    if (el.type !== 'arrow') return;
    const points = el.pathPoints || [el.position, el.endPosition || {x: el.position.x + 100, y: el.position.y}];
    
    // Add a point between the second to last and last point
    const last = points[points.length - 1];
    const secondLast = points[points.length - 2];
    
    const newPoint = {
      x: (last.x + secondLast.x) / 2 + 20, 
      y: (last.y + secondLast.y) / 2 + 20
    };
    
    const newPoints = [...points];
    newPoints.splice(points.length - 1, 0, newPoint);
    updateElement(el.id, { pathPoints: newPoints });
  }

  function removePoint() {
    const el = $selectedElements[0];
    if (el.type !== 'arrow') return;
    const points = el.pathPoints || [];
    if (points.length > 2) {
      const newPoints = [...points];
      newPoints.splice(newPoints.length - 2, 1); 
      updateElement(el.id, { pathPoints: newPoints });
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
              class:active-tool={$activeTool === category.type && category.type === 'arrow'}
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
                  
                  <!-- Arched Arms in library (Schematic wing + Action arms) -->
                  <path 
                    d="M -14 52 Q 28 4 70 52" 
                    fill="none" 
                    stroke="#000" 
                    stroke-width={item.isGK ? 2 : 1.5} 
                    stroke-linecap="round" 
                    transform="scale(0.8) translate(7, 0)"
                  />
                  <path 
                    d="M 14.5 31 Q 2 36 6 44" 
                    fill="none" 
                    stroke="#000" 
                    stroke-width={item.isGK ? 2 : 1.5} 
                    stroke-linecap="round"
                    transform="scale(0.8) translate(7, 0)"
                  />
                  <path 
                    d="M 41.5 31 Q 54 36 50 44" 
                    fill="none" 
                    stroke="#000" 
                    stroke-width={item.isGK ? 2 : 1.5} 
                    stroke-linecap="round"
                    transform="scale(0.8) translate(7, 0)"
                  />

                  <circle cx="28" cy="28" r="24" fill={item.isGK ? '#d4ff00' : item.color} stroke={item.isGK ? item.color : 'white'} stroke-width="4" />
                  <text x="28" y="28" dy=".35em" text-anchor="middle" fill={item.isGK ? item.color : 'white'} font-size="20" font-weight="bold">
                    {item.label}
                  </text>
                </svg>
              {:else if category.type === 'ball' || category.type === 'arrow'}
                <div class="emoji-item">{item.icon}</div>
              {/if}
            </div>
          {/each}
        {/each}
      </div>
    </div>
  </div>
  
  <!-- Bottom Section: Contextual Properties -->
  <div class="properties">
    <div class="header">
      {$selectedElements.length > 0 ? "Propriétés de l'objet" : "Propriétés de la page"}
    </div>
    <div class="properties-content">
      {#if $selectedElements.length > 0}
        <div class="selection-count">
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

        <!-- ARROW SPECIFIC PROPERTIES -->
        {#if $selectedElements.length === 1 && $selectedElements[0].type === 'arrow'}
          <div class="prop-group">
            <label>Type de courbe</label>
            <div class="btn-group">
               <button class:active={$selectedElements[0].curveType === 'L'} onclick={() => updateElement($selectedElements[0].id, { curveType: 'L' })}>Poly</button>
               <button class:active={$selectedElements[0].curveType === 'Q'} onclick={() => updateElement($selectedElements[0].id, { curveType: 'Q' })}>Quad</button>
               <button class:active={$selectedElements[0].curveType === 'C'} onclick={() => updateElement($selectedElements[0].id, { curveType: 'C' })}>Cubic</button>
            </div>
          </div>
          
          <div class="prop-group">
            <label>Flèches</label>
            <div class="btn-group">
               <button class:active={$selectedElements[0].arrowStart} onclick={() => updateElement($selectedElements[0].id, { arrowStart: !$selectedElements[0].arrowStart })}>Début</button>
               <button class:active={$selectedElements[0].arrowEnd} onclick={() => updateElement($selectedElements[0].id, { arrowEnd: !$selectedElements[0].arrowEnd })}>Fin</button>
            </div>
          </div>

          <div class="prop-group">
             <label>Points intermédiaires</label>
             <div class="btn-group">
                <button onclick={addPoint}>+</button>
                <button onclick={removePoint} disabled={($selectedElements[0].pathPoints?.length || 0) <= 2}>-</button>
             </div>
          </div>

          <div class="prop-group">
            <label for="strokeWidthInput">Épaisseur ({$selectedElements[0].strokeWidth || 3})</label>
            <input 
              id="strokeWidthInput" 
              type="range" 
              min="1" 
              max="12" 
              value={$selectedElements[0].strokeWidth || 3} 
              oninput={(e) => updateElement($selectedElements[0].id, { strokeWidth: parseInt(e.currentTarget.value) })} 
            />
          </div>

          <div class="prop-group">
            <label for="dashSelect">Style de trait</label>
            <select id="dashSelect" onchange={(e) => updateElement($selectedElements[0].id, { strokeDasharray: e.currentTarget.value })}>
              <option value="" selected={$selectedElements[0].strokeDasharray === ''}>Plein</option>
              <option value="5,5" selected={$selectedElements[0].strokeDasharray === '5,5'}>Pointillés</option>
              <option value="2,4" selected={$selectedElements[0].strokeDasharray === '2,4'}>Finement pointillés</option>
            </select>
          </div>

          <div class="prop-group">
            <label>Liaisons</label>
            <div class="links-container">
              <div class="link-indicator">
                <span class="pos">Début:</span>
                {#if $selectedElements[0].linkedStartId}
                  {@const target = $currentPage.elements.find(el => el.id === $selectedElements[0].linkedStartId)}
                  <span class="tag">{target?.label || (target?.type === 'player' ? 'Joueur' : target?.type) || 'Objet'}</span>
                  <button class="unlink-btn" onclick={() => updateElement($selectedElements[0].id, { linkedStartId: undefined })} title="Détacher">✕</button>
                {:else}
                  <span class="none">Aucune (Glisser sur un joueur)</span>
                {/if}
              </div>
              <div class="link-indicator">
                <span class="pos">Fin:</span>
                {#if $selectedElements[0].linkedEndId}
                  {@const target = $currentPage.elements.find(el => el.id === $selectedElements[0].linkedEndId)}
                  <span class="tag">{target?.label || (target?.type === 'player' ? 'Joueur' : target?.type) || 'Objet'}</span>
                  <button class="unlink-btn" onclick={() => updateElement($selectedElements[0].id, { linkedEndId: undefined })} title="Détacher">✕</button>
                {:else}
                  <span class="none">Aucune (Glisser sur un joueur)</span>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        {#if $selectedElements.length === 1 && $selectedElements[0].type === 'player'}
          <div class="prop-group">
            <label for="labelInput">Numéro / Label</label>
            <input id="labelInput" type="text" value={$selectedElements[0].label || ''} oninput={updateLabel} />
          </div>
          
          {#if $currentPage.showPlayerDetails}
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
        {/if}

        {#if $selectedElements.length === 1 && $selectedElements[0].type === 'player'}
          <div class="prop-group">
            <span class="label-text">Posture (Appuis & Stance)</span>
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

        <button class="delete-btn" onclick={deleteSelection}>
          Supprimer la sélection
        </button>
      {:else}
        <!-- Page Settings (when nothing is selected) -->
        <div class="prop-group">
          <label>Vue du terrain</label>
          <div class="field-selector">
            <button 
              class:active={$currentPage.fieldTemplate === 'Complet'} 
              onclick={() => setFieldTemplate('Complet')}
              title="Terrain complet"
            >
              <svg width="40" height="60" viewBox="0 0 68 105">
                <rect width="68" height="105" fill="#2b6b39" rx="2" />
                <rect x="2" y="2" width="64" height="101" fill="none" stroke="white" stroke-width="2" />
                <line x1="2" y1="52.5" x2="66" y2="52.5" stroke="white" stroke-width="2" />
                <circle cx="34" cy="52.5" r="10" fill="none" stroke="white" stroke-width="2" />
              </svg>
              <span>Complet</span>
            </button>
            
            <button 
              class:active={$currentPage.fieldTemplate === 'Demi'} 
              onclick={() => setFieldTemplate('Demi')}
              title="Demi-terrain (Haut)"
            >
              <svg width="40" height="60" viewBox="0 0 68 105">
                <!-- Bottom Part (Inactive) -->
                <g opacity="0.4">
                  <path d="M 0,52.5 H 68 V 103 A 2,2 0 0 1 66,105 H 2 A 2,2 0 0 1 0,103 Z" fill="#2b6b39" />
                  <path d="M 2,52.5 V 103 H 66 V 52.5" fill="none" stroke="white" stroke-width="2" />
                  <path d="M 24,52.5 A 10,10 0 0 0 44,52.5" fill="none" stroke="white" stroke-width="2" />
                </g>
                <!-- Top Part (Active) -->
                <g>
                  <path d="M 0,2 A 2,2 0 0 1 2,0 H 66 A 2,2 0 0 1 68,2 V 52.5 H 0 Z" fill="#2b6b39" />
                  <path d="M 2,52.5 V 2 H 66 V 52.5" fill="none" stroke="white" stroke-width="2" />
                  <line x1="2" y1="52.5" x2="66" y2="52.5" stroke="white" stroke-width="2" />
                  <path d="M 24,52.5 A 10,10 0 0 1 44,52.5" fill="none" stroke="white" stroke-width="2" />
                </g>
              </svg>
              <span>Attaque</span>
            </button>
            
            <button 
              class:active={$currentPage.fieldTemplate === 'DemiBas'} 
              onclick={() => setFieldTemplate('DemiBas')}
              title="Demi-terrain (Bas)"
            >
              <svg width="40" height="60" viewBox="0 0 68 105">
                <!-- Top Part (Inactive) -->
                <g opacity="0.4">
                  <path d="M 0,2 A 2,2 0 0 1 2,0 H 66 A 2,2 0 0 1 68,2 V 52.5 H 0 Z" fill="#2b6b39" />
                  <path d="M 2,52.5 V 2 H 66 V 52.5" fill="none" stroke="white" stroke-width="2" />
                  <path d="M 24,52.5 A 10,10 0 0 1 44,52.5" fill="none" stroke="white" stroke-width="2" />
                </g>
                <!-- Bottom Part (Active) -->
                <g>
                  <path d="M 0,52.5 H 68 V 103 A 2,2 0 0 1 66,105 H 2 A 2,2 0 0 1 0,103 Z" fill="#2b6b39" />
                  <path d="M 2,52.5 V 103 H 66 V 52.5" fill="none" stroke="white" stroke-width="2" />
                  <line x1="2" y1="52.5" x2="66" y2="52.5" stroke="white" stroke-width="2" />
                  <path d="M 24,52.5 A 10,10 0 0 0 44,52.5" fill="none" stroke="white" stroke-width="2" />
                </g>
              </svg>
              <span>Défense</span>
            </button>
          </div>
        </div>

        <div class="prop-group">
          <label class="toggle-wrap" for="globalDetailsCheck">
            <input 
              id="globalDetailsCheck"
              type="checkbox" 
              checked={$currentPage.showPlayerDetails} 
              onchange={(e) => setShowPlayerDetails(e.currentTarget.checked)} 
            />
            <span class="label-text">Afficher l'orientation des joueurs</span>
          </label>
        </div>

        <div class="prop-section">
          <div class="section-title">Styles des équipes</div>
          <div class="prop-group row">
            <div class="field">
              <label>Équipe 1</label>
              <div class="color-size-row">
                <input type="color" value={$currentPage.team1Color} oninput={(e) => updatePageSettings({ team1Color: e.currentTarget.value })} />
                <input type="number" value={$currentPage.team1Size} oninput={(e) => updatePageSettings({ team1Size: parseInt(e.currentTarget.value) })} />
              </div>
            </div>
            <div class="field">
              <label>Équipe 2</label>
              <div class="color-size-row">
                <input type="color" value={$currentPage.team2Color} oninput={(e) => updatePageSettings({ team2Color: e.currentTarget.value })} />
                <input type="number" value={$currentPage.team2Size} oninput={(e) => updatePageSettings({ team2Size: parseInt(e.currentTarget.value) })} />
              </div>
            </div>
          </div>
        </div>

        <div class="prop-section">
          <div class="section-title">Ballon & Terrain</div>
          <div class="prop-group row">
            <div class="field">
              <label>Taille Ballon</label>
              <input type="number" value={$currentPage.ballSize} oninput={(e) => updatePageSettings({ ballSize: parseInt(e.currentTarget.value) })} />
            </div>
            <div class="field">
              <label class="toggle-wrap" for="stripesCheck">
                <input 
                  id="stripesCheck"
                  type="checkbox" 
                  checked={$currentPage.showFieldStripes} 
                  onchange={(e) => updatePageSettings({ showFieldStripes: e.currentTarget.checked })} 
                />
                <span class="label-text">Bandes</span>
              </label>
            </div>
          </div>
        </div>
        
        <p class="help-text">Sélectionnez un joueur pour modifier sa posture ou ses coordonnées.</p>
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
    max-height: 40%; 
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
  
  .item.active-tool {
    border-color: var(--accent-primary);
    background-color: rgba(94, 106, 210, 0.15);
    box-shadow: inset 0 0 0 1px var(--accent-primary), 0 3px 8px rgba(0,0,0,0.1);
  }
  
  .item:active {
    cursor: grabbing;
    transform: scale(0.95);
  }

  .emoji-item {
    font-size: 36px;
  }

  .label-text {
    font-size: 13px;
    font-weight: 500;
  }

  .help-text {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 20px;
    line-height: 1.4;
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
  
  .selection-count {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 16px;
    padding: 12px;
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
  
  .stance-controls {
    display: grid;
    grid-template-columns: 60px 1fr;
    gap: 8px;
    align-items: center;
  }

  .field-selector {
    display: flex;
    gap: 8px;
  }

  .field-selector button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: var(--bg-canvas);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .field-selector button span {
    font-size: 10px;
    color: var(--text-muted);
  }

  .field-selector button svg {
    border-radius: 2px;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .field-selector button.active {
    border-color: var(--accent-primary);
    background-color: rgba(94, 106, 210, 0.1);
  }

  .field-selector button.active span {
    color: var(--accent-primary);
    font-weight: 600;
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

  .delete-btn {
    width: 100%;
    background-color: rgba(210, 94, 94, 0.1);
    color: #e57373;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid rgba(210, 94, 94, 0.2);
    font-size: 13px;
    transition: all 0.2s;
    margin-top: 24px;
  }

  .toggle-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-main);
    width: 100%;
  }

  .toggle-wrap input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-primary);
  }

  .prop-section {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 12px;
    letter-spacing: 0.5px;
  }

  .color-size-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-size-row input[type="number"] {
    width: 45px;
  }

  /* Link Indicators */
  .links-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(0, 0, 0, 0.1);
    padding: 8px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .link-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .link-indicator .pos {
    color: var(--text-muted);
    width: 40px;
  }

  .link-indicator .tag {
    background: var(--accent-primary);
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: 600;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .link-indicator .none {
    color: var(--text-muted);
    font-style: italic;
    opacity: 0.7;
  }

  .unlink-btn {
    background: transparent;
    border: none;
    color: #ff6b6b;
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  }

  .unlink-btn:hover {
    transform: scale(1.2);
  }
</style>
