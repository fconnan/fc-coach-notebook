<script lang="ts">
  import SeanceBoard from './SeanceBoard.svelte';
  import {
    trainer, categories, styles, categoryInfo, seanceList, seanceFile, screen,
    createCategory, commitTrainerName, showHome, showCategory, showSeance, createSeance,
    createStyle, updateStyle
  } from '$lib/workspace/state';
  import type { PageStyle } from '$lib/workspace/model';

  let catId = $state('');
  let styleId = $state('');
  let styleOpen = $state('');
  let seancePick = $state('');
  let dialog = $state<'category' | 'style' | 'seance' | null>(null);
  let entryName = $state('');
  let plainName = $state('');
  let dialogError = $state('');

  const openedStyle = $derived($styles.find(style => style.id === styleOpen) ?? null);

  $effect(() => {
    if (!$categories.some(cat => cat.id === catId)) catId = $categories[0]?.id ?? '';
  });
  $effect(() => {
    if (!$styles.some(style => style.id === styleId)) styleId = $styles[0]?.id ?? '';
    if (styleOpen && !$styles.some(style => style.id === styleOpen)) styleOpen = '';
  });
  $effect(() => {
    if (!$seanceList.some(item => item.file === seancePick)) seancePick = $seanceList[0]?.file ?? '';
  });

  function openDialog(kind: 'category' | 'style' | 'seance') {
    dialog = kind;
    entryName = '';
    plainName = '';
    dialogError = '';
  }

  async function confirmDialog() {
    if (dialog === 'category') {
      const id = entryName.trim();
      dialogError = (await createCategory(entryName, plainName)) || '';
      if (dialogError) return;
      dialog = null;
      await showCategory(id);
      return;
    }
    if (dialog === 'seance') {
      dialogError = (await createSeance(entryName, plainName)) || '';
      if (!dialogError) dialog = null;
      return;
    }
    const id = entryName.trim();
    dialogError = (await createStyle(entryName, plainName)) || '';
    if (dialogError) return;
    dialog = null;
    styleId = id;
    styleOpen = id;
  }

</script>

