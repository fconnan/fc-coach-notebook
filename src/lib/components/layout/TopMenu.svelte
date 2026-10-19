<script lang="ts">
  import { 
    saveTactic, 
    loadTactic, 
    hasActiveDirectory, 
    getActiveDirName, 
    reloadDataFromActiveDirectory,
    openDirectory 
  } from '$lib/services/tacticFileService';
  import { onMount } from 'svelte';
  import { currentPage, isDirty, showTacticBrowser, showExportDialog } from '$lib/stores/workspace';
  import TacticBrowser from './TacticBrowser.svelte';

  let openMenu = $state<string | null>(null);

  function toggleMenu(name: string, e: Event) {
    e.stopPropagation();
    openMenu = openMenu === name ? null : name;
  }

  function closeMenu() {
    openMenu = null;
  }

  async function handleSave(forceNew = false) {
    closeMenu();
    await saveTactic($currentPage, forceNew);
  }

  async function handleLoad() {
    closeMenu();
    const handle = await openDirectory();
    if (handle) {
      showTacticBrowser.set(true);
    }
  }

  function createNew() {
    closeMenu();
    if (confirm('Créer une nouvelle tactique ? Les éléments actuels seront effacés.')) {
        window.location.reload();
    }
  }

  const menuGroups = [
    {
      name: 'Fichier',
      items: [
        { label: 'Nouveau', action: createNew },
        { label: 'Ouvrir répertoire...', action: handleLoad },
        { divider: true },
        { label: 'Enregistrer', action: () => handleSave(false) },
        { label: 'Enregistrer sous...', action: () => handleSave(true) },
        { divider: true },
        { label: 'Exporter (PDF / Image)...', action: () => { closeMenu(); showExportDialog.set(true); } },
        { label: 'Imprimer...', action: () => { closeMenu(); window.print(); } }
      ]
    },
    { name: 'Modifier', items: [{ label: 'Annuler', action: closeMenu }, { label: 'Rétablir', action: closeMenu }] },
    { name: 'Vue', items: [{ label: 'Zoom (Auto)', action: closeMenu }] },
    { name: 'Aide', items: [{ label: 'Support', action: closeMenu }, { label: 'À propos', action: closeMenu }] }
  ];

  onMount(() => {
    window.addEventListener('click', closeMenu);
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      let dirty = false;
      const unsubscribe = isDirty.subscribe(v => dirty = v);
      unsubscribe();
      
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });
</script>

<div class="top-menu">
  <div class="logo">FC Tactics</div>
  <div class="menu-items-row">
    {#each menuGroups as group}
      <div class="menu-container">
        <button 
          class="menu-item" 
          class:active={openMenu === group.name}
          onclick={(e) => toggleMenu(group.name, e)}
        >
          {group.name}
        </button>
        
        {#if openMenu === group.name}
          <div class="dropdown">
            {#each group.items as item}
              {#if item.divider}
                <div class="divider"></div>
              {:else}
                <button class="dropdown-item" onclick={item.action}>
                  {item.label}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="spacer"></div>
  
  <div class="status-display">
    <button class="breadcrumb-btn" onclick={() => showTacticBrowser.set(true)} title="Changer de tactique">
      <span class="dir-name">[{getActiveDirName()}]</span>
      <span class="sep">/</span>
      <span class="file-info" class:is-dirty={$isDirty}>
        {$currentPage.name || 'Sans titre'}
        {#if $isDirty}<span class="asterisk">*</span>{/if}
      </span>
    </button>
  </div>

  {#if hasActiveDirectory()}
    <button class="resume-btn" onclick={reloadDataFromActiveDirectory} title="Recharger les fichiers depuis ce dossier">
      <span class="icon">📂</span> Recharger
    </button>
  {/if}
</div>

{#if $showTacticBrowser}
  <TacticBrowser onclose={() => showTacticBrowser.set(false)} />
{/if}

<style>
  .top-menu {
    display: flex;
    align-items: center;
    background-color: var(--bg-panel);
    padding: 2px 12px;
    height: 32px;
  }
  
  .logo {
    font-weight: 700;
    color: var(--accent-primary);
    margin-right: 24px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
  }
  
  .menu-items-row {
    display: flex;
    gap: 4px;
  }

  .menu-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .menu-item {
    font-size: 13px;
    padding: 4px 10px;
    border-radius: 4px;
    color: var(--text-main);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .menu-item:hover, .menu-item.active {
    background-color: var(--hover-bg);
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 180px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    border-radius: 6px;
    padding: 6px 0;
    margin-top: 4px;
    z-index: 2000;
  }

  .dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text-main);
    padding: 6px 16px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .dropdown-item:hover {
    background-color: var(--accent-primary);
    color: white;
  }

  .divider {
    height: 1px;
    background-color: var(--border-color);
    margin: 6px 0;
  }

  .spacer {
    flex: 1;
  }

  .resume-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: var(--accent-primary);
    color: white;
    border: none;
    padding: 2px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    height: 24px;
  }

  .resume-btn:hover {
    background-color: var(--accent-hover);
  }

  .resume-btn .icon {
    font-size: 14px;
  }

  .status-display {
    display: flex;
    align-items: center;
    margin-right: 16px;
    font-family: var(--font-main);
  }

  .file-info {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
    letter-spacing: 0.3px;
  }

  .file-info.is-dirty {
    color: var(--text-main);
  }

  .asterisk {
    color: var(--accent-primary);
    margin-left: 2px;
    font-weight: 700;
    font-size: 14px;
  }

  .breadcrumb-btn {
    background: transparent;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.2s;
  }

  .breadcrumb-btn:hover {
    background: var(--hover-bg);
  }

  .dir-name {
    color: var(--accent-primary);
    font-family: monospace;
    font-size: 11px;
    opacity: 0.8;
  }

  .sep {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
