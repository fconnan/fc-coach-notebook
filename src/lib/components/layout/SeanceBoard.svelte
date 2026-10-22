<script lang="ts">
  import { browser } from '$app/environment';
  import { pages } from '$lib/stores/workspace';
  import { exercisePaths, seanceHeader, showExercise, reorderExercises } from '$lib/workspace/state';
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
  const drag = new RowDrag();
  const exerciseIds = $derived($pages.map(page => page.id));
  const visiblePages = $derived($pages.filter(page => matches(query, page.name, ...COLUMNS.map(([, key]) => page.drill?.[key]))));
  const editable = $derived(view === 'table');

  $effect(() => {
    void $seanceHeader.id;
    query = '';
  });

  function showView(next: View) {
    view = next;
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
    <ButtonGroup size="sm" aria-label="Affichage des exercices">
      <Button size="sm" color={view === 'table' ? 'brand' : 'alternative'} onclick={() => showView('table')}>Tableau</Button>
      <Button size="sm" color={view === 'sheets' ? 'brand' : 'alternative'} onclick={() => showView('sheets')}>Fiches</Button>
    </ButtonGroup>
  </div>

  {#snippet addExercise()}<AddExerciseButton />{/snippet}

  {#if view === 'table'}
    <Card size="xl" class="p-6">
      {#if drag.error}<Alert color="red" class="mb-3">{drag.error}</Alert>{/if}
      <SearchTable bind:query placeholder="Rechercher un exercice" actions={addExercise}>
        <TableHead>
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
              class={drag.rowClass(exerciseIds, page.id)}
              draggable="true"
              ondragstart={(e: DragEvent) => drag.start(e, page.id)}
              ondragover={(e: DragEvent) => drag.over(e, page.id)}
              ondrop={(e: DragEvent) => drag.drop(e, exerciseIds, page.id, reorderExercises)}
              ondragend={drag.end}
              onclick={() => showExercise(page.id)}
            >
              <TableBodyCell class={cell}>
                <span class="inline-flex cursor-grab items-center gap-2"><BarsOutline class="h-4 w-4 text-gray-400" />{exerciseIds.indexOf(page.id) + 1}</span>
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
            <TableBodyRow><TableBodyCell colspan={COLUMNS.length + 3}>{query.trim() ? 'Aucun résultat' : 'Aucun exercice'}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else}
    {#each $pages as page (page.id)}
      <Card size="xl" class="p-6">
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
      <Card size="xl" class="p-6">Aucun exercice</Card>
    {/each}
  {/if}
</div>

<style>
  .exercise-frame {
    border: 1px solid var(--color-default-medium);
    border-radius: 0;
  }
  .exercise-md {
    padding: 0.9rem 1rem;
    font-size: 0.925rem;
    line-height: 1.45;
  }
  .exercise-md :global(h1) { margin: 0 0 0.75rem; font-size: 1.05rem; font-weight: 650; }
  .exercise-md :global(h2) { margin: 0.9rem 0 0.3rem; font-size: 0.95rem; font-weight: 650; }
  .exercise-md :global(h3) { margin: 0.75rem 0 0.25rem; font-size: 0.9rem; font-weight: 650; }
  .exercise-md :global(p) { margin: 0.35rem 0; }
  .exercise-md :global(ul) { margin: 0.25rem 0 0.6rem; padding-left: 1.15rem; list-style: disc; }
  .exercise-md :global(li) { margin: 0.12rem 0; }
</style>
