<script lang="ts">
  import SeanceBoard from './SeanceBoard.svelte';
  import ExerciseEditor from './ExerciseEditor.svelte';
  import { RowDrag } from '$lib/utils/rowDrag.svelte';
  import { matches } from '$lib/utils/search';
  import SearchTable from './SearchTable.svelte';
  import { currentPage } from '$lib/stores/workspace';
  import {
    trainer, categories, styles, seasons, themes, libraryItems, screen, portraitUrl,
    exercisePaths,
    navDoor, navArea, navItem, navChild, missingPage,
    showHome, createCategory, commitTrainerName, commitTrainerSport, savePortrait, openDoor, openArea, openNavItem, openNavChild, createSeance,
    createStyle, updateStyle, createSeason, createSlot, createTheme, createThemeSession, createLibraryItem,
    reorderThemes, reorderThemeSessions
  } from '$lib/workspace/state';
  import { BarsOutline } from 'flowbite-svelte-icons';
  import { LIBRARY_KINDS, WORKSPACE_DOORS, type LibraryKind, type WorkspaceArea, type WorkspaceDoor } from '$lib/workspace/catalog';
  import seancesArt from '$lib/assets/door-seances.jpg';
  import seasonArt from '$lib/assets/door-season.jpg';
  import atelierArt from '$lib/assets/door-atelier.jpg';
  import { DEFAULT_SPORT, type PageStyle } from '$lib/workspace/model';
  import {
    Alert, Avatar, Button, Card, Heading, Input, Label, Modal, Select,
    TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell
  } from 'flowbite-svelte';

  let dialog = $state<'category' | 'style' | 'seance' | 'season' | 'slot' | 'theme' | 'session' | 'library' | null>(null);
  let entryOpen = $state(false);
  let entryName = $state('');
  let plainName = $state('');
  let zone = $state('');
  let from = $state('');
  let to = $state('');
  let categoryId = $state('');
  let sessionId = $state('');
  let dialogError = $state('');
  let portraitError = $state('');
  let query = $state('');
  const drag = new RowDrag();

  const openedStyle = $derived($styles.find(style => style.id === $navItem) ?? null);
  const openedSeason = $derived($seasons.find(season => season.id === $navItem) ?? null);
  const openedTheme = $derived($themes.find(theme => theme.id === $navItem) ?? null);
  const domains = $derived([...new Set($libraryItems.map(item => item.domain))].sort((a, b) => a.localeCompare(b, 'fr')));
  const files = $derived($libraryItems.filter(item => item.domain === $navItem && item.kind === $navChild));
  const sessionChoices = $derived($themes.flatMap(theme => theme.sessions.map(session => ({
    id: session.id,
    label: `${theme.name} — ${session.name || session.folder}`
  }))));
  const showingBoard = $derived($screen === 'seance' && ($navArea === 'themes' || $navArea === 'seasons') && Boolean($navChild));
  const visibleSeasons = $derived($seasons.filter(season => matches(query, season.name, season.zone, season.from, season.to, season.categoryName)));
  const visibleSlots = $derived(openedSeason?.slots.filter(slot => matches(query, slot.sheet, slot.date, slot.sessionName)) ?? []);
  const visibleThemes = $derived($themes.filter(theme => matches(query, theme.name)));
  const visibleSessions = $derived(openedTheme?.sessions.filter(session => matches(query, session.name, session.audience, session.phase)) ?? []);
  const visibleStyles = $derived($styles.filter(style => matches(query, style.name)));
  const visibleDomains = $derived(domains.filter(domain => matches(query, domain)));
  const visibleKinds = $derived(LIBRARY_KINDS.filter(kind => matches(query, kind.label)));
  const visibleFiles = $derived(files.filter(item => matches(query, item.name)));
  const themeIds = $derived($themes.map(theme => theme.id));
  const sessionIds = $derived(openedTheme?.sessions.map(session => session.id) ?? []);
  const editingExercise = $derived($screen === 'exercise' && Boolean($currentPage));

  function schemaAt(id: string): string {
    return $exercisePaths[id] || '';
  }
  const door = $derived(WORKSPACE_DOORS.find(item => item.id === $navDoor) ?? null);
  const sports = [{ value: DEFAULT_SPORT, name: 'Soccer' }];
  const dialogTitle = $derived(dialog === 'category' ? 'Nouvelle catégorie'
    : dialog === 'seance' || dialog === 'session' ? 'Nouvelle séance'
    : dialog === 'style' ? 'Nouveau style'
    : dialog === 'season' ? 'Nouvelle saison'
    : dialog === 'slot' ? 'Nouveau créneau'
    : dialog === 'theme' ? 'Nouveau thème'
    : 'Nouveau fichier');

  const doorArt: Record<WorkspaceDoor, string> = {
    repertoire: seancesArt,
    season: seasonArt,
    studio: atelierArt
  };

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(part => part[0]?.toLocaleUpperCase('fr') || '').join('');
  }

  function closeDialog() {
    dialog = null;
    entryOpen = false;
  }

  function openDialog(kind: NonNullable<typeof dialog>) {
    dialog = kind;
    entryName = '';
    plainName = '';
    zone = '';
    from = '';
    to = '';
    categoryId = $categories[0]?.id ?? '';
    sessionId = sessionChoices[0]?.id ?? '';
    dialogError = '';
    entryOpen = true;
  }

  function fieldValue(event: Event): string {
    const target = event.currentTarget;
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      ? target.value
      : '';
  }

  async function onPortrait(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    portraitError = (await savePortrait(file)) || '';
  }

  async function confirmDialog() {
    if (dialog === 'category') {
      const id = entryName.trim();
      dialogError = (await createCategory(entryName, plainName)) || '';
      if (dialogError) return;
      closeDialog();
      await openNavItem(id);
      return;
    }
    if (dialog === 'seance') {
      dialogError = (await createSeance(entryName, plainName)) || '';
      if (!dialogError) closeDialog();
      return;
    }
    if (dialog === 'style') {
      const id = entryName.trim();
      dialogError = (await createStyle(entryName, plainName)) || '';
      if (dialogError) return;
      closeDialog();
      await openNavItem(id);
      return;
    }
    if (dialog === 'season') {
      dialogError = (await createSeason(entryName, categoryId, zone, from, to)) || '';
      if (!dialogError) closeDialog();
      return;
    }
    if (dialog === 'slot') {
      dialogError = (await createSlot(entryName, plainName, sessionId)) || '';
      if (!dialogError) closeDialog();
      return;
    }
    if (dialog === 'theme') {
      const id = entryName.trim();
      dialogError = (await createTheme(entryName, plainName)) || '';
      if (dialogError) return;
      closeDialog();
      await openNavItem(id);
      return;
    }
    if (dialog === 'session') {
      dialogError = (await createThemeSession(entryName, plainName)) || '';
      if (!dialogError) closeDialog();
      return;
    }
    dialogError = (await createLibraryItem(entryName)) || '';
    if (!dialogError) closeDialog();
  }

  $effect(() => {
    if (!entryOpen) dialog = null;
  });

  $effect(() => {
    void $navItem;
    drag.error = '';
  });

  $effect(() => {
    void [$navArea, $navItem, $navChild];
    query = '';
  });

  function emptyText(none: string): string {
    return query.trim() ? 'Aucun résultat' : none;
  }

  function kindCount(domain: string, kind: LibraryKind) {
    return $libraryItems.filter(item => item.domain === domain && item.kind === kind).length;
  }
