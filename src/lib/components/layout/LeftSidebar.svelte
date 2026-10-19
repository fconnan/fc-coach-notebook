<script lang="ts">
  import { activeTool, currentPage, setTeamFormation, type ElementType } from '$lib/stores/workspace';
  import EquipmentIcon from '../shapes/EquipmentIcon.svelte';
  import { FORMATION_NAMES, formationPositions } from '$lib/utils/formations';

  let { width = 250 } = $props<{ width?: number }>();

  // Lighten a hex colour (same approach as the pitch's light stripe)
  function lighten(hex: string, amt: number): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return 'rgb(61, 125, 75)';
    const r = Math.min(255, parseInt(m[1], 16) + amt);
    const g = Math.min(255, parseInt(m[2], 16) + amt);
    const b = Math.min(255, parseInt(m[3], 16) + amt);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const tileBg = $derived(lighten($currentPage.backgroundColor, 18));
  const tileHover = $derived(lighten($currentPage.backgroundColor, 34));

  let selectedFormation = $state(FORMATION_NAMES[0]);
  function applyFormation(team: 'team1' | 'team2') {
    setTeamFormation(team, formationPositions(selectedFormation, team));
  }

  let open = $state({ players: true, equipment: true, tools: true });
  function toggle(section: keyof typeof open) { open[section] = !open[section]; }

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
</script>

<div class="sidebar" style:width="{width}px" style:--tile-bg={tileBg} style:--tile-hover={tileHover}>
  <div class="header">Éléments</div>
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
</div>

<style>
  .sidebar {
    flex: 0 0 auto;
    background-color: var(--bg-panel);
    border-right: 1px solid var(--border-color);
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
  .library { flex: 1; overflow-y: auto; }
  .section-head {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 14px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    color: var(--text-main);
    background: var(--bg-subtle);
    border: none;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
  }
  .section-head:hover { background: var(--hover-bg); }
  .chev { font-size: 10px; color: var(--text-muted); }
  .section-body { padding: 10px 12px; }

  .group-label {
    font-size: 10px;
    color: var(--text-muted);
    margin: 6px 0 4px;
    text-transform: uppercase;
  }
  .items-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .items-row.wrap { flex-wrap: wrap; }

  .item {
    width: 56px; height: 56px;
    background-color: var(--tile-bg, rgb(61, 125, 75));
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    cursor: grab;
    transition: all 0.15s ease;
  }
  .item.small { width: 50px; height: 50px; }
  .item:hover { border-color: var(--accent-primary); background-color: var(--tile-hover, rgb(73, 143, 88)); transform: translateY(-1px); }
  .item:active { cursor: grabbing; transform: scale(0.95); }
  .emoji-item { font-size: 30px; }

  .formation-select {
    width: 100%;
    background: var(--bg-subtle);
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
    background: var(--bg-subtle);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 6px 4px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .formation-apply button:hover { border-color: var(--accent-primary); background: var(--hover-bg); }

  .tool-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .tool-cell {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 7px 3px;
    background: var(--tile-bg, rgb(61, 125, 75));
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tool-cell:hover { border-color: var(--accent-primary); background: var(--tile-hover, rgb(73, 143, 88)); }
  .tool-cell.active { border-color: var(--accent-primary); background: var(--accent-primary); color: #ffffff; }
  .tool-icon { font-size: 16px; line-height: 1; }
  .tool-name { font-size: 9px; color: rgba(255, 255, 255, 0.85); }
  .tool-cell.active .tool-name { color: #ffffff; }
  .hint { font-size: 11px; color: var(--accent-primary); margin-top: 8px; font-style: italic; }
</style>
