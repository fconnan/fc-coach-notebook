<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { confirmLeaveEditors, registerEditorGate, type EditorGate } from '$lib/workspace/editorLeave';
  import { pages } from '$lib/stores/workspace';
  import { deleteExercise, exercisePaths, navArea, seanceHeader, seasons, seasonSelection, showExercise, reorderExercises, saveSeasonExercises } from '$lib/workspace/state';
  import { exerciseHtml } from '$lib/workspace/markdownHtml';
  import { RowDrag } from '$lib/utils/rowDrag.svelte';
  import { matches } from '$lib/utils/search';
  import { Alert, Button, ButtonGroup, Card, Heading, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell } from 'flowbite-svelte';
  import { BarsOutline, PenOutline } from 'flowbite-svelte-icons';
  import AddExerciseButton from './AddExerciseButton.svelte';
  import ConfirmDelete, { plural, type DeleteRequest } from './ConfirmDelete.svelte';
  import RowActions from './RowActions.svelte';
  import QuietIconButton from './QuietIconButton.svelte';
  import SchemaPreview from './SchemaPreview.svelte';
  import SearchTable from './SearchTable.svelte';
  import SessionText from './SessionText.svelte';

  type View = 'table' | 'sheets';
  const VIEW_KEY = 'fctactics_session_view';
  const COLUMNS = [
    ['Procédé', 'kind'],
    ['Méthode', 'method'],
    ['Durée', 'duration'],
    ['Aire', 'area'],
    ['Effectif', 'headcount'],
    ['Matériels', 'equipment']
  ] as const;
  const cell = 'px-3 py-3 whitespace-normal';

  let view = $state<View>(browser && sessionStorage.getItem(VIEW_KEY) === 'sheets' ? 'sheets' : 'table');
  let query = $state('');
  let editingPick = $state(false);
  let draft = $state<string[]>([]);
  let pickError = $state('');
  const drag = new RowDrag();
  const planning = $derived($navArea === 'seasons');
  const exerciseIds = $derived($pages.map(page => page.id));
  const seasonOrder = $derived($seasonSelection ?? []);
  const listed = $derived.by(() => {
    if (!planning || editingPick) return $pages;
    const byId = new Map($pages.map(page => [page.id, page]));
    return seasonOrder.flatMap(id => {
      const page = byId.get(id);
      return page ? [page] : [];
    });
  });
  const visiblePages = $derived(listed.filter(page => matches(query, page.name, ...COLUMNS.map(([, key]) => page.drill?.[key]))));
  const editable = $derived(!planning && view === 'table');
  const orderIds = $derived(planning && !editingPick ? seasonOrder : exerciseIds);
  const canReorder = $derived(view === 'table' && !editingPick);

  $effect(() => {
    void $seanceHeader.id;
    void $navArea;
    query = '';
    editingPick = false;
    draft = [];
    pickError = '';
  });

  function startPick() {
    draft = [...($seasonSelection ?? [])];
    pickError = '';
    editingPick = true;
  }

  function pickDirty(): boolean {
    if (!editingPick) return false;
    return draft.join('\0') !== ($seasonSelection ?? []).join('\0');
  }

  function revertPick() {
    editingPick = false;
    draft = [];
    pickError = '';
  }

  const pickGate: EditorGate = {
    dirty: pickDirty,
    save: () => savePick(),
    discard: revertPick
  };

  async function cancelPick(): Promise<boolean> {
    if (!(await confirmLeaveEditors(pickGate))) return false;
    revertPick();
    return true;
  }

  function togglePick(id: string) {
    draft = draft.includes(id) ? draft.filter(item => item !== id) : [...draft, id];
  }

  async function reorderSeason(ids: string[]): Promise<string | null> {
    const previous = $seasonSelection;
    seasonSelection.set(ids);
    const error = await saveSeasonExercises(ids);
    if (error) seasonSelection.set(previous);
    return error;
  }

  async function savePick(): Promise<boolean> {
    pickError = '';
    const known = new Set($pages.map(page => page.id));
    const error = await saveSeasonExercises(draft.filter(id => known.has(id)));
    if (error) {
      pickError = error;
      return false;
    }
    editingPick = false;
    return true;
  }

  async function showView(next: View) {
    if (next !== 'table' && !(await cancelPick())) return;
    view = next;
    try { sessionStorage.setItem(VIEW_KEY, next); } catch { /* quota */ }
  }

  onMount(() => registerEditorGate(pickGate));

  function schemaAt(id: string): string {
    return $exercisePaths[id] || '';
  }

  let deleteRequest = $state<DeleteRequest | null>(null);

  function askDeleteExercise(id: string, name: string) {
    const planned = $seasons.reduce((sum, season) => sum + season.slots.filter(slot => slot.session === $seanceHeader.id && slot.exercises?.includes(id)).length, 0);
    deleteRequest = {
      title: 'Supprimer l’exercice',
      subject: 'L’exercice',
      name,
      deleted: 'supprimé',
      items: ['sa fiche et son schéma'],
      note: planned ? `Il sera retiré de ${plural(planned, 'séance planifiée', 'séances planifiées')}.` : '',
      run: () => deleteExercise(id)
    };
  }
</script>

