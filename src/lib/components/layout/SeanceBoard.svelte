<script lang="ts">
  import { browser } from '$app/environment';
  import { pages } from '$lib/stores/workspace';
  import { exercisePaths, navArea, seanceHeader, seasonSelection, showExercise, reorderExercises, saveSeasonExercises } from '$lib/workspace/state';
  import { exerciseHtml } from '$lib/workspace/markdownHtml';
  import { RowDrag } from '$lib/utils/rowDrag.svelte';
  import { matches } from '$lib/utils/search';
  import { Alert, Button, ButtonGroup, Card, Heading, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell } from 'flowbite-svelte';
  import { BarsOutline } from 'flowbite-svelte-icons';
  import AddExerciseButton from './AddExerciseButton.svelte';
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

  function cancelPick() {
    editingPick = false;
    draft = [];
    pickError = '';
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

  async function savePick() {
    pickError = '';
    const known = new Set($pages.map(page => page.id));
    const error = await saveSeasonExercises(draft.filter(id => known.has(id)));
    if (error) {
      pickError = error;
      return;
    }
    editingPick = false;
  }

  function showView(next: View) {
    view = next;
    if (next !== 'table') cancelPick();
    try { sessionStorage.setItem(VIEW_KEY, next); } catch { /* quota */ }
  }

  function schemaAt(id: string): string {
    return $exercisePaths[id] || '';
  }
</script>

<div class="space-y-4">
  <SessionText {editable} />

  <div class="flex items-center justify-between gap-3">
    <Heading tag="h2" class="text-xl">Exercices</Heading>
    <div class="flex items-center gap-3">
      {#if planning && view === 'table'}
        {#if editingPick}
          <Button size="sm" color="brand" onclick={() => { void savePick(); }}>Sauver</Button>
          <Button size="sm" color="alternative" onclick={cancelPick}>Annuler</Button>
        {:else}
          <Button size="sm" color="brand" onclick={startPick}>Éditer</Button>
        {/if}
      {/if}
      <ButtonGroup size="sm" aria-label="Affichage des exercices">
        <Button size="sm" color={view === 'table' ? 'brand' : 'alternative'} onclick={() => showView('table')}>Tableau</Button>
        <Button size="sm" color={view === 'sheets' ? 'brand' : 'alternative'} onclick={() => showView('sheets')}>Fiches</Button>
      </ButtonGroup>
    </div>
  </div>

  {#snippet addExercise()}<AddExerciseButton />{/snippet}
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
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={COLUMNS.length + (editingPick ? 4 : 3)}>{query.trim() ? 'Aucun résultat' : planning ? 'Aucun exercice retenu' : 'Aucun exercice'}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else}
    {#each listed as page (page.id)}
      <Card size="xl" class="p-6">
        {#if editingPick}<div class="mb-3">{@render pickBox(page.id, page.name)}</div>{/if}
        {#if !planning}
          <div class="mb-3 flex justify-end">
            <Button size="sm" color="brand" onclick={() => { void showExercise(page.id); }}>Modifier</Button>
          </div>
        {/if}
        <div class="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
          <div class="exercise-frame flex min-h-0 flex-col overflow-hidden lg:h-0 lg:min-h-full">
            <div class="exercise-md min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
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

<style>
  .pick { accent-color: var(--color-brand); }
</style>
