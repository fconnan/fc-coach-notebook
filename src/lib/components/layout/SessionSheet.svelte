<script lang="ts">
  import { currentPage, pages, currentPageId, setMarkdownContent, updateDrill, addExercise, duplicateExercise, renameExercise, moveExercise, removeExercise, commitToActiveFrame } from '$lib/stores/workspace';
  import { seanceHeader, styles, patchHeader, useStyle, saveStyleFromExercise } from '$lib/workspace/state';
  import { AREAS, KINDS, METHODS, PHASES, SECTION_TITLES } from '$lib/workspace/model';
  import MarkdownEditor from './MarkdownEditor.svelte';

  let styleName = $state('');

  function insertHeading(title: string) {
    if (!title) return;
    const current = $currentPage?.markdownContent || '';
    const next = `${current.trim()}\n\n## ${title}\n`;
    setMarkdownContent(next);
  }

  function selectExercise(id: string) {
    if (id === $currentPageId) return;
    commitToActiveFrame();
    currentPageId.set(id);
  }
</script>

<div class="sheet">
  <div class="meta">
    <div class="row">
      <label>Date<input value={$seanceHeader.date} oninput={(e) => patchHeader({ date: e.currentTarget.value })} /></label>
      <label>Feuille
        <select value={$seanceHeader.sheet} onchange={(e) => patchHeader({ sheet: e.currentTarget.value })}>
          {#each Array.from({ length: 80 }, (_, i) => `S${i + 1}`) as sheet}
            <option value={sheet}>{sheet}</option>
          {/each}
        </select>
      </label>
    </div>
    <label>Phase
      <input list="phases" value={$seanceHeader.phase} oninput={(e) => patchHeader({ phase: e.currentTarget.value })} />
    </label>
    <datalist id="phases">
      {#each PHASES as item}<option value={item}></option>{/each}
    </datalist>
    <label>Principe<input value={$seanceHeader.principle} oninput={(e) => patchHeader({ principle: e.currentTarget.value })} /></label>
    <label>Moyens<input value={$seanceHeader.means} oninput={(e) => patchHeader({ means: e.currentTarget.value })} /></label>

    <div class="ex-head">
      <span>Exercices</span>
      <button type="button" onclick={addExercise}>Ajouter</button>
    </div>
    <ul class="ex-list">
      {#each $pages as page, i (page.id)}
        <li class:active={page.id === $currentPageId}>
          <button type="button" class="ex-name" onclick={() => selectExercise(page.id)}>{i + 1}. {page.name || 'Exercice'}</button>
          <button type="button" title="Monter" onclick={() => moveExercise(page.id, -1)}>↑</button>
          <button type="button" title="Descendre" onclick={() => moveExercise(page.id, 1)}>↓</button>
          <button type="button" title="Dupliquer" onclick={() => duplicateExercise(page.id)}>⧉</button>
          {#if $pages.length > 1}
            <button type="button" title="Retirer" onclick={() => removeExercise(page.id)}>✕</button>
          {/if}
        </li>
      {/each}
    </ul>
    <label>Nom de l'exercice
      <input value={$currentPage?.name || ''} oninput={(e) => $currentPage && renameExercise($currentPage.id, e.currentTarget.value)} />
    </label>

    <div class="row">
      <label>Procédé
        <input list="kinds" value={$currentPage?.drill?.kind || ''} oninput={(e) => updateDrill({ kind: e.currentTarget.value })} />
      </label>
      <label>Méthode
        <input list="methods" value={$currentPage?.drill?.method || ''} oninput={(e) => updateDrill({ method: e.currentTarget.value })} />
      </label>
    </div>
    <datalist id="kinds">{#each KINDS as item}<option value={item}></option>{/each}</datalist>
    <datalist id="methods">{#each METHODS as item}<option value={item}></option>{/each}</datalist>
    <div class="row">
      <label>Durée<input value={$currentPage?.drill?.duration || ''} oninput={(e) => updateDrill({ duration: e.currentTarget.value })} /></label>
      <label>Effectif<input value={$currentPage?.drill?.headcount || ''} oninput={(e) => updateDrill({ headcount: e.currentTarget.value })} /></label>
    </div>
    <label>Aire de jeu
      <input list="areas" value={$currentPage?.drill?.area || ''} oninput={(e) => updateDrill({ area: e.currentTarget.value })} />
    </label>
    <datalist id="areas">{#each AREAS as item}<option value={item}></option>{/each}</datalist>
    <label>Matériels<input value={$currentPage?.drill?.equipment || ''} oninput={(e) => updateDrill({ equipment: e.currentTarget.value })} /></label>

    <div class="row">
      <label>Style
        <select value={$currentPage?.styleId || ''} onchange={(e) => e.currentTarget.value && useStyle(e.currentTarget.value)}>
          <option value="">—</option>
          {#each $styles as style}
            <option value={style.id}>{style.name}</option>
          {/each}
        </select>
      </label>
      <label>Nouveau style
        <input bind:value={styleName} placeholder="Nom" onkeydown={(e) => { if (e.key === 'Enter' && styleName.trim()) { saveStyleFromExercise(styleName); styleName = ''; } }} />
      </label>
    </div>

    <label>Titre
      <select onchange={(e) => { insertHeading(e.currentTarget.value); e.currentTarget.value = ''; }}>
        <option value="">Insérer un titre…</option>
        {#each SECTION_TITLES as title}<option value={title}>{title}</option>{/each}
      </select>
    </label>
  </div>

  <div class="editor">
    {#key $currentPageId}
      <MarkdownEditor value={$currentPage?.markdownContent || ''} onchange={setMarkdownContent} />
    {/key}
  </div>
</div>

<style>
  .sheet { display: flex; flex-direction: column; gap: 10px; min-height: 100%; }
  .meta { display: flex; flex-direction: column; gap: 6px; }
  label { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
  input, select {
    text-transform: none; letter-spacing: 0; font-size: 13px; color: var(--text-main);
    background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 6px;
  }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .ex-head, .ex-list button { text-transform: none; letter-spacing: 0; }
  .ex-head { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: var(--text-main); }
  .ex-head button, .ex-list button {
    background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px;
  }
  .ex-head button { color: var(--accent-primary); }
  .ex-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .ex-list li { display: flex; align-items: center; gap: 2px; border-radius: 4px; }
  .ex-list li.active { background: rgba(94, 106, 210, 0.15); }
  .ex-name { flex: 1; text-align: left; padding: 3px 4px; color: var(--text-main); }
  .editor { flex: 1; min-height: 280px; }
</style>
