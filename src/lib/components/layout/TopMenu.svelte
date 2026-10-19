<script lang="ts">
  import { onMount } from 'svelte';
  import {
    isDirty, showExportDialog, showSaveDialog, showConnections,
    tacticName, newTactic, undo, redo
  } from '$lib/stores/workspace';
  import { quickSave, currentRef } from '$lib/storage';
  import { cloudSession } from '$lib/storage/cloudClient';
  import OpenDialog from './OpenDialog.svelte';

  const anyCloud = $derived($cloudSession.configured.google || $cloudSession.configured.github || $cloudSession.configured.gitlab);

  let openMenu = $state<string | null>(null);
  let showOpen = $state(false);
  let editingName = $state(false);

  function toggleMenu(name: string, e: Event) {
    e.stopPropagation();
    openMenu = openMenu === name ? null : name;
  }
  function closeMenu() { openMenu = null; }

  function createNew() {
    closeMenu();
    if ($isDirty && !confirm('Créer une nouvelle tactique ? Les modifications non enregistrées seront perdues.')) return;
    newTactic();
    currentRef.set(null);
  }
  function doOpen() { closeMenu(); showOpen = true; }
  function doSave() { closeMenu(); quickSave(); }
  function doSaveAs() { closeMenu(); showSaveDialog.set(true); }
  function doExport() { closeMenu(); showExportDialog.set(true); }
  function doConnections() { closeMenu(); showConnections.set(true); }
  function doPrint() { closeMenu(); window.print(); }

  const menuGroups = $derived([
    {
      name: 'Fichier',
      items: [
        { label: 'Nouveau', action: createNew },
        { label: 'Ouvrir…', action: doOpen },
        { divider: true },
        { label: 'Enregistrer', action: doSave },
        { label: 'Enregistrer sous…', action: doSaveAs },
        ...(anyCloud ? [{ divider: true }, { label: 'Connexions cloud…', action: doConnections }] : []),
        { divider: true },
        { label: 'Exporter (PDF / Image)…', action: doExport },
        { label: 'Imprimer…', action: doPrint }
      ]
    },
    { name: 'Modifier', items: [
      { label: 'Annuler', action: () => { closeMenu(); undo(); } },
      { label: 'Rétablir', action: () => { closeMenu(); redo(); } }
    ] },
    { name: 'Aide', items: [
      ...(anyCloud ? [{ label: 'Connexions cloud…', action: doConnections }] : []),
      { label: 'À propos', action: closeMenu }
    ] }
  ]);

  function commitName(e: Event) {
    const v = (e.target as HTMLInputElement).value.trim();
    if (v) tacticName.set(v);
    editingName = false;
  }

  onMount(() => {
    window.addEventListener('click', closeMenu);
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      let dirty = false;
      const u = isDirty.subscribe(v => dirty = v); u();
      if (dirty) { e.preventDefault(); e.returnValue = ''; return ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });
</script>

<div class="top-menu">
  <div class="brand">
    <svg class="brand-mark" width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="6" fill="var(--accent-primary)" />
      <rect x="6" y="6" width="20" height="20" rx="2" fill="none" stroke="#fff" stroke-width="1.6" />
      <line x1="6" y1="16" x2="26" y2="16" stroke="#fff" stroke-width="1.6" />
      <circle cx="16" cy="16" r="3.4" fill="none" stroke="#fff" stroke-width="1.6" />
    </svg>
    <span class="brand-name">FC Tactics</span>
  </div>

  <div class="menu-items-row">
    {#each menuGroups as group}
      <div class="menu-container">
        <button class="menu-item" class:active={openMenu === group.name} onclick={(e) => toggleMenu(group.name, e)}>
          {group.name}
        </button>
        {#if openMenu === group.name}
          <div class="dropdown">
            {#each group.items as item}
              {#if item.divider}
                <div class="divider"></div>
              {:else}
                <button class="dropdown-item" onclick={item.action}>{item.label}</button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="spacer"></div>

  <div class="filename">
    {#if editingName}
      <!-- svelte-ignore a11y_autofocus -->
      <input class="name-edit" value={$tacticName} autofocus
        onblur={commitName}
        onkeydown={(e) => { if (e.key === 'Enter') commitName(e); if (e.key === 'Escape') editingName = false; }} />
    {:else}
      <button class="name-btn" onclick={() => editingName = true} title="Renommer">
        {$tacticName || 'Sans titre'}{#if $isDirty}<span class="asterisk">*</span>{/if}
      </button>
    {/if}
  </div>

  <button class="save-btn" onclick={doSave} title="Enregistrer (Ctrl+S)">
    <span class="icon">💾</span> Enregistrer
  </button>
</div>

{#if showOpen}
  <OpenDialog onclose={() => showOpen = false} />
{/if}

<style>
  .top-menu { display: flex; align-items: center; background-color: var(--bg-panel); padding: 2px 12px; height: 36px; }

  .brand { display: flex; align-items: center; gap: 8px; margin-right: 22px; }
  .brand-mark { display: block; border-radius: 6px; }
  .brand-name { font-weight: 700; color: var(--text-main); font-size: 14px; letter-spacing: 0.3px; white-space: nowrap; }

  .menu-items-row { display: flex; gap: 4px; }
  .menu-container { position: relative; display: flex; align-items: center; }
  .menu-item { font-size: 13px; padding: 4px 10px; border-radius: 4px; color: var(--text-main); background: transparent; border: none; cursor: pointer; transition: background 0.2s; }
  .menu-item:hover, .menu-item.active { background-color: var(--hover-bg); }

  .dropdown { position: absolute; top: 100%; left: 0; min-width: 200px; background-color: var(--bg-panel); border: 1px solid var(--border-color); box-shadow: var(--shadow-md); border-radius: 6px; padding: 6px 0; margin-top: 4px; z-index: 2000; }
  .dropdown-item { display: block; width: 100%; text-align: left; background: transparent; border: none; color: var(--text-main); padding: 6px 16px; font-size: 13px; cursor: pointer; transition: background 0.1s; }
  .dropdown-item:hover { background-color: var(--accent-primary); color: white; }
  .divider { height: 1px; background-color: var(--border-color); margin: 6px 0; }

  .spacer { flex: 1; }

  .filename { margin-right: 14px; }
  .name-btn { background: transparent; border: 1px solid transparent; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text-main); }
  .name-btn:hover { background: var(--hover-bg); border-color: var(--border-color); }
  .asterisk { color: var(--accent-primary); margin-left: 3px; font-weight: 700; }
  .name-edit { padding: 4px 10px; border: 1px solid var(--accent-primary); border-radius: 6px; background: var(--bg-canvas); color: var(--text-main); font-size: 13px; font-weight: 500; min-width: 180px; }

  .save-btn { display: flex; align-items: center; gap: 6px; background-color: var(--accent-primary); color: white; border: none; padding: 5px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  .save-btn:hover { background-color: var(--accent-hover); }
  .save-btn .icon { font-size: 13px; }
</style>
