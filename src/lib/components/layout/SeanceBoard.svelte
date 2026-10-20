<script lang="ts">
  import { pages, renameExercise, updateExerciseDrill, setExerciseMarkdown } from '$lib/stores/workspace';
  import { categoryInfo, seanceHeader, trainer, patchHeader, showExercise, createExercise } from '$lib/workspace/state';
  import { AREAS, KINDS, KNOWN, METHODS, PHASES, consignesCell, splitMarkdown, trainerLabel, writeSection, type SectionKey } from '$lib/workspace/model';

  const sheets = Array.from({ length: 80 }, (_, i) => `S${i + 1}`);
  let adding = $state(false);
  let entryName = $state('');
  let plainName = $state('');
  let addError = $state('');

  function openAdd() {
    adding = true;
    entryName = '';
    plainName = '';
    addError = '';
  }

  async function confirmAdd() {
    addError = (await createExercise(entryName, plainName)) || '';
    if (!addError) adding = false;
  }

  function sectionValue(markdown: string, key: SectionKey): string {
    if (key === 'consignes') return consignesCell(markdown);
    return splitMarkdown(markdown).sections[key] || '';
  }

  function setSection(id: string, markdown: string, key: SectionKey, value: string) {
    setExerciseMarkdown(id, writeSection(markdown, key, value));
  }
</script>

<div class="board">
  <h1>{$seanceHeader.name || 'Séance'}</h1>
  <div class="header">
    <label>Phase
      <input list="board-phases" value={$seanceHeader.phase} oninput={(e) => patchHeader({ phase: e.currentTarget.value })} />
    </label>
    <label>Principe
      <input value={$seanceHeader.principle} oninput={(e) => patchHeader({ principle: e.currentTarget.value })} />
    </label>
    <label>Moyens
      <input value={$seanceHeader.means} oninput={(e) => patchHeader({ means: e.currentTarget.value })} />
    </label>
    <label>Nom
      <input value={trainerLabel($trainer)} readonly />
    </label>
    <label>Date
      <input value={$seanceHeader.date} oninput={(e) => patchHeader({ date: e.currentTarget.value })} />
    </label>
    <label>Catégorie
      <input value={$categoryInfo?.name || ''} readonly />
    </label>
    <label>Feuille
      <select value={$seanceHeader.sheet} onchange={(e) => patchHeader({ sheet: e.currentTarget.value })}>
        {#each sheets as sheet}<option value={sheet}>{sheet}</option>{/each}
      </select>
    </label>
    <label>Nom de la séance
      <input value={$seanceHeader.name} oninput={(e) => patchHeader({ name: e.currentTarget.value })} />
    </label>
  </div>
  <datalist id="board-phases">{#each PHASES as item}<option value={item}></option>{/each}</datalist>

  <div class="ex-head">
    <h2>Exercices</h2>
    <button type="button" onclick={openAdd}>Ajouter</button>
  </div>

  {#each $pages as page, index (page.id)}
    <article>
      <header>
        <span>{index + 1}</span>
        <input value={page.name} oninput={(e) => renameExercise(page.id, e.currentTarget.value)} />
        <button type="button" onclick={() => showExercise(page.id)}>Schéma</button>
      </header>
      <div class="grid">
        <label>Procédé
          <input list="board-kinds" value={page.drill?.kind || ''} oninput={(e) => updateExerciseDrill(page.id, { kind: e.currentTarget.value })} />
        </label>
        <label>Méthode
          <input list="board-methods" value={page.drill?.method || ''} oninput={(e) => updateExerciseDrill(page.id, { method: e.currentTarget.value })} />
        </label>
        <label>Durée
          <input value={page.drill?.duration || ''} oninput={(e) => updateExerciseDrill(page.id, { duration: e.currentTarget.value })} />
        </label>
        <label>Aire
          <input list="board-areas" value={page.drill?.area || ''} oninput={(e) => updateExerciseDrill(page.id, { area: e.currentTarget.value })} />
        </label>
        <label>Effectif
          <input value={page.drill?.headcount || ''} oninput={(e) => updateExerciseDrill(page.id, { headcount: e.currentTarget.value })} />
        </label>
        <label>Matériels
          <input value={page.drill?.equipment || ''} oninput={(e) => updateExerciseDrill(page.id, { equipment: e.currentTarget.value })} />
        </label>
      </div>
      {#each KNOWN as section}
        <label class="block">{section.title}
          <textarea
            rows="3"
            value={sectionValue(page.markdownContent || '', section.key)}
            oninput={(e) => setSection(page.id, page.markdownContent || '', section.key, e.currentTarget.value)}
          ></textarea>
        </label>
      {/each}
    </article>
  {/each}
  <datalist id="board-kinds">{#each KINDS as item}<option value={item}></option>{/each}</datalist>
  <datalist id="board-methods">{#each METHODS as item}<option value={item}></option>{/each}</datalist>
  <datalist id="board-areas">{#each AREAS as item}<option value={item}></option>{/each}</datalist>
</div>

{#if adding}
  <div class="overlay">
    <form class="dialog" aria-labelledby="exercise-title" onsubmit={(e) => { e.preventDefault(); void confirmAdd(); }}>
      <h2 id="exercise-title">Nouvel exercice</h2>
      <label>Répertoire
        <input bind:value={entryName} />
      </label>
      <label>Nom
        <input bind:value={plainName} />
      </label>
      {#if addError}<p class="error">{addError}</p>{/if}
      <div class="dialog-actions">
        <button type="button" class="quiet" onclick={() => adding = false}>Annuler</button>
        <button type="submit">OK</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .board { display: flex; flex-direction: column; gap: 16px; color: #0f172a; }
  h1, h2 { margin: 0; }
  h1 { font-size: 20px; font-weight: 600; }
  h2 { font-size: 15px; font-weight: 600; }
  .header, .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .header {
    border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; padding: 16px;
  }
  .ex-head { display: flex; justify-content: space-between; align-items: center; }
  article {
    border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px;
    display: flex; flex-direction: column; gap: 8px; background: #fff;
  }
  header { display: flex; gap: 8px; align-items: center; }
  header span { font-weight: 700; color: #64748b; }
  header input { flex: 1; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; }
  input, select, textarea {
    font: inherit; font-size: 14px; color: #0f172a;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px;
  }
  textarea { resize: vertical; }
  button {
    border: none; background: #2563eb; color: #fff; border-radius: 8px;
    padding: 6px 12px; cursor: pointer; font-size: 14px; font-weight: 500; letter-spacing: 0;
  }
  button:hover { background: #1d4ed8; }
  .quiet { border: 1px solid #d4d4d4; background: #fff; color: #374151; }
  .quiet:hover { background: #f8fafc; }
  .overlay { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.35); }
  .dialog { display: flex; flex-direction: column; gap: 12px; width: min(24rem, calc(100% - 32px)); padding: 16px; border-radius: 16px; background: #fff; border: 1px solid #e2e8f0; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .error { margin: 0; font-size: 13px; color: #b91c1c; }
  input[readonly] { color: #64748b; background: #f8fafc; }
</style>
