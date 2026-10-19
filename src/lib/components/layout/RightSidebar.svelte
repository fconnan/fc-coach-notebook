<script lang="ts">
  import {
    currentPage, selectedElements,
    updateElement, removeElements, setFieldTemplate, setShowPlayerDetails,
    updatePageSettings, type ComponentElement
  } from '$lib/stores/workspace';

  let { width = 290 } = $props<{ width?: number }>();

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

<div class="sidebar" style:width="{width}px">
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
        <div class="prop-group">
          <label for="tcol">Couleur</label>
          <div class="color-picker-wrap">
            <input id="tcol" type="color" value={one.color || '#1f2329'} oninput={updateColor} />
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

      <!-- Generic color (only for elements without dedicated colour controls) -->
      {#if !(one && (one.type === 'text' || one.type === 'callout' || one.type === 'player' || one.type === 'arrow' || isShape))}
        <div class="prop-group">
          <label for="col">Couleur</label>
          <div class="color-picker-wrap">
            <input id="col" type="color" value={one?.color || '#ffffff'} oninput={updateColor} />
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
            <svg width="36" height="54" viewBox="0 0 68 105"><rect width="68" height="105" fill={$currentPage.backgroundColor} rx="2" /><rect x="2" y="2" width="64" height="101" fill="none" stroke="white" stroke-width="2" /><line x1="2" y1="52.5" x2="66" y2="52.5" stroke="white" stroke-width="2" /><circle cx="34" cy="52.5" r="10" fill="none" stroke="white" stroke-width="2" /></svg>
            <span>Complet</span>
          </button>
          <button class:active={$currentPage.fieldTemplate === 'Demi'} onclick={() => setFieldTemplate('Demi')} title="Demi (haut)">
            <svg width="36" height="54" viewBox="0 0 68 105"><g opacity="0.35"><rect y="52.5" width="68" height="52.5" fill={$currentPage.backgroundColor} /></g><g><rect width="68" height="52.5" fill={$currentPage.backgroundColor} /><rect x="2" y="2" width="64" height="50.5" fill="none" stroke="white" stroke-width="2" /></g></svg>
            <span>Attaque</span>
          </button>
          <button class:active={$currentPage.fieldTemplate === 'DemiBas'} onclick={() => setFieldTemplate('DemiBas')} title="Demi (bas)">
            <svg width="36" height="54" viewBox="0 0 68 105"><g opacity="0.35"><rect width="68" height="52.5" fill={$currentPage.backgroundColor} /></g><g><rect y="52.5" width="68" height="52.5" fill={$currentPage.backgroundColor} /><rect x="2" y="52.5" width="64" height="50.5" fill="none" stroke="white" stroke-width="2" /></g></svg>
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
          <div class="prop-group perspective-props">
            <label for="persTilt">Inclinaison ({$currentPage.perspectiveTilt ?? 34}°)</label>
            <input
              id="persTilt"
              type="range"
              min="15"
              max="55"
              value={$currentPage.perspectiveTilt ?? 34}
              oninput={(e) => updatePageSettings({ perspectiveTilt: parseInt(e.currentTarget.value) })}
            />
          </div>
          <div class="prop-group perspective-props">
            <label for="persInt">Intensité 3D ({$currentPage.perspectiveIntensity ?? 62}%)</label>
            <input
              id="persInt"
              type="range"
              min="0"
              max="100"
              value={$currentPage.perspectiveIntensity ?? 62}
              oninput={(e) => updatePageSettings({ perspectiveIntensity: parseInt(e.currentTarget.value) })}
            />
            <p class="help-text">Plus élevé = effet de profondeur plus marqué.</p>
          </div>
          <div class="prop-group perspective-props">
            <label for="persScale">Échelle ({Math.round(($currentPage.perspectiveScale ?? 0.86) * 100)}%)</label>
            <input
              id="persScale"
              type="range"
              min="70"
              max="100"
              value={Math.round(($currentPage.perspectiveScale ?? 0.86) * 100)}
              oninput={(e) => updatePageSettings({ perspectiveScale: parseInt(e.currentTarget.value) / 100 })}
            />
          </div>
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

<style>
  .sidebar {
    flex: 0 0 auto;
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
  }
  .label-text { font-size: 13px; font-weight: 500; }
  .help-text { font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: 20px; line-height: 1.4; }

  .properties-content { padding: 16px; flex: 1; overflow-y: auto; }
  .selection-count { font-size: 11px; color: var(--text-muted); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); }

  .prop-group { margin-bottom: 16px; }
  .prop-group > label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
  .prop-group input[type="text"], .prop-group textarea, .prop-group select {
    width: 100%;
    background: var(--bg-subtle);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
  }
  .prop-group input[type="text"]:focus, .prop-group textarea:focus, .prop-group select:focus,
  .prop-group input[type="number"]:focus {
    outline: none;
    border-color: var(--accent-primary);
    background: var(--bg-panel);
  }
  .prop-group textarea { resize: vertical; }
  .prop-group.row { display: flex; gap: 12px; }
  .prop-group.row .field { flex: 1; }

  .stance-controls { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: center; }
  .side-label { font-size: 11px; color: var(--text-muted); }

  .field-selector { display: flex; gap: 8px; }
  .field-selector button {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
    background: var(--bg-subtle); border: 1px solid var(--border-color);
    border-radius: 6px; padding: 8px 4px; cursor: pointer; transition: all 0.2s;
  }
  .field-selector button:hover { border-color: var(--border-strong); }
  .field-selector button span { font-size: 10px; color: var(--text-main); }
  .field-selector button.active { border-color: var(--accent-primary); background-color: var(--active-bg); }
  .field-selector button.active span { color: var(--accent-primary); font-weight: 600; }

  .btn-group { display: flex; background: var(--bg-subtle); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); }
  .btn-group button { flex: 1; background: transparent; border: none; padding: 5px 2px; font-size: 10px; color: var(--text-main); cursor: pointer; transition: all 0.2s; border-right: 1px solid var(--border-color); }
  .btn-group button:last-child { border-right: none; }
  .btn-group button.active { background: var(--accent-primary); color: #ffffff; }
  .btn-group button:hover:not(.active) { background: var(--hover-bg); }

  .prop-group input[type="number"] {
    width: 100%; background: var(--bg-subtle); border: 1px solid var(--border-color);
    color: var(--text-main); padding: 6px 8px; border-radius: 4px; font-size: 13px; font-family: monospace;
  }
  .prop-group input[type="range"] { width: 100%; accent-color: var(--accent-primary); }
  .perspective-props { margin-top: 10px; }
  .perspective-props .help-text { margin-top: 4px; font-style: normal; }

  .rotation-control { display: flex; align-items: center; gap: 12px; }
  .rotation-control input[type="range"] { flex: 2; }
  .rotation-control .angle-num { flex: 1; text-align: center; background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-main); padding: 4px; border-radius: 4px; font-size: 12px; }
  .rotation-control .unit { font-size: 12px; color: var(--text-muted); }

  .color-picker-wrap { display: flex; align-items: center; }
  input[type="color"] { appearance: none; -webkit-appearance: none; border: none; width: 32px; height: 32px; border-radius: 4px; cursor: pointer; background: none; padding: 0; }
  input[type="color"]::-webkit-color-swatch { border: 1px solid var(--border-color); border-radius: 4px; }

  .delete-btn { width: 100%; background-color: rgba(210, 94, 94, 0.1); color: #d25e5e; padding: 8px; border-radius: 4px; border: 1px solid rgba(210, 94, 94, 0.2); font-size: 13px; transition: all 0.2s; margin-top: 16px; }
  .delete-btn:hover { background-color: rgba(210, 94, 94, 0.2); }

  .toggle-wrap { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: var(--text-main); width: 100%; }
  .toggle-wrap input { width: 16px; height: 16px; accent-color: var(--accent-primary); }

  .prop-section { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-color); }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px; letter-spacing: 0.5px; }
  .color-size-row { display: flex; align-items: center; gap: 8px; }
  .color-size-row input[type="number"] { width: 45px; }
</style>