{#snippet addExercise()}
  <AddExerciseButton />
{/snippet}

<div class="space-y-4">
  <SessionText {editable} />

  <div class="flex items-center justify-between gap-3">
    <div class="inline-flex items-center gap-1">
      <Heading tag="h2" class="text-xl">Exercices</Heading>
      {#if !planning && view === 'sheets'}
        <AddExerciseButton />
      {:else if planning && view === 'table' && !editingPick}
        <QuietIconButton label="Éditer" onclick={startPick}><PenOutline size="sm" /></QuietIconButton>
      {/if}
    </div>
    <div class="flex items-center gap-3">
      {#if planning && view === 'table' && editingPick}
        <Button size="sm" color="brand" onclick={() => { void savePick(); }}>Sauver</Button>
        <Button size="sm" color="alternative" onclick={() => { void cancelPick(); }}>Annuler</Button>
      {/if}
      <ButtonGroup size="sm" aria-label="Affichage des exercices">
        <Button size="sm" color={view === 'table' ? 'brand' : 'alternative'} onclick={() => { void showView('table'); }}>Tableau</Button>
        <Button size="sm" color={view === 'sheets' ? 'brand' : 'alternative'} onclick={() => { void showView('sheets'); }}>Fiches</Button>
      </ButtonGroup>
    </div>
  </div>

  {#snippet pickBox(id: string, name: string)}
    <input
      type="checkbox"
      class="pick size-4"
      checked={draft.includes(id)}
      aria-label={`Retenir ${name}`}
      onclick={(event) => event.stopPropagation()}
      onchange={() => togglePick(id)}
    />
  {/snippet}

  {#if view === 'table'}
    <Card size="xl" class="p-6">
      {#if drag.error}<Alert color="red" class="mb-3">{drag.error}</Alert>{/if}
      {#if pickError}<Alert color="red" class="mb-3">{pickError}</Alert>{/if}
      <SearchTable bind:query placeholder="Rechercher un exercice" actions={planning ? undefined : addExercise}>
        <TableHead>
          {#if editingPick}<TableHeadCell class="w-12 px-3"></TableHeadCell>{/if}
          <TableHeadCell class="w-20 px-3">Ordre</TableHeadCell>
          <TableHeadCell class="px-3">Nom</TableHeadCell>
          {#each COLUMNS as [label] (label)}
            <TableHeadCell class="px-3">{label}</TableHeadCell>
          {/each}
          <TableHeadCell class="w-48 px-3">Schéma</TableHeadCell>
          {#if editable}<TableHeadCell class="w-px px-3"><span class="sr-only">Actions</span></TableHeadCell>{/if}
        </TableHead>
        <TableBody>
          {#each visiblePages as page (page.id)}
            <TableBodyRow
              class={canReorder ? drag.rowClass(orderIds, page.id) : ''}
              draggable={canReorder ? 'true' : 'false'}
              ondragstart={(e: DragEvent) => { if (canReorder) drag.start(e, page.id); }}
              ondragover={(e: DragEvent) => { if (canReorder) drag.over(e, page.id); }}
              ondrop={(e: DragEvent) => { if (canReorder) void drag.drop(e, orderIds, page.id, planning ? reorderSeason : reorderExercises); }}
              ondragend={drag.end}
              onclick={() => { if (!planning) void showExercise(page.id); }}
            >
              {#if editingPick}<TableBodyCell class={cell}>{@render pickBox(page.id, page.name)}</TableBodyCell>{/if}
              <TableBodyCell class={cell}>
                {#if canReorder}
                  <span class="inline-flex cursor-grab items-center gap-2"><BarsOutline class="h-4 w-4 text-gray-400" />{orderIds.indexOf(page.id) + 1}</span>
                {:else}
                  {orderIds.indexOf(page.id) + 1}
                {/if}
              </TableBodyCell>
              <TableBodyCell class={cell}>{page.name}</TableBodyCell>
              {#each COLUMNS as [label, key] (label)}
                <TableBodyCell class="{cell} font-normal {key === 'duration' ? 'whitespace-nowrap' : ''}">{page.drill?.[key] || ''}</TableBodyCell>
              {/each}
              <TableBodyCell class="w-48 px-3 py-2">
                <div class="w-44"><SchemaPreview at={schemaAt(page.id)} exerciseId={page.id} compact /></div>
              </TableBodyCell>
              {#if editable}<TableBodyCell class="px-3 py-0"><RowActions ondelete={() => askDeleteExercise(page.id, page.name)} /></TableBodyCell>{/if}
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={COLUMNS.length + (editingPick ? 4 : 3) + (editable ? 1 : 0)}>{query.trim() ? 'Aucun résultat' : planning ? 'Aucun exercice retenu' : 'Aucun exercice'}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else}
    {#each listed as page (page.id)}
      <Card size="xl" class="p-6">
        {#if editingPick}<div class="mb-3">{@render pickBox(page.id, page.name)}</div>{/if}
        <div class="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
          <div class="exercise-frame flex min-h-0 flex-col overflow-hidden lg:h-0 lg:min-h-full">
            {#if !planning}
              <div class="mb-3 flex items-center gap-1">
                <h3 class="text-[1.05rem] font-semibold">{page.name}</h3>
                <QuietIconButton label="Modifier" onclick={() => { void showExercise(page.id); }}><PenOutline size="sm" /></QuietIconButton>
              </div>
            {/if}
            <div class="exercise-md min-h-0 flex-1 overflow-x-hidden overflow-y-auto" class:hide-title={!planning}>
              {@html exerciseHtml(page)}
            </div>
          </div>
          <SchemaPreview at={schemaAt(page.id)} exerciseId={page.id} />
        </div>
      </Card>
    {:else}
      <Card size="xl" class="p-6">{planning && !editingPick ? 'Aucun exercice retenu' : 'Aucun exercice'}</Card>
    {/each}
  {/if}
</div>

<ConfirmDelete bind:request={deleteRequest} />

<style>
  .pick { accent-color: var(--color-brand); }
  .hide-title :global(h1) { display: none; }
</style>
