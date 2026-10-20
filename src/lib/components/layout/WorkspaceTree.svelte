<script lang="ts">
  import {
    workspaceOpen, folderLabel, needsPermission, trainer, categories, categoryInfo,
    seanceList, seanceFile, pickWorkspace, resumeWorkspace, createCategory, commitTrainerName, showCategory,
    showSeance, patchHeader
  } from '$lib/workspace/state';
  import { tacticName } from '$lib/stores/workspace';

  let catName = $state('');
  let adding = $state(false);

  async function addCategory() {
    const error = await createCategory(catName, catName);
    if (error) return;
    catName = '';
    adding = false;
  }
</script>

<div class="tree">
  {#if !$workspaceOpen}
    <button class="open" type="button" onclick={() => pickWorkspace(true)}>Ouvrir un espace de travail</button>
  {:else}
    <div class="folder" title={$folderLabel}>{$folderLabel || 'Espace de travail'}</div>
    {#if $needsPermission}
      <button class="open" type="button" onclick={() => resumeWorkspace()}>Rouvrir le dossier</button>
    {/if}
    <div class="row">
      <input placeholder="Nom" value={$trainer.name} oninput={(e) => commitTrainerName(e.currentTarget.value)} />
    </div>
    <div class="cats">
      {#each $categories as cat (cat.id)}
        <button type="button" class="cat" class:active={cat.id === $categoryInfo?.id} onclick={() => showCategory(cat.id)}>{cat.name}</button>
      {/each}
    </div>
    {#if adding}
      <input placeholder="Catégorie" bind:value={catName} />
      <button class="open" type="button" onclick={addCategory}>Créer</button>
    {:else}
      <button class="link" type="button" onclick={() => adding = true}>Nouvelle catégorie</button>
    {/if}
    {#if $categoryInfo}
      <div class="seance-head">
        <span>Séances</span>
      </div>
      {#each $seanceList as item (item.file)}
        <button type="button" class="seance" class:active={item.file === $seanceFile} onclick={() => showSeance(item.file)}>
          {item.sheet} · {item.name}
        </button>
      {/each}
      {#if $seanceFile}
        <input class="rename" value={$tacticName} oninput={(e) => patchHeader({ name: e.currentTarget.value })} />
      {/if}
    {/if}
  {/if}
</div>

<style>
  .tree { display: flex; flex-direction: column; gap: 4px; padding: 8px; border-bottom: 1px solid var(--border-color); max-height: 42%; overflow: auto; }
  .folder { font-size: 12px; font-weight: 700; color: var(--text-main); }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  input {
    width: 100%; box-sizing: border-box; font-size: 12px; padding: 4px 6px;
    background: var(--bg-app); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 4px;
  }
  .open, .link, .cat, .seance {
    background: transparent; border: none; color: var(--text-main); cursor: pointer; text-align: left; font-size: 12px;
  }
  .open { color: var(--accent-primary); font-weight: 600; padding: 2px 0; }
  .link { color: var(--text-muted); font-size: 11px; }
  .cat, .seance { padding: 3px 4px; border-radius: 4px; }
  .cat.active, .seance.active { background: rgba(94, 106, 210, 0.18); color: var(--accent-primary); }
  .seance-head { display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: 700; letter-spacing: 0.4px; color: var(--text-muted); margin-top: 4px; }
  .rename { margin-top: 4px; }
</style>
