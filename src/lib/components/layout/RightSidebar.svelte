<script lang="ts">
  import {
    activeTool, currentPage, selectedElements,
    updateElement, removeElements, setFieldTemplate, setShowPlayerDetails,
    updatePageSettings, setTeamFormation, type ComponentElement, type ElementType
  } from '$lib/stores/workspace';
  import EquipmentIcon from '../shapes/EquipmentIcon.svelte';
  import { FORMATION_NAMES, formationPositions } from '$lib/utils/formations';

  let selectedFormation = $state(FORMATION_NAMES[0]);
  function applyFormation(team: 'team1' | 'team2') {
    setTeamFormation(team, formationPositions(selectedFormation, team));
  }

  // --- Accordion state ---
  let open = $state({ players: true, equipment: false, tools: true, field: false });
  function toggle(section: keyof typeof open) { open[section] = !open[section]; }

  // --- Library: players & ball ---
  const playerGroups = $derived([
    {
      title: 'Équipe 1', type: 'player' as const, team: 'team1' as const,
      items: [
        { label: $currentPage.nextTeam1Number.toString(), color: $currentPage.team1Color, isGK: false },
        { label: 'G', color: $currentPage.team1Color, isGK: true }
      ]
    },
    {
      title: 'Équipe 2', type: 'player' as const, team: 'team2' as const,
      items: [
        { label: $currentPage.nextTeam2Number.toString(), color: $currentPage.team2Color, isGK: false },
        { label: 'G', color: $currentPage.team2Color, isGK: true }
      ]
    }
  ]);

  // --- Equipment library ---
  const equipment: { type: ElementType; label: string }[] = [
    { type: 'cone', label: 'Plot' },
    { type: 'coneTall', label: 'Cône' },
    { type: 'pole', label: 'Piquet' },
    { type: 'hurdle', label: 'Haie' },
    { type: 'ladder', label: 'Échelle' },
    { type: 'ring', label: 'Cerceau' },
    { type: 'mannequin', label: 'Mannequin' },
    { type: 'miniGoal', label: 'Mini-but' },
    { type: 'fullGoal', label: 'But' }
  ];

  // --- Drawing tools ---
  const tools: { tool: ElementType | null; label: string; icon: string }[] = [
    { tool: null, label: 'Sélection', icon: '⬚' },
    { tool: 'arrow', label: 'Flèche', icon: '↗' },
    { tool: 'text', label: 'Texte', icon: 'T' },
    { tool: 'callout', label: 'Bulle', icon: '💬' },
    { tool: 'rect', label: 'Rectangle', icon: '▭' },
    { tool: 'ellipse', label: 'Ellipse', icon: '◯' },
    { tool: 'zone', label: 'Zone', icon: '▦' }
  ];

  function onDragStart(e: DragEvent, type: string, team: string, label: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('type', type);
      e.dataTransfer.setData('team', team);
      e.dataTransfer.setData('label', label);
      e.dataTransfer.effectAllowed = 'copy';
    }
  }

  function selectTool(tool: ElementType | null) {
    activeTool.set($activeTool === tool ? null : tool);
  }

  // --- Property helpers ---
  const sel = $derived($selectedElements);
  const one = $derived(sel.length === 1 ? sel[0] : null);

  function updateAll(updates: Partial<ComponentElement>) {
    sel.forEach(el => updateElement(el.id, updates));
  }
  function updateColor(e: Event) {
    updateAll({ color: (e.target as HTMLInputElement).value });
  }
  function updatePosition(axis: 'x' | 'y', e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value);
    if (one && !isNaN(v)) updateElement(one.id, { position: { ...one.position, [axis]: v } });
  }
  function updateLabel(e: Event) {
    if (one) updateElement(one.id, { label: (e.target as HTMLInputElement).value });
  }
  function updateRotation(e: Event) {
    const a = parseInt((e.target as HTMLInputElement).value);
    updateAll({ angle: a });
  }
  function updateLegStance(side: 'left' | 'right', length: number) {
    sel.forEach(el => {
      const u: Partial<ComponentElement> = side === 'left' ? { leftLegLength: length } : { rightLegLength: length };
      if (length > 10) { if (side === 'left') u.rightLegLength = 10; else u.leftLegLength = 10; }
      updateElement(el.id, u);
    });
  }
  function addPoint() {
    if (!one || one.type !== 'arrow') return;
    const points = one.pathPoints || [one.position, { x: one.position.x + 100, y: one.position.y }];
    const last = points[points.length - 1];
    const secondLast = points[points.length - 2];
    const newPoint = { x: (last.x + secondLast.x) / 2 + 20, y: (last.y + secondLast.y) / 2 + 20 };
    const newPoints = [...points];
    newPoints.splice(points.length - 1, 0, newPoint);
    updateElement(one.id, { pathPoints: newPoints });
  }
  function removePoint() {
    if (!one || one.type !== 'arrow') return;
    const points = one.pathPoints || [];
    if (points.length > 2) {
      const newPoints = [...points];
      newPoints.splice(newPoints.length - 2, 1);
      updateElement(one.id, { pathPoints: newPoints });
    }
  }
  function deleteSelection() {
    if (sel.length > 0) removeElements(sel.map(el => el.id));
  }

  const isShape = $derived(one && (one.type === 'rect' || one.type === 'ellipse' || one.type === 'zone'));
  const isEquip = $derived(one && ['cone','coneTall','pole','hurdle','ladder','ring','mannequin','miniGoal','fullGoal'].includes(one.type));