</script>

{#snippet orderAlert()}
  {#if drag.error}<Alert color="red" class="mb-3">{drag.error}</Alert>{/if}
{/snippet}

{#snippet panelTitle(title: string)}
  <Heading tag="h2" class="mb-3 text-xl">{title}</Heading>
{/snippet}

<div class={editingExercise ? 'flex h-full min-h-0 flex-col' : ''}>
  {#if $missingPage}
    {@render panelTitle('Page introuvable')}
    <Card size="xl" class="p-6">
      <p class="font-medium text-heading">{$missingPage}</p>
      <p class="mt-2 text-sm text-body">Elle a peut-être été supprimée ou déplacée. Le lien ou le favori utilisé n’est plus valable.</p>
      <div class="mt-4">
        <Button color="brand" onclick={() => showHome()}>Aller à l’accueil</Button>
      </div>
    </Card>
  {:else if $screen === 'exercise' && $currentPage}
    {#key `${schemaAt($currentPage.id)}/${$currentPage.id}`}
      <div class="min-h-0 flex-1">
        <ExerciseEditor at={schemaAt($currentPage.id)} exerciseId={$currentPage.id} />
      </div>
    {/key}
  {:else if showingBoard}
    <SeanceBoard />
  {:else if !$navDoor}
    <div class="mb-6 grid items-start gap-3 sm:grid-cols-3">
      {#each WORKSPACE_DOORS as item (item.id)}
        <div class="min-w-0">
          {@render panelTitle(item.label)}
          <Card size="xl" class="aspect-square cursor-pointer overflow-hidden p-0" onclick={() => openDoor(item.id)}>
            <img src={doorArt[item.id]} alt="" class="h-0 min-h-0 w-full flex-1 object-cover" />
            <div class="px-5 pt-3 pb-4">
              <p class="text-sm text-gray-500 dark:text-gray-400">{item.line}</p>
            </div>
          </Card>
        </div>
      {/each}
    </div>
    {@render panelTitle('Entraîneur')}
    <Card size="xl" class="p-6">
      <div class="flex items-center gap-8">
        <div class="grid w-full max-w-sm gap-4">
          <Label>Nom
            <Input class="mt-1" value={$trainer.name} oninput={(e) => commitTrainerName(fieldValue(e))} />
          </Label>
          <Label>Sport
            <Select class="mt-1" placeholder="" items={sports} value={$trainer.sport || DEFAULT_SPORT} onchange={(e) => commitTrainerSport(fieldValue(e))} />
          </Label>
        </div>
        <label class="ms-auto shrink-0 cursor-pointer">
          {#if $portraitUrl}
            <Avatar src={$portraitUrl} cornerStyle="rounded" size="xl" class="h-44 w-44 rounded-2xl object-cover" alt={$trainer.name || 'Photo'} />
          {:else}
            <Avatar cornerStyle="rounded" size="xl" class="h-44 w-44 overflow-hidden rounded-2xl text-3xl" alt={$trainer.name || 'Photo'}>{initials($trainer.name) || '?'}</Avatar>
          {/if}
          <input class="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={onPortrait} />
          {#if portraitError}<p class="mt-2 max-w-44 text-center text-xs text-red-600">{portraitError}</p>{/if}
        </label>
      </div>
    </Card>
  {:else if !$navArea}
    <div class="flex flex-wrap gap-2">
      {#each door?.children || [] as child (child.id)}
        <Button color="alternative" onclick={() => openArea(child.id)}>{child.label}</Button>
      {/each}
    </div>
  {:else if $navArea === 'seasons' && !openedSeason}
    {@render panelTitle('Saisons')}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher une saison" onadd={() => openDialog('season')}>
        <TableHead>
          <TableHeadCell>Nom</TableHeadCell>
          <TableHeadCell>Zone</TableHeadCell>
          <TableHeadCell>Du</TableHeadCell>
          <TableHeadCell>Au</TableHeadCell>
          <TableHeadCell>Catégorie</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each visibleSeasons as season (season.id)}
            <TableBodyRow class="cursor-pointer" onclick={() => openNavItem(season.id)}>
              <TableBodyCell>{season.name}</TableBodyCell>
              <TableBodyCell>{season.zone}</TableBodyCell>
              <TableBodyCell>{season.from}</TableBodyCell>
              <TableBodyCell>{season.to}</TableBodyCell>
              <TableBodyCell>{season.categoryName}</TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={5}>{emptyText('Aucune saison')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else if openedSeason}
    {@render panelTitle(openedSeason.name)}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher un créneau" onadd={() => openDialog('slot')}>
        <TableHead>
          <TableHeadCell>Fiche</TableHeadCell>
          <TableHeadCell>Date</TableHeadCell>
          <TableHeadCell>Séance</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each visibleSlots as slot (`${slot.sheet}-${slot.session}`)}
            <TableBodyRow class="cursor-pointer" onclick={() => openNavChild(slot.session)}>
              <TableBodyCell>{slot.sheet}</TableBodyCell>
              <TableBodyCell>{slot.date}</TableBodyCell>
              <TableBodyCell>{slot.sessionName}</TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={3}>{emptyText('Aucun créneau')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else if $navArea === 'themes' && !openedTheme}
    <Heading tag="h1" class="mb-3 text-xl">Thèmes de séances</Heading>
    <Card size="xl" class="p-6">
    {@render orderAlert()}
    <SearchTable bind:query placeholder="Rechercher un thème" addLabel="Ajouter un thème" onadd={() => openDialog('theme')}>
      <TableHead>
        <TableHeadCell class="w-24">Ordre</TableHeadCell>
        <TableHeadCell>Nom</TableHeadCell>
      </TableHead>
      <TableBody>
        {#each visibleThemes as theme (theme.id)}
          <TableBodyRow
            class={drag.rowClass(themeIds, theme.id)}
            draggable="true"
            ondragstart={(e: DragEvent) => drag.start(e, theme.id)}
            ondragover={(e: DragEvent) => drag.over(e, theme.id)}
            ondrop={(e: DragEvent) => drag.drop(e, themeIds, theme.id, reorderThemes)}
            ondragend={drag.end}
            onclick={() => openNavItem(theme.id)}
          >
            <TableBodyCell>
              <span class="inline-flex cursor-grab items-center gap-2"><BarsOutline class="h-4 w-4 text-gray-400" />{themeIds.indexOf(theme.id) + 1}</span>
            </TableBodyCell>
            <TableBodyCell>{theme.name}</TableBodyCell>
          </TableBodyRow>
        {:else}
          <TableBodyRow><TableBodyCell colspan={2}>{emptyText('Aucun thème')}</TableBodyCell></TableBodyRow>
        {/each}
      </TableBody>
    </SearchTable>
    </Card>
  {:else if openedTheme}
    {@render panelTitle(openedTheme.name)}
    <Card size="xl" class="p-6">
      {@render orderAlert()}
      <SearchTable bind:query placeholder="Rechercher une séance" onadd={() => openDialog('session')}>
        <TableHead>
          <TableHeadCell class="w-24">Ordre</TableHeadCell>
          <TableHeadCell>Nom</TableHeadCell>
          <TableHeadCell>Public</TableHeadCell>
          <TableHeadCell>Phase</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each visibleSessions as session (session.id)}
            <TableBodyRow
              class={drag.rowClass(sessionIds, session.id)}
              draggable="true"
              ondragstart={(e: DragEvent) => drag.start(e, session.id)}
              ondragover={(e: DragEvent) => drag.over(e, session.id)}
              ondrop={(e: DragEvent) => drag.drop(e, sessionIds, session.id, ids => reorderThemeSessions(openedTheme.id, ids))}
              ondragend={drag.end}
              onclick={() => openNavChild(session.id)}
            >
              <TableBodyCell>
                <span class="inline-flex cursor-grab items-center gap-2"><BarsOutline class="h-4 w-4 text-gray-400" />{sessionIds.indexOf(session.id) + 1}</span>
              </TableBodyCell>
              <TableBodyCell>{session.name}</TableBodyCell>
              <TableBodyCell>{session.audience}</TableBodyCell>
              <TableBodyCell>{session.phase}</TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={4}>{emptyText('Aucune séance')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else if $navArea === 'styles' && !openedStyle}
    {@render panelTitle('Styles')}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher un style" onadd={() => openDialog('style')}>
        <TableHead><TableHeadCell>Nom</TableHeadCell></TableHead>
        <TableBody>
          {#each visibleStyles as style (style.id)}
            <TableBodyRow class="cursor-pointer" onclick={() => openNavItem(style.id)}>
              <TableBodyCell>{style.name}</TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell>{emptyText('Aucun style')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else if openedStyle}
    {@render panelTitle(openedStyle.name)}
    <Card size="xl" class="p-6">
      <div class="flex flex-wrap items-end gap-3">
        <Label>Équipe 1 <Input type="color" class="mt-1 h-10 w-16 p-1" value={openedStyle.team1Color} onchange={(e) => updateStyle(openedStyle.id, { team1Color: fieldValue(e) })} /></Label>
        <Label>Taille <Input type="number" class="mt-1 w-24" value={openedStyle.team1Size} onchange={(e) => updateStyle(openedStyle.id, { team1Size: Number(fieldValue(e)) })} /></Label>
        <Label>Équipe 2 <Input type="color" class="mt-1 h-10 w-16 p-1" value={openedStyle.team2Color} onchange={(e) => updateStyle(openedStyle.id, { team2Color: fieldValue(e) })} /></Label>
        <Label>Taille <Input type="number" class="mt-1 w-24" value={openedStyle.team2Size} onchange={(e) => updateStyle(openedStyle.id, { team2Size: Number(fieldValue(e)) })} /></Label>
        <Label>Ballon <Input type="color" class="mt-1 h-10 w-16 p-1" value={openedStyle.ballColor} onchange={(e) => updateStyle(openedStyle.id, { ballColor: fieldValue(e) })} /></Label>
        <Label>Herbe <Input type="color" class="mt-1 h-10 w-16 p-1" value={openedStyle.backgroundColor} onchange={(e) => updateStyle(openedStyle.id, { backgroundColor: fieldValue(e) })} /></Label>
        <Label>Pelouse
          <Select class="mt-1" placeholder="" value={openedStyle.grassType} items={[{ value: 'stripes', name: 'Rayée' }, { value: 'solid', name: 'Unie' }]} onchange={(e) => updateStyle(openedStyle.id, { grassType: fieldValue(e) } as Partial<PageStyle>)} />
        </Label>
      </div>
    </Card>
  {:else if $navArea === 'library' && !$navItem}
    {@render panelTitle('Bibliothèque')}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher un domaine">
        <TableHead>
          <TableHeadCell>Domaine</TableHeadCell>
          <TableHeadCell>Objets</TableHeadCell>
          <TableHeadCell>Terrains</TableHeadCell>
          <TableHeadCell>Formes</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each visibleDomains as domain (domain)}
            <TableBodyRow class="cursor-pointer" onclick={() => openNavItem(domain)}>
              <TableBodyCell>{domain}</TableBodyCell>
              <TableBodyCell>{kindCount(domain, 'objects')}</TableBodyCell>
              <TableBodyCell>{kindCount(domain, 'pitches')}</TableBodyCell>
              <TableBodyCell>{kindCount(domain, 'shapes')}</TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={4}>{emptyText('Aucun domaine')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else if $navArea === 'library' && !$navChild}
    {@render panelTitle($navItem)}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher un dossier">
        <TableHead>
          <TableHeadCell>Dossier</TableHeadCell>
          <TableHeadCell>Fichiers</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each visibleKinds as kind (kind.id)}
            <TableBodyRow class="cursor-pointer" onclick={() => openNavChild(kind.id)}>
              <TableBodyCell>{kind.label}</TableBodyCell>
              <TableBodyCell>{kindCount($navItem, kind.id)}</TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={2}>{emptyText('Aucun dossier')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else if $navArea === 'library'}
    {@render panelTitle(LIBRARY_KINDS.find(kind => kind.id === $navChild)?.label || 'Fichiers')}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher un fichier" onadd={() => openDialog('library')}>
        <TableHead><TableHeadCell>Nom</TableHeadCell></TableHead>
        <TableBody>
          {#each visibleFiles as item (item.file)}
            <TableBodyRow><TableBodyCell>{item.name}</TableBodyCell></TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell>{emptyText('Aucun fichier')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {/if}
</div>

<svelte:window onkeydown={(e) => { if (entryOpen && e.key === 'Escape') closeDialog(); }} />

<Modal title={dialogTitle} bind:open={entryOpen} size="md">
  <form id="entry-form" class="space-y-3" onsubmit={(e) => { e.preventDefault(); void confirmDialog(); }}>
    {#if dialog === 'season'}
      <Label>Nom <Input class="mt-1" bind:value={entryName} /></Label>
      <Label>Catégorie
        <Select class="mt-1" bind:value={categoryId} items={$categories.map(cat => ({ value: cat.id, name: cat.name }))} />
      </Label>
      <Label>Zone <Input class="mt-1" bind:value={zone} /></Label>
      <Label>Du <Input class="mt-1" type="date" bind:value={from} /></Label>
      <Label>Au <Input class="mt-1" type="date" bind:value={to} /></Label>
    {:else if dialog === 'slot'}
      <Label>Fiche <Input class="mt-1" bind:value={entryName} /></Label>
      <Label>Date <Input class="mt-1" bind:value={plainName} /></Label>
      <Label>Séance
        <Select class="mt-1" bind:value={sessionId} items={sessionChoices.map(session => ({ value: session.id, name: session.label }))} />
      </Label>
    {:else if dialog === 'library'}
      <Label>Nom <Input class="mt-1" bind:value={entryName} /></Label>
    {:else}
      <Label>{dialog === 'style' ? 'Fichier' : 'Répertoire'}
        <Input class="mt-1" bind:value={entryName} />
      </Label>
      <Label>Nom <Input class="mt-1" bind:value={plainName} /></Label>
    {/if}
    {#if dialogError}<Alert color="red">{dialogError}</Alert>{/if}
  </form>
  {#snippet footer()}
    <Button color="alternative" onclick={closeDialog}>Annuler</Button>
    <Button color="brand" type="submit" form="entry-form">OK</Button>
  {/snippet}
</Modal>
