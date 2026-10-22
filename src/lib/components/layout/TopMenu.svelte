<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import { onMount } from 'svelte';
  import {
    isDirty, showExportDialog, showSaveDialog, showConnections,
    tacticName, newTactic, undo, redo
  } from '$lib/stores/workspace';
  import { quickSave, currentRef } from '$lib/storage';
  import { pickWorkspace, workspaceOpen } from '$lib/workspace/state';
  import { exportOdsFile, importOdsFile } from '$lib/services/exportService';
  import { cloudSession } from '$lib/storage/cloudClient';
  import OpenDialog from './OpenDialog.svelte';
  import { Button, Dropdown, DropdownDivider, DropdownItem, Input, Navbar, NavBrand, NavLi, NavUl } from 'flowbite-svelte';

  const anyCloud = $derived($cloudSession.configured.google || $cloudSession.configured.github || $cloudSession.configured.gitlab);

  let showOpen = $state(false);
  let editingName = $state(false);

  function createNew() {
    if ($workspaceOpen) return;
    if ($isDirty && !confirm('Créer une nouvelle tactique ? Les modifications non enregistrées seront perdues.')) return;
    newTactic();
    currentRef.set(null);
  }
  function doWorkspace() { void pickWorkspace(true); }
  async function doImportOds() {
    try {
      const n = await importOdsFile();
      if (n) alert(`${n} séance(s) importée(s).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import impossible.');
    }
  }
  async function doExportOds() {
    try {
      const warning = await exportOdsFile();
      alert(warning || 'Classeur mis à jour.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export impossible.');
    }
  }
  function doOpen() { showOpen = true; }
  function doSave() { quickSave(); }
  function doSaveAs() { showSaveDialog.set(true); }
  function doExport() { showExportDialog.set(true); }
  function doConnections() { showConnections.set(true); }
  function doPrint() { window.print(); }

  const menuGroups = $derived([
    {
      name: 'Fichier',
      items: [
        { label: 'Nouveau', action: createNew },
        { label: 'Ouvrir…', action: doOpen },
        { label: 'Ouvrir un espace de travail…', action: doWorkspace },
        { divider: true },
        { label: 'Importer le classeur', action: () => { void doImportOds(); } },
        { label: 'Exporter vers le classeur', action: () => { void doExportOds(); } },
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
      { label: 'Annuler', action: undo },
      { label: 'Rétablir', action: redo }
    ] },
    { name: 'Aide', items: [
      ...(anyCloud ? [{ label: 'Connexions cloud…', action: doConnections }] : []),
      { label: 'À propos', action: () => {} }
    ] }
  ]);

  function commitName(e: Event) {
    const v = (e.target as HTMLInputElement).value.trim();
    if (v) tacticName.set(v);
    editingName = false;
  }

  onMount(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      let dirty = false;
      const u = isDirty.subscribe(v => dirty = v); u();
      if (dirty) { e.preventDefault(); e.returnValue = ''; return ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  });
</script>

<Navbar fluid class="px-2 py-1">
  <NavBrand href="#marque" onclick={(e) => e.preventDefault()}>
    <img src={logo} alt="" class="me-2 h-6 w-6 rounded-md object-cover" />
    <span class="self-center text-sm font-semibold whitespace-nowrap">FC Coach Notebook</span>
  </NavBrand>
  <NavUl class="order-1">
    {#each menuGroups as group (group.name)}
      <NavLi id={`menu-${group.name}`} class="cursor-pointer">{group.name}</NavLi>
      <Dropdown simple triggeredBy={`#menu-${group.name}`} class="w-56">
        {#each group.items as item}
          {#if item.divider}
            <DropdownDivider />
          {:else}
            <DropdownItem onclick={() => item.action?.()}>{item.label}</DropdownItem>
          {/if}
        {/each}
      </Dropdown>
    {/each}
  </NavUl>
  <div class="ms-auto flex items-center gap-2">
    {#if editingName}
      <Input
        size="sm"
        class="w-48"
        value={$tacticName}
        autofocus
        onblur={commitName}
        onkeydown={(e) => { if (e.key === 'Enter') commitName(e); if (e.key === 'Escape') editingName = false; }}
      />
    {:else}
      <Button color="alternative" size="sm" onclick={() => editingName = true} title="Renommer">
        {$tacticName || 'Sans titre'}{#if $isDirty}<span class="text-brand">*</span>{/if}
      </Button>
    {/if}
    <Button color="brand" size="sm" onclick={doSave} title="Enregistrer (Ctrl+S)">Enregistrer</Button>
  </div>
</Navbar>

{#if showOpen}
  <OpenDialog onclose={() => showOpen = false} />
{/if}