</script>

<div class="sidebar">
  <!-- LIBRARY (accordion) -->
  <div class="library">
    <!-- PLAYERS -->
    <button class="section-head" onclick={() => toggle('players')}>
      <span>JOUEURS</span><span class="chev">{open.players ? '▾' : '▸'}</span>
    </button>
    {#if open.players}
      <div class="section-body">
        {#each playerGroups as group}
          <div class="group-label">{group.title}</div>
          <div class="items-row">
            {#each group.items as item}
              <div class="item" draggable="true" role="button" tabindex="0"
                title={item.isGK ? 'Gardien' : 'Joueur'}
                ondragstart={(e) => onDragStart(e, group.type, group.team, item.label)}>
                <svg width="48" height="48" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill={item.isGK ? '#d4ff00' : item.color} stroke={item.isGK ? item.color : 'white'} stroke-width="4" />
                  <text x="28" y="28" dy=".35em" text-anchor="middle" fill={item.isGK ? item.color : 'white'} font-size="18" font-weight="bold">{item.label}</text>
                </svg>
              </div>
            {/each}
          </div>
        {/each}
        <div class="group-label">Ballon</div>
        <div class="items-row">
          <div class="item" draggable="true" role="button" tabindex="0" title="Ballon"
            ondragstart={(e) => onDragStart(e, 'ball', 'none', '')}>
            <div class="emoji-item">⚽</div>
          </div>
        </div>

        <div class="group-label">Formation</div>
        <select class="formation-select" bind:value={selectedFormation}>
          {#each FORMATION_NAMES as name}
            <option value={name}>{name}</option>
          {/each}
        </select>
        <div class="formation-apply">
          <button onclick={() => applyFormation('team1')}>Appliquer Éq.1</button>
          <button onclick={() => applyFormation('team2')}>Appliquer Éq.2</button>
        </div>
      </div>
    {/if}

    <!-- EQUIPMENT -->
    <button class="section-head" onclick={() => toggle('equipment')}>
      <span>ÉQUIPEMENT</span><span class="chev">{open.equipment ? '▾' : '▸'}</span>
    </button>
    {#if open.equipment}
      <div class="section-body">
        <div class="items-row wrap">
          {#each equipment as eq}
            <div class="item small" draggable="true" role="button" tabindex="0" title={eq.label}
              ondragstart={(e) => onDragStart(e, eq.type, 'none', '')}>
              <EquipmentIcon type={eq.type} />
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- TOOLS -->
    <button class="section-head" onclick={() => toggle('tools')}>
      <span>OUTILS</span><span class="chev">{open.tools ? '▾' : '▸'}</span>
    </button>
    {#if open.tools}
      <div class="section-body">
        <div class="tool-grid">
          {#each tools as t}
            <button class="tool-cell" class:active={$activeTool === t.tool} title={t.label}
              onclick={() => selectTool(t.tool)}>
              <span class="tool-icon">{t.icon}</span>
              <span class="tool-name">{t.label}</span>
            </button>
          {/each}
        </div>
        {#if $activeTool}
          <p class="hint">Cliquez {#if $activeTool === 'arrow'}deux fois{:else if $activeTool === 'rect' || $activeTool === 'ellipse' || $activeTool === 'zone'}-glissez{:else}sur le terrain{/if} pour dessiner.</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- PROPERTIES -->
  <div class="properties">
    <div class="header">{sel.length > 0 ? "Propriétés de l'objet" : 'Propriétés de la page'}</div>
    <div class="properties-content">
      {#if sel.length > 0}
        <div class="selection-count">{sel.length} élément(s) sélectionné(s)</div>

        {#if one}
          <div class="prop-group row">
            <div class="field">
              <label for="posX">Position X</label>
              <input id="posX" type="number" value={Math.round(one.position.x)} oninput={(e) => updatePosition('x', e)} />
            </div>
            <div class="field">
              <label for="posY">Position Y</label>
              <input id="posY" type="number" value={Math.round(one.position.y)} oninput={(e) => updatePosition('y', e)} />
            </div>
          </div>
        {/if}

        <!-- ARROW -->
        {#if one && one.type === 'arrow'}
          <div class="prop-group">
            <label>Type de courbe</label>
            <div class="btn-group">
              <button class:active={one.curveType === 'L'} onclick={() => updateElement(one.id, { curveType: 'L' })}>Droite</button>
              <button class:active={one.curveType === 'Q'} onclick={() => updateElement(one.id, { curveType: 'Q' })}>Courbe</button>
              <button class:active={one.curveType === 'C'} onclick={() => updateElement(one.id, { curveType: 'C' })}>Cubic</button>
            </div>
          </div>
          <div class="prop-group">
            <label>Tête (début)</label>
            <div class="btn-group">
              <button class:active={(one.headStart ?? (one.arrowStart ? 'arrow' : 'none')) === 'none'} onclick={() => updateElement(one.id, { headStart: 'none', arrowStart: false })}>Aucune</button>
              <button class:active={(one.headStart ?? (one.arrowStart ? 'arrow' : 'none')) === 'arrow'} onclick={() => updateElement(one.id, { headStart: 'arrow', arrowStart: true })}>Flèche</button>
              <button class:active={one.headStart === 'bar'} onclick={() => updateElement(one.id, { headStart: 'bar', arrowStart: true })}>Barre</button>
              <button class:active={one.headStart === 'double'} onclick={() => updateElement(one.id, { headStart: 'double', arrowStart: true })}>Double</button>
            </div>
          </div>
          <div class="prop-group">
            <label>Tête (fin)</label>
            <div class="btn-group">
              <button class:active={(one.headEnd ?? (one.arrowEnd ? 'arrow' : 'none')) === 'none'} onclick={() => updateElement(one.id, { headEnd: 'none', arrowEnd: false })}>Aucune</button>
              <button class:active={(one.headEnd ?? (one.arrowEnd ? 'arrow' : 'none')) === 'arrow'} onclick={() => updateElement(one.id, { headEnd: 'arrow', arrowEnd: true })}>Flèche</button>
              <button class:active={one.headEnd === 'bar'} onclick={() => updateElement(one.id, { headEnd: 'bar', arrowEnd: true })}>Barre</button>
              <button class:active={one.headEnd === 'double'} onclick={() => updateElement(one.id, { headEnd: 'double', arrowEnd: true })}>Double</button>
            </div>
          </div>
          <div class="prop-group">
            <label class="toggle-wrap" for="wavy">
              <input id="wavy" type="checkbox" checked={one.wavy || false} onchange={(e) => updateElement(one.id, { wavy: e.currentTarget.checked })} />
              <span class="label-text">Tracé ondulé (conduite/dribble)</span>
            </label>
          </div>
          <div class="prop-group">
            <label>Points intermédiaires</label>
            <div class="btn-group">
              <button onclick={addPoint}>+</button>
              <button onclick={removePoint} disabled={(one.pathPoints?.length || 0) <= 2}>-</button>
            </div>
          </div>
        {/if}

        <!-- TEXT -->
        {#if one && one.type === 'text'}
          <div class="prop-group">
            <label for="txt">Texte</label>
            <textarea id="txt" rows="2" value={one.text || ''} oninput={(e) => updateElement(one.id, { text: e.currentTarget.value })}></textarea>
          </div>
          <div class="prop-group">
            <label for="fs">Taille ({one.fontSize || 24})</label>
            <input id="fs" type="range" min="10" max="60" value={one.fontSize || 24} oninput={(e) => updateElement(one.id, { fontSize: parseInt(e.currentTarget.value) })} />
          </div>
          <div class="prop-group">
            <label>Style</label>
            <div class="btn-group">
              <button class:active={one.fontWeight === 'bold'} onclick={() => updateElement(one.id, { fontWeight: one.fontWeight === 'bold' ? 'normal' : 'bold' })}><b>B</b></button>
              <button class:active={one.fontStyle === 'italic'} onclick={() => updateElement(one.id, { fontStyle: one.fontStyle === 'italic' ? 'normal' : 'italic' })}><i>I</i></button>
              <button class:active={one.textDecoration === 'underline'} onclick={() => updateElement(one.id, { textDecoration: one.textDecoration === 'underline' ? 'none' : 'underline' })}><u>U</u></button>
            </div>
          </div>
        {/if}

        <!-- CALLOUT -->
        {#if one && one.type === 'callout'}
          <div class="prop-group">
            <label for="cotxt">Texte</label>
            <textarea id="cotxt" rows="3" value={one.text || ''} oninput={(e) => updateElement(one.id, { text: e.currentTarget.value })}></textarea>
          </div>
          <div class="prop-group">
            <label for="cofs">Taille ({one.fontSize || 13})</label>
            <input id="cofs" type="range" min="9" max="28" value={one.fontSize || 13} oninput={(e) => updateElement(one.id, { fontSize: parseInt(e.currentTarget.value) })} />
          </div>
          <div class="prop-group row">
            <div class="field">
              <label>Fond</label>
              <input type="color" value={one.fillColor || '#fdf7d0'} oninput={(e) => updateElement(one.id, { fillColor: e.currentTarget.value })} />
            </div>
            <div class="field">
              <label>Texte</label>
              <input type="color" value={one.color || '#1a1a1a'} oninput={(e) => updateElement(one.id, { color: e.currentTarget.value })} />
            </div>
          </div>
          <div class="prop-group">
            <label for="cow">Largeur ({one.width || 180})</label>
            <input id="cow" type="range" min="80" max="320" value={one.width || 180} oninput={(e) => updateElement(one.id, { width: parseInt(e.currentTarget.value) })} />
          </div>
        {/if}

        <!-- SHAPES / ZONE -->
        {#if isShape && one}
          <div class="prop-group row">
            <div class="field">
              <label for="sw">Largeur</label>
              <input id="sw" type="number" value={Math.round(one.width || 120)} oninput={(e) => updateElement(one.id, { width: parseInt(e.currentTarget.value) })} />
            </div>
            <div class="field">
              <label for="sh">Hauteur</label>
              <input id="sh" type="number" value={Math.round(one.height || 80)} oninput={(e) => updateElement(one.id, { height: parseInt(e.currentTarget.value) })} />
            </div>
          </div>
          <div class="prop-group row">
            <div class="field">
              <label>Contour</label>
              <input type="color" value={one.color || '#ffffff'} oninput={(e) => updateElement(one.id, { color: e.currentTarget.value })} />
            </div>
            <div class="field">
              <label>Remplissage</label>
              <input type="color" value={one.fillColor && one.fillColor !== 'none' ? one.fillColor : '#9bd64a'} oninput={(e) => updateElement(one.id, { fillColor: e.currentTarget.value })} />
            </div>
          </div>
          <div class="prop-group">
            <label for="fo">Opacité du remplissage ({Math.round((one.fillOpacity ?? 0.25) * 100)}%)</label>
            <input id="fo" type="range" min="0" max="100" value={Math.round((one.fillOpacity ?? 0.25) * 100)} oninput={(e) => updateElement(one.id, { fillOpacity: parseInt(e.currentTarget.value) / 100 })} />
          </div>
          <div class="prop-group">
            <label for="ssw">Épaisseur contour ({one.strokeWidth || 2})</label>
            <input id="ssw" type="range" min="0" max="10" value={one.strokeWidth || 2} oninput={(e) => updateElement(one.id, { strokeWidth: parseInt(e.currentTarget.value) })} />
          </div>
        {/if}

        <!-- PLAYER -->
        {#if one && one.type === 'player'}
          <div class="prop-group row">
            <div class="field">
              <label for="lbl">Numéro</label>
              <input id="lbl" type="text" value={one.label || ''} oninput={updateLabel} />
            </div>
            <div class="field">
              <label for="pname">Nom</label>
              <input id="pname" type="text" value={one.name || ''} oninput={(e) => updateElement(one.id, { name: e.currentTarget.value })} />
            </div>
          </div>
          <div class="prop-group">
            <label>Maillot</label>
            <div class="btn-group">
              <button class:active={(one.shirtPattern || 'solid') === 'solid'} onclick={() => updateElement(one.id, { shirtPattern: 'solid' })}>Uni</button>
              <button class:active={one.shirtPattern === 'stripes'} onclick={() => updateElement(one.id, { shirtPattern: 'stripes' })}>Rayé</button>
              <button class:active={one.shirtPattern === 'hoops'} onclick={() => updateElement(one.id, { shirtPattern: 'hoops' })}>Cerclé</button>
            </div>
          </div>
          <div class="prop-group row">
            <div class="field">
              <label>Maillot</label>
              <input type="color" value={one.shirtColor || one.color || '#5e6ad2'} oninput={(e) => updateElement(one.id, { shirtColor: e.currentTarget.value })} />
            </div>
            <div class="field">
              <label>Short</label>
              <input type="color" value={one.shortColor || '#1c1c1c'} oninput={(e) => updateElement(one.id, { shortColor: e.currentTarget.value })} />
            </div>
            <div class="field">
              <label>Peau</label>
              <input type="color" value={one.skinColor || '#e8b58c'} oninput={(e) => updateElement(one.id, { skinColor: e.currentTarget.value })} />
            </div>
          </div>
          <div class="prop-group">
            <label class="toggle-wrap" for="isgk">
              <input id="isgk" type="checkbox" checked={one.role === 'goalkeeper' || one.label === 'G'} onchange={(e) => updateElement(one.id, { role: e.currentTarget.checked ? 'goalkeeper' : 'outfield', label: e.currentTarget.checked ? 'G' : one.label })} />
              <span class="label-text">Gardien de but</span>
            </label>
          </div>
          {#if $currentPage.showPlayerDetails}
            <div class="prop-group">
              <label for="rot">Orientation</label>
              <div class="rotation-control">
                <input id="rot" type="range" min="0" max="360" value={one.angle || 0} oninput={updateRotation} />
                <input class="angle-num" type="number" min="0" max="360" value={one.angle || 0} oninput={updateRotation} />
                <span class="unit">°</span>
              </div>
            </div>
            <div class="prop-group">
              <span class="label-text">Posture</span>
              <div class="stance-controls">
                <div class="side-label">Gauche</div>
                <div class="btn-group">
                  <button class:active={one.leftLegLength === 10 || !one.leftLegLength} onclick={() => updateLegStance('left', 10)}>Appui</button>
                  <button class:active={one.leftLegLength === 16} onclick={() => updateLegStance('left', 16)}>Avancé</button>
                  <button class:active={one.leftLegLength === 24} onclick={() => updateLegStance('left', 24)}>Allongé</button>
                </div>
                <div class="side-label">Droite</div>
                <div class="btn-group">
                  <button class:active={one.rightLegLength === 10 || !one.rightLegLength} onclick={() => updateLegStance('right', 10)}>Appui</button>
                  <button class:active={one.rightLegLength === 16} onclick={() => updateLegStance('right', 16)}>Avancé</button>
                  <button class:active={one.rightLegLength === 24} onclick={() => updateLegStance('right', 24)}>Allongé</button>
                </div>
              </div>
            </div>
          {/if}
        {/if}

        <!-- EQUIPMENT -->
        {#if isEquip && one}
          <div class="prop-group">
            <label for="eqrot">Orientation</label>
            <div class="rotation-control">
              <input id="eqrot" type="range" min="0" max="360" value={one.angle || 0} oninput={updateRotation} />
              <input class="angle-num" type="number" min="0" max="360" value={one.angle || 0} oninput={updateRotation} />
              <span class="unit">°</span>
            </div>
          </div>
          <div class="prop-group">
            <label for="eqsize">Taille ({Math.round(((one.radius || 14) / 14) * 100)}%)</label>
            <input id="eqsize" type="range" min="7" max="42" value={one.radius || 14} oninput={(e) => updateElement(one.id, { radius: parseInt(e.currentTarget.value) })} />
          </div>
        {/if}

        <!-- Stroke style for arrows -->
        {#if one && one.type === 'arrow'}
          <div class="prop-group">
            <label for="strokeW">Épaisseur ({one.strokeWidth || 3})</label>
            <input id="strokeW" type="range" min="1" max="12" value={one.strokeWidth || 3} oninput={(e) => updateElement(one.id, { strokeWidth: parseInt(e.currentTarget.value) })} />
          </div>
          <div class="prop-group">
            <label for="dash">Style de trait</label>
            <select id="dash" onchange={(e) => updateElement(one.id, { strokeDasharray: e.currentTarget.value })}>
              <option value="" selected={!one.strokeDasharray}>Plein</option>
              <option value="8,6" selected={one.strokeDasharray === '8,6'}>Pointillés</option>
              <option value="2,5" selected={one.strokeDasharray === '2,5'}>Finement pointillés</option>
            </select>
          </div>
        {/if}

        <!-- Color (generic, not for elements with dedicated colour controls) -->
        {#if !(one && (one.type === 'text' || one.type === 'callout' || one.type === 'player' || isShape))}
          <div class="prop-group">
            <label for="col">Couleur</label>
            <div class="color-picker-wrap">
              <input id="col" type="color" value={one?.color || '#ffffff'} oninput={updateColor} />
            </div>
          </div>
        {/if}
        {#if one && one.type === 'text'}
          <div class="prop-group">
            <label for="tcol">Couleur</label>
            <div class="color-picker-wrap">
              <input id="tcol" type="color" value={one.color || '#ffffff'} oninput={updateColor} />
            </div>
          </div>
        {/if}

        <button class="delete-btn" onclick={deleteSelection}>Supprimer la sélection</button>
      {:else}
        <!-- PAGE SETTINGS -->
        <div class="prop-group">
          <label>Vue du terrain</label>
          <div class="field-selector">
            <button class:active={$currentPage.fieldTemplate === 'Complet'} onclick={() => setFieldTemplate('Complet')} title="Terrain complet">
              <svg width="36" height="54" viewBox="0 0 68 105"><rect width="68" height="105" fill="#2b6b39" rx="2" /><rect x="2" y="2" width="64" height="101" fill="none" stroke="white" stroke-width="2" /><line x1="2" y1="52.5" x2="66" y2="52.5" stroke="white" stroke-width="2" /><circle cx="34" cy="52.5" r="10" fill="none" stroke="white" stroke-width="2" /></svg>
              <span>Complet</span>
            </button>
            <button class:active={$currentPage.fieldTemplate === 'Demi'} onclick={() => setFieldTemplate('Demi')} title="Demi (haut)">
              <svg width="36" height="54" viewBox="0 0 68 105"><g opacity="0.35"><rect y="52.5" width="68" height="52.5" fill="#2b6b39" /></g><g><rect width="68" height="52.5" fill="#2b6b39" /><rect x="2" y="2" width="64" height="50.5" fill="none" stroke="white" stroke-width="2" /></g></svg>
              <span>Attaque</span>
            </button>
            <button class:active={$currentPage.fieldTemplate === 'DemiBas'} onclick={() => setFieldTemplate('DemiBas')} title="Demi (bas)">
              <svg width="36" height="54" viewBox="0 0 68 105"><g opacity="0.35"><rect width="68" height="52.5" fill="#2b6b39" /></g><g><rect y="52.5" width="68" height="52.5" fill="#2b6b39" /><rect x="2" y="52.5" width="64" height="50.5" fill="none" stroke="white" stroke-width="2" /></g></svg>
              <span>Défense</span>
            </button>
          </div>
        </div>

        <div class="prop-group">
          <label>Affichage</label>
          <div class="btn-group">
            <button class:active={$currentPage.view !== 'perspective'} onclick={() => updatePageSettings({ view: '2d' })}>2D (dessus)</button>
            <button class:active={$currentPage.view === 'perspective'} onclick={() => updatePageSettings({ view: 'perspective' })}>Perspective</button>
          </div>
          {#if $currentPage.view === 'perspective'}
            <p class="help-text" style="margin-top:6px">Mode présentation : repassez en 2D pour éditer.</p>
          {/if}
        </div>

        <div class="prop-group">
          <label class="toggle-wrap" for="details">
            <input id="details" type="checkbox" checked={$currentPage.showPlayerDetails} onchange={(e) => setShowPlayerDetails(e.currentTarget.checked)} />
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
          <div class="section-title">Terrain & fond</div>
          <div class="prop-group">
            <label for="grass">Pelouse</label>
            <select id="grass" value={$currentPage.grassType} onchange={(e) => updatePageSettings({ grassType: e.currentTarget.value, showFieldStripes: e.currentTarget.value === 'stripes' })}>
              <option value="stripes">Rayée</option>
              <option value="solid">Unie</option>
            </select>
          </div>
          <div class="prop-group row">
            <div class="field">
              <label>Couleur pelouse</label>
              <input type="color" value={$currentPage.backgroundColor} oninput={(e) => updatePageSettings({ backgroundColor: e.currentTarget.value })} />
            </div>
            <div class="field">
              <label>Taille ballon</label>
              <input type="number" value={$currentPage.ballSize} oninput={(e) => updatePageSettings({ ballSize: parseInt(e.currentTarget.value) })} />
            </div>
          </div>
          <div class="prop-group">
            <label class="toggle-wrap" for="hideGoals">
              <input id="hideGoals" type="checkbox" checked={$currentPage.hideGoals} onchange={(e) => updatePageSettings({ hideGoals: e.currentTarget.checked })} />
              <span class="label-text">Masquer les buts</span>
            </label>
          </div>
          <div class="prop-group">
            <label class="toggle-wrap" for="hideLines">
              <input id="hideLines" type="checkbox" checked={$currentPage.hidePitchLines} onchange={(e) => updatePageSettings({ hidePitchLines: e.currentTarget.checked })} />
              <span class="label-text">Masquer les lignes</span>
            </label>
          </div>
        </div>

        <p class="help-text">Sélectionnez un objet pour modifier ses propriétés.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .sidebar {
    width: 290px;
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

  /* Library accordion */
  .library {
    border-bottom: 1px solid var(--border-color);
    max-height: 46%;
    overflow-y: auto;
  }
  .section-head {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 14px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    color: var(--text-muted);
    background: rgba(0,0,0,0.18);
    border: none;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
  }
  .section-head:hover { color: var(--text-main); }
  .chev { font-size: 10px; }
  .section-body { padding: 10px 12px; }

  .group-label {
    font-size: 10px;
    color: var(--text-muted);
    margin: 6px 0 4px;
    text-transform: uppercase;
  }
  .items-row { display: flex; gap: 8px; }
  .items-row.wrap { flex-wrap: wrap; }

  .item {
    width: 56px; height: 56px;
    background-color: var(--bg-app);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    cursor: grab;
    transition: all 0.15s ease;
  }
  .item.small { width: 50px; height: 50px; }
  .item:hover { border-color: var(--accent-primary); background-color: var(--hover-bg); transform: translateY(-1px); }
  .item:active { cursor: grabbing; transform: scale(0.95); }
  .emoji-item { font-size: 30px; }

  .formation-select {
    width: 100%;
    background: var(--bg-canvas);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 13px;
    margin-bottom: 6px;
  }
  .formation-apply { display: flex; gap: 6px; }
  .formation-apply button {
    flex: 1;
    background: var(--bg-app);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 6px 4px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .formation-apply button:hover { border-color: var(--accent-primary); background: var(--hover-bg); }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .tool-cell {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 7px 3px;
    background: var(--bg-app);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tool-cell:hover { border-color: var(--accent-primary); background: var(--hover-bg); }
  .tool-cell.active { border-color: var(--accent-primary); background: rgba(94,106,210,0.18); color: var(--accent-primary); }
  .tool-icon { font-size: 16px; line-height: 1; }
  .tool-name { font-size: 9px; color: var(--text-muted); }
  .tool-cell.active .tool-name { color: var(--accent-primary); }
  .hint { font-size: 11px; color: var(--accent-primary); margin-top: 8px; font-style: italic; }

  .label-text { font-size: 13px; font-weight: 500; }
  .help-text { font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: 20px; line-height: 1.4; }

  .properties { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .properties-content { padding: 16px; flex: 1; overflow-y: auto; }

  .selection-count { font-size: 11px; color: var(--text-muted); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); }

  .prop-group { margin-bottom: 16px; }
  .prop-group > label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
  .prop-group input[type="text"], .prop-group textarea, .prop-group select {
    width: 100%;
    background: var(--bg-canvas);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
  }
  .prop-group textarea { resize: vertical; }
  .prop-group.row { display: flex; gap: 12px; }
  .prop-group.row .field { flex: 1; }

  .stance-controls { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: center; }
  .side-label { font-size: 11px; color: var(--text-muted); }

  .field-selector { display: flex; gap: 8px; }
  .field-selector button {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
    background: var(--bg-canvas); border: 1px solid var(--border-color);
    border-radius: 6px; padding: 8px 4px; cursor: pointer; transition: all 0.2s;
  }
  .field-selector button span { font-size: 10px; color: var(--text-muted); }
  .field-selector button.active { border-color: var(--accent-primary); background-color: rgba(94, 106, 210, 0.1); }
  .field-selector button.active span { color: var(--accent-primary); font-weight: 600; }

  .btn-group { display: flex; background: var(--bg-canvas); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); }
  .btn-group button { flex: 1; background: transparent; border: none; padding: 5px 2px; font-size: 10px; color: var(--text-muted); cursor: pointer; transition: all 0.2s; border-right: 1px solid var(--border-color); }
  .btn-group button:last-child { border-right: none; }
  .btn-group button.active { background: var(--accent-primary); color: white; }
  .btn-group button:hover:not(.active) { background: rgba(255, 255, 255, 0.05); }

  .prop-group input[type="number"] {
    width: 100%; background: var(--bg-canvas); border: 1px solid var(--border-color);
    color: var(--text-main); padding: 6px 8px; border-radius: 4px; font-size: 13px; font-family: monospace;
  }
  .prop-group input[type="range"] { width: 100%; accent-color: var(--accent-primary); }

  .rotation-control { display: flex; align-items: center; gap: 12px; }
  .rotation-control input[type="range"] { flex: 2; }
  .rotation-control .angle-num { flex: 1; text-align: center; background: var(--bg-canvas); border: 1px solid var(--border-color); color: var(--text-main); padding: 4px; border-radius: 4px; font-size: 12px; }
  .rotation-control .unit { font-size: 12px; color: var(--text-muted); }

  .color-picker-wrap { display: flex; align-items: center; }
  input[type="color"] { appearance: none; -webkit-appearance: none; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer; background: none; padding: 0; }
  input[type="color"]::-webkit-color-swatch { border: 1px solid var(--border-color); border-radius: 4px; }

  .delete-btn { width: 100%; background-color: rgba(210, 94, 94, 0.1); color: #e57373; padding: 8px; border-radius: 4px; border: 1px solid rgba(210, 94, 94, 0.2); font-size: 13px; transition: all 0.2s; margin-top: 16px; }
  .delete-btn:hover { background-color: rgba(210, 94, 94, 0.2); }

  .toggle-wrap { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: var(--text-main); width: 100%; }
  .toggle-wrap input { width: 16px; height: 16px; accent-color: var(--accent-primary); }

  .prop-section { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-color); }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px; letter-spacing: 0.5px; }
  .color-size-row { display: flex; align-items: center; gap: 8px; }
  .color-size-row input[type="number"] { width: 45px; }
</style>