<div class="browser">
  {#if $screen !== 'home'}
    <nav class="path">
      <button type="button" class="back" onclick={showHome}>Espace de travail</button>
      {#if $categoryInfo}
        <span class="sep">/</span>
        <select aria-label="Catégorie" value={$categoryInfo.id} onchange={(e) => showCategory(e.currentTarget.value)}>
          {#each $categories as cat (cat.id)}
            <option value={cat.id}>{cat.name}</option>
          {/each}
        </select>
      {/if}
      {#if $screen === 'seance'}
        <span class="sep">/</span>
        <select aria-label="Séance" value={$seanceFile ?? ''} onchange={(e) => showSeance(e.currentTarget.value)}>
          {#each $seanceList as item (item.file)}
            <option value={item.file}>{item.name || item.sheet}</option>
          {/each}
        </select>
      {/if}
    </nav>
  {/if}

  {#if $screen === 'home'}
    <section>
      <h1>Espace de travail</h1>
      <label class="name-field">Nom
        <input value={$trainer.name} oninput={(e) => commitTrainerName(e.currentTarget.value)} />
      </label>

      <div class="pick">
        <label>Catégories
          <select bind:value={catId} disabled={$categories.length === 0}>
            {#if $categories.length === 0}
              <option value="">Aucune catégorie</option>
            {/if}
            {#each $categories as cat (cat.id)}
              <option value={cat.id}>{cat.name}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="quiet" disabled={!catId} onclick={() => showCategory(catId)}>Ouvrir</button>
        <button type="button" onclick={() => openDialog('category')}>Ajouter</button>
      </div>

      <div class="pick">
        <label>Styles
          <select bind:value={styleId} disabled={$styles.length === 0}>
            {#if $styles.length === 0}
              <option value="">Aucun style</option>
            {/if}
            {#each $styles as style (style.id)}
              <option value={style.id}>{style.name}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="quiet" disabled={!styleId} onclick={() => styleOpen = styleId}>Ouvrir</button>
        <button type="button" onclick={() => openDialog('style')}>Ajouter</button>
      </div>

      {#if openedStyle}
        <div class="style-edit">
          <p class="style-title">{openedStyle.name}</p>
          <label>Équipe 1 <input type="color" value={openedStyle.team1Color} onchange={(e) => updateStyle(openedStyle.id, { team1Color: e.currentTarget.value })} /></label>
          <label>Taille <input type="number" value={openedStyle.team1Size} onchange={(e) => updateStyle(openedStyle.id, { team1Size: Number(e.currentTarget.value) })} /></label>
          <label>Équipe 2 <input type="color" value={openedStyle.team2Color} onchange={(e) => updateStyle(openedStyle.id, { team2Color: e.currentTarget.value })} /></label>
          <label>Taille <input type="number" value={openedStyle.team2Size} onchange={(e) => updateStyle(openedStyle.id, { team2Size: Number(e.currentTarget.value) })} /></label>
          <label>Ballon <input type="color" value={openedStyle.ballColor} onchange={(e) => updateStyle(openedStyle.id, { ballColor: e.currentTarget.value })} /></label>
          <label>Herbe <input type="color" value={openedStyle.backgroundColor} onchange={(e) => updateStyle(openedStyle.id, { backgroundColor: e.currentTarget.value })} /></label>
          <label>Pelouse
            <select value={openedStyle.grassType} onchange={(e) => updateStyle(openedStyle.id, { grassType: e.currentTarget.value } as Partial<PageStyle>)}>
              <option value="stripes">Rayée</option>
              <option value="solid">Unie</option>
            </select>
          </label>
        </div>
      {/if}
    </section>
  {:else if $screen === 'category'}
    <section>
      <h1>{$categoryInfo?.name}</h1>
      <div class="pick">
        <label>Séances
          <select bind:value={seancePick} disabled={$seanceList.length === 0}>
            {#if $seanceList.length === 0}
              <option value="">Aucune séance</option>
            {/if}
            {#each $seanceList as item (item.file)}
              <option value={item.file}>{item.name || item.sheet}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="quiet" disabled={!seancePick} onclick={() => showSeance(seancePick)}>Ouvrir</button>
        <button type="button" onclick={() => openDialog('seance')}>Ajouter</button>
      </div>
    </section>
  {:else if $screen === 'seance'}
    <SeanceBoard />
  {/if}
</div>

<svelte:window onkeydown={(e) => { if (dialog && e.key === 'Escape') dialog = null; }} />

{#if dialog}
  <div class="overlay">
    <form class="dialog" aria-labelledby="entry-title" onsubmit={(e) => { e.preventDefault(); void confirmDialog(); }}>
      <h2 id="entry-title">{dialog === 'category' ? 'Nouvelle catégorie' : dialog === 'seance' ? 'Nouvelle séance' : 'Nouveau style'}</h2>
      <label>{dialog === 'style' ? 'Fichier' : 'Répertoire'}
        <input bind:value={entryName} />
      </label>
      <label>Nom
        <input bind:value={plainName} />
      </label>
      {#if dialogError}<p class="error">{dialogError}</p>{/if}
      <div class="dialog-actions">
        <button type="button" class="quiet" onclick={() => dialog = null}>Annuler</button>
        <button type="submit">OK</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .browser { color: #0f172a; }
  .path { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .path .back {
    border: none; background: transparent; color: #0f172a;
    font-size: 14px; font-weight: 600; cursor: pointer; padding: 4px 2px;
  }
  .path .back:hover { color: #2563eb; }
  .sep { color: #94a3b8; }
  section {
    display: flex; flex-direction: column; gap: 10px;
    margin-bottom: 16px; padding: 16px;
    border: 1px solid #e2e8f0; border-radius: 16px; background: #fff;
  }
  h1 { margin: 0; font-size: 20px; font-weight: 600; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  .pick { display: flex; align-items: flex-end; gap: 8px; }
  .pick label { flex: 0 0 auto; align-items: flex-start; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; }
  .name-field { align-self: flex-start; }
  .name-field input { width: 18rem; }
  input, select {
    font: inherit; font-size: 14px; color: #0f172a;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px;
  }
  select { field-sizing: content; width: auto; max-width: 100%; }
  section button[type='button']:not(.quiet),
  .dialog button[type='submit'] {
    border: none; background: #2563eb; color: #fff;
    border-radius: 8px; padding: 6px 12px; cursor: pointer; font-weight: 500; letter-spacing: 0;
  }
  section button[type='button']:not(.quiet):hover,
  .dialog button[type='submit']:hover { background: #1d4ed8; }
  .quiet {
    border: 1px solid #d4d4d4; background: #fff; color: #374151;
    border-radius: 8px; padding: 6px 12px; cursor: pointer; font-weight: 500;
  }
  .quiet:hover { background: #f8fafc; border-color: #94a3b8; }
  button:disabled { opacity: 0.45; cursor: default; }
  .style-edit { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; background: #f8fafc; }
  .style-title { margin: 0; width: 100%; font-size: 14px; font-weight: 600; color: #0f172a; }
  .overlay {
    position: fixed; inset: 0; z-index: 20;
    display: flex; align-items: center; justify-content: center;
    background: rgba(15, 23, 42, 0.35);
  }
  .dialog {
    display: flex; flex-direction: column; gap: 12px;
    width: min(24rem, calc(100% - 32px));
    padding: 16px; border-radius: 16px; background: #fff;
    border: 1px solid #e2e8f0;
  }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .error { margin: 0; font-size: 13px; color: #b91c1c; }
</style>
