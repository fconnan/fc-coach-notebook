<script lang="ts">
  import SeanceBoard from './SeanceBoard.svelte';
  import ExerciseEditor from './ExerciseEditor.svelte';
  import { RowDrag } from '$lib/utils/rowDrag.svelte';
  import { matches } from '$lib/utils/search';
  import SearchTable from './SearchTable.svelte';
  import { currentPage } from '$lib/stores/workspace';
  import {
    styles, seasons, themes, libraryItems, screen,
    exercisePaths,
    navDoor, navArea, navItem, navChild, navLeaf, missingPage,
    showHome, createCategory, openDoor, openArea, openNavItem, openNavChild, openEvaluation, createSeance,
    createStyle, updateStyle, createSeason, createSlot, createTheme, createThemeSession, createLibraryItem,
    reorderThemes, reorderThemeSessions,
    commitCoachName, refreshPortrait, savePortrait, portraitUrl, trainer,
    createPlayer, renamePlayer, loadEvaluation, saveEvaluation,
    playerPortraitUrl, savePlayerPortrait
  } from '$lib/workspace/state';
  import EvaluationCharts from './EvaluationCharts.svelte';
  import EvaluationTrend from './EvaluationTrend.svelte';
  import RawMarkdown from './RawMarkdown.svelte';
  import PortraitCard from './PortraitCard.svelte';
  import QuietIconButton from './QuietIconButton.svelte';
  import { renderMarkdown } from '$lib/workspace/markdownHtml';
  import { BarsOutline, PenOutline, PlusOutline } from 'flowbite-svelte-icons';
  import { LIBRARY_KINDS, WORKSPACE_DOORS, type LibraryKind, type WorkspaceArea, type WorkspaceDoor } from '$lib/workspace/catalog';
  import { folderSlug } from '$lib/workspace/exerciseFile';
  import { WEEKDAYS, longFrenchDate, monthGrid, monthLabel, shiftMonth, todayParts } from '$lib/workspace/calendar';
  import { fillTemplate, readTemplate } from '$lib/workspace/templates';
  import seancesArt from '$lib/assets/door-seances.jpg';
  import seasonArt from '$lib/assets/door-season.jpg';
  import atelierArt from '$lib/assets/door-atelier.jpg';
  import { type PageStyle } from '$lib/workspace/model';
  import {
    Alert, Button, Card, Datepicker, Heading, Input, Label, Modal, Select,
    TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell
  } from 'flowbite-svelte';

  let dialog = $state<'category' | 'style' | 'seance' | 'season' | 'slot' | 'theme' | 'session' | 'library' | 'player' | null>(null);
  let entryOpen = $state(false);
  let entryName = $state('');
  let plainName = $state('');
  let sessionId = $state('');
  let dialogError = $state('');
  let query = $state('');
  let evaluationDraft = $state('');
  let evaluationSaved = $state('');
  let evaluationEditing = $state(false);
  let evaluationNew = $state(false);
  let evaluationDate = $state<Date | undefined>(undefined);
  let draftPlayer = $state('');
  let evaluationTexts = $state<Record<string, string>>({});
  let editorToken = $state('');
  let savingEvaluation = $state(false);
  let playerPhoto = $state('');
  let portraits = $state<Record<string, string>>({});
  let photoError = $state('');
  let photoNotice = $state(0);
  let seasonSeen = '';
  let homeSeen = false;
  let shownPhoto = '';
  const today = todayParts();
  let calendarYear = $state(today.year);
  let calendarMonth = $state(today.month);
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
  const visibleSeasons = $derived($seasons.filter(season => matches(query, season.name)));
  const currentPlayer = $derived((openedSeason?.players || []).find(player => player.id === $navChild) ?? null);
  const visiblePlayers = $derived(openedSeason?.players || []);
  const evaluationLive = $derived(
    evaluationNew || editorToken === `${currentPlayer?.id || ''}:${$navLeaf}`
      ? evaluationDraft
      : (evaluationTexts[$navLeaf] || '')
  );
  const slotsByDate = $derived(new Map((openedSeason?.slots || []).map(slot => [slot.date, slot])));
  const calendarDays = $derived(monthGrid(calendarYear, calendarMonth));
  const calendarTitle = $derived(monthLabel(calendarYear, calendarMonth));
  const todayIso = $derived(todayParts().iso);
  const visibleThemes = $derived($themes.filter(theme => matches(query, theme.name)));
  const visibleSessions = $derived(openedTheme?.sessions.filter(session => matches(query, session.name)) ?? []);
  const visibleStyles = $derived($styles.filter(style => matches(query, style.name)));
  const visibleDomains = $derived(domains.filter(domain => matches(query, domain)));
  const visibleKinds = $derived(LIBRARY_KINDS.filter(kind => matches(query, kind.label)));
  const visibleFiles = $derived(files.filter(item => matches(query, item.name)));
  const themeIds = $derived($themes.map(theme => theme.id));
  const sessionIds = $derived(openedTheme?.sessions.map(session => session.id) ?? []);
  const editingExercise = $derived($screen === 'exercise' && Boolean($currentPage));

  function showMonth(delta: number) {
    const next = shiftMonth(calendarYear, calendarMonth, delta);
    calendarYear = next.year;
    calendarMonth = next.month;
  }

  function showToday() {
    const now = todayParts();
    calendarYear = now.year;
    calendarMonth = now.month;
  }

  function schemaAt(id: string): string {
    return $exercisePaths[id] || '';
  }

  $effect(() => {
    const id = $navItem;
    if (id === seasonSeen) return;
    seasonSeen = id;
    editorToken = '';
    photoError = '';
    const now = todayParts();
    calendarYear = now.year;
    calendarMonth = now.month;
  });

  $effect(() => {
    if ($navDoor) {
      homeSeen = false;
      return;
    }
    if (homeSeen) return;
    homeSeen = true;
    void refreshPortrait();
  });

  $effect(() => {
    const ids = (openedSeason?.players || []).map(player => player.id);
    let stop = false;
    const owned: string[] = [];
    void Promise.all(ids.map(async id => [id, await playerPortraitUrl(id)] as const)).then(pairs => {
      if (stop) {
        for (const [, url] of pairs) if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        return;
      }
      const next: Record<string, string> = {};
      for (const [id, url] of pairs) {
        if (!url) continue;
        next[id] = url;
        owned.push(url);
      }
      portraits = next;
    });
    return () => { stop = true; for (const url of owned) if (url.startsWith('blob:')) URL.revokeObjectURL(url); };
  });

  function openPlayer(id: string) {
    void openNavChild(id);
  }

  $effect(() => {
    const season = openedSeason?.id || '';
    const player = currentPlayer?.id || '';
    if (!season || !player) return;
    let stop = false;
    void playerPortraitUrl(player).then(url => {
      if (stop) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        return;
      }
      if (shownPhoto.startsWith('blob:')) URL.revokeObjectURL(shownPhoto);
      shownPhoto = url;
      playerPhoto = url;
    });
    const dates = currentPlayer?.evaluations || [];
    void Promise.all(dates.map(async item => [item, await loadEvaluation(player, item)] as const)).then(rows => {
      if (!stop) evaluationTexts = Object.fromEntries(rows);
    });
    return () => { stop = true; };
  });

  $effect(() => {
    const date = $navLeaf;
    const id = currentPlayer?.id || '';
    if (evaluationNew) {
      if (!date && id === draftPlayer) return;
      evaluationNew = false;
      evaluationDate = undefined;
    }
    if (!date || !id) {
      editorToken = '';
      return;
    }
    if (!(date in evaluationTexts)) return;
    const token = `${id}:${date}`;
    if (editorToken === token) return;
    evaluationDraft = evaluationTexts[date];
    evaluationSaved = evaluationTexts[date];
    evaluationEditing = false;
    editorToken = token;
  });

  function localIso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function dateFromIso(iso: string): Date | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return undefined;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function evaluationBody(text: string): string {
    return text.replace(/^#\s+[^\n]*\n+/, '');
  }

  async function startEvaluation() {
    if (!currentPlayer) return;
    photoError = '';
    const source = fillTemplate(await readTemplate('evaluation'), { date: '' });
    const body = evaluationBody(source).replace(/\n+$/, '\n');
    draftPlayer = currentPlayer.id;
    evaluationDraft = body;
    evaluationSaved = body;
    evaluationDate = undefined;
    evaluationEditing = true;
    evaluationNew = true;
    editorToken = `${currentPlayer.id}:new`;
  }

  function editEvaluation() {
    const date = $navLeaf;
    const body = evaluationBody(evaluationTexts[date] || '');
    evaluationDate = date ? dateFromIso(date) : undefined;
    evaluationDraft = body;
    evaluationSaved = body;
    evaluationEditing = true;
  }

  async function saveOpenEvaluation() {
    if (!currentPlayer || !evaluationDate) return;
    const date = localIso(evaluationDate);
    const previous = evaluationNew ? '' : $navLeaf;
    if (!date) return;
    if (date !== previous && currentPlayer.evaluations.includes(date)) {
      photoError = 'Cette date existe déjà.';
      return;
    }
    const text = `# ${longFrenchDate(date)}\n\n${evaluationBody(evaluationDraft).replace(/\n+$/, '')}\n`;
    savingEvaluation = true;
    const saved = await saveEvaluation(currentPlayer.id, date, text);
    savingEvaluation = false;
    if ('error' in saved) {
      photoError = saved.error;
      return;
    }
    const next = { ...evaluationTexts };
    if (previous && saved.date !== previous) delete next[previous];
    next[saved.date] = text;
    evaluationTexts = next;
    evaluationSaved = text;
    evaluationDraft = text;
    evaluationEditing = false;
    evaluationNew = false;
    evaluationDate = undefined;
    if (saved.date !== $navLeaf) {
      editorToken = '';
      openEvaluation(saved.date);
    }
  }

  function cancelEvaluation() {
    if (evaluationNew) {
      evaluationNew = false;
      evaluationDate = undefined;
      evaluationDraft = '';
      evaluationSaved = '';
      evaluationEditing = false;
      editorToken = '';
      photoError = '';
      return;
    }
    evaluationDraft = evaluationTexts[$navLeaf] || '';
    evaluationSaved = evaluationDraft;
    evaluationEditing = false;
    editorToken = '';
  }

  async function onCoachPhoto(file: File) {
    photoError = (await savePortrait(file)) || '';
  }

  function reportPhoto(message: string) {
    photoNotice += 1;
    photoError = message;
  }

  function clearPhotoError() {
    photoError = '';
  }

  async function applyPlayerPhoto(file: File) {
    if (!currentPlayer) return;
    const playerId = currentPlayer.id;
    photoError = (await savePlayerPortrait(playerId, file)) || '';
    if (photoError) return;
    const url = await playerPortraitUrl(playerId);
    if (shownPhoto.startsWith('blob:')) URL.revokeObjectURL(shownPhoto);
    shownPhoto = url;
    playerPhoto = url;
    const previous = portraits[playerId];
    if (previous && previous !== url && previous.startsWith('blob:')) URL.revokeObjectURL(previous);
    portraits = { ...portraits, [playerId]: url };
  }

  async function onPlayerPhoto(file: File) {
    await applyPlayerPhoto(file);
  }

  const door = $derived(WORKSPACE_DOORS.find(item => item.id === $navDoor) ?? null);
  const dialogTitle = $derived(dialog === 'category' ? 'Nouvelle catégorie'
    : dialog === 'seance' || dialog === 'session' ? 'Nouvelle séance'
    : dialog === 'style' ? 'Nouveau style'
    : dialog === 'season' ? 'Nouvelle saison'
    : dialog === 'slot' ? 'Nouveau créneau'
    : dialog === 'player' ? 'Nouveau joueur'
    : dialog === 'theme' ? 'Nouveau thème'
    : 'Nouveau fichier');

  const doorArt: Record<WorkspaceDoor, string> = {
    repertoire: seancesArt,
    season: seasonArt,
    studio: atelierArt
  };

  function closeDialog() {
    dialog = null;
    entryOpen = false;
  }

  function openDialog(kind: NonNullable<typeof dialog>, date = '') {
    dialog = kind;
    entryName = date;
    plainName = '';
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
      dialogError = (await createSeason(entryName)) || '';
      if (!dialogError) closeDialog();
      return;
    }
    if (dialog === 'slot') {
      dialogError = (await createSlot(entryName, sessionId)) || '';
      if (!dialogError) closeDialog();
      return;
    }
    if (dialog === 'player') {
      const folder = folderSlug(entryName);
      dialogError = (await createPlayer(entryName)) || '';
      if (dialogError) return;
      closeDialog();
      await openNavChild(folder);
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

{#snippet photoBanner(className: string)}
  {#if photoError}
    {#key photoNotice}
      <Alert color="red" class={className} dismissable closeAriaLabel="Fermer" closeButtonProps={{ name: 'Fermer', ariaLabel: 'Fermer', onclick: clearPhotoError }}>{photoError}</Alert>
    {/key}
  {/if}
{/snippet}

{#snippet orderAlert()}
  {#if drag.error}<Alert color="red" class="mb-3">{drag.error}</Alert>{/if}
{/snippet}

{#snippet panelTitle(title: string, onadd: (() => void) | undefined = undefined, addLabel = 'Ajouter')}
  <div class="mb-3 flex items-center gap-1">
    <Heading tag="h2" class="text-xl">{title}</Heading>
    {#if onadd}
      <QuietIconButton label={addLabel} onclick={onadd}><PlusOutline size="sm" /></QuietIconButton>
    {/if}
  </div>
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
    <PortraitCard class="mb-6" photo={$portraitUrl} name={$trainer.name} onphoto={onCoachPhoto} onname={commitCoachName} onerror={reportPhoto} />
    {@render photoBanner('mb-6')}
    <div class="mb-6 grid gap-3 sm:grid-cols-3">
      {#each WORKSPACE_DOORS as item (item.id)}
        <div class="flex min-w-0 flex-col">
          {@render panelTitle(item.label)}
          <Card size="xl" class="flex flex-1 cursor-pointer flex-col overflow-hidden p-0" onclick={() => openDoor(item.id)}>
            <img src={doorArt[item.id]} alt="" class="aspect-[5/4] w-full object-cover" />
            <div class="flex flex-1 px-5 pt-3 pb-4">
              <p class="text-sm text-gray-500 dark:text-gray-400">{item.line}</p>
            </div>
          </Card>
        </div>
      {/each}
    </div>
  {:else if !$navArea}
    <div class="flex flex-wrap gap-2">
      {#each door?.children || [] as child (child.id)}
        <Button color="alternative" onclick={() => openArea(child.id)}>{child.label}</Button>
      {/each}
    </div>
  {:else if $navArea === 'seasons' && !openedSeason}
    {@render panelTitle('Saisons', () => openDialog('season'), 'Ajouter une saison')}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher une saison">
        <TableHead>
          <TableHeadCell>Nom</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each visibleSeasons as season (season.id)}
            <TableBodyRow class="cursor-pointer" onclick={() => openNavItem(season.id)}>
              <TableBodyCell>{season.name}</TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell>{emptyText('Aucune saison')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else if openedSeason && currentPlayer && ($navLeaf || evaluationNew)}
    <div class="eval-split grid items-start gap-4">
      {@render photoBanner('col-span-full')}
      <div class="eval-frame min-w-0 rounded-xl border border-default-medium bg-white dark:bg-neutral-primary">
        <div class="eval-tools flex items-center justify-end gap-1 rounded-t-xl border-b border-default-medium bg-gray-100 px-2 py-1 dark:bg-gray-800">
          {#if evaluationEditing}
            <QuietIconButton label="Annuler" onclick={cancelEvaluation}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 6l12 12M18 6 6 18" /></svg>
            </QuietIconButton>
            <QuietIconButton label="Sauver" disabled={savingEvaluation || !evaluationDate || (localIso(evaluationDate) === (evaluationNew ? '' : $navLeaf) && evaluationDraft === evaluationSaved)} onclick={() => { void saveOpenEvaluation(); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 13 4 4L19 7" /></svg>
            </QuietIconButton>
          {:else}
            <QuietIconButton label="Modifier" onclick={editEvaluation}><PenOutline size="sm" /></QuietIconButton>
          {/if}
        </div>
        {#if evaluationNew || editorToken === `${currentPlayer.id}:${$navLeaf}`}
          {#if evaluationEditing}
            {#key editorToken}
              <div class="eval-date">
                <Datepicker
                  bind:value={evaluationDate}
                  locale="fr-FR"
                  firstDayOfWeek={1}
                  placeholder="Choisir une date"
                  dateFormat={{ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }}
                  inputmode="none"
                  color="alternative"
                  inputProps={{ readonly: true, 'aria-label': 'Date' }}
                />
              </div>
              <div class="eval-editor">
                <RawMarkdown bind:value={evaluationDraft} />
              </div>
            {/key}
          {:else}
            <div class="eval-md">{@html renderMarkdown(evaluationDraft.replace(/^\{\{\s*skills(?:\s+[^}]*)?\s*\}\}\s*$/gim, ''))}</div>
          {/if}
        {/if}
      </div>
      <div class="min-w-0">
        <EvaluationCharts markdown={evaluationLive} />
      </div>
    </div>
  {:else if openedSeason && currentPlayer}
    <PortraitCard class="mb-6" photo={playerPhoto} name={currentPlayer.name} onphoto={onPlayerPhoto} onname={(value) => renamePlayer(currentPlayer.id, value)} onerror={reportPhoto} />
    {@render photoBanner('mb-6')}
    {@render panelTitle('Évaluations', startEvaluation, 'Ajouter une évaluation')}
    <Card size="xl" class="p-6">
      <EvaluationTrend
        rows={(currentPlayer.evaluations || []).map(date => ({ date, markdown: evaluationTexts[date] || '' }))}
        season={openedSeason.uuid || openedSeason.id}
        player={currentPlayer.id}
        onopen={openEvaluation}
      />
    </Card>
  {:else if openedSeason}
    <Heading tag="h2" class="mb-3 text-xl">{openedSeason.name}</Heading>
    <Heading tag="h2" class="mb-3 text-xl">Séances</Heading>
    <Card size="xl" class="mb-3 p-6">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" color="alternative" onclick={() => showMonth(-1)}>Précédent</Button>
        <Button size="sm" color="alternative" onclick={() => showMonth(1)}>Suivant</Button>
        <Button size="sm" color="alternative" onclick={showToday}>Aujourd’hui</Button>
        <p class="min-w-40 px-2 text-center text-base font-semibold">{calendarTitle}</p>
      </div>
      <div class="border border-default-medium bg-gray-200 dark:bg-gray-800">
        <div class="grid grid-cols-7 border-b border-default-medium">
          {#each WEEKDAYS as name}
            <div class="px-1 py-2 text-center text-xs font-medium uppercase">{name}</div>
          {/each}
        </div>
        <div class="grid grid-cols-7">
          {#each calendarDays as cell, index (cell.iso)}
            {@const slot = cell.inMonth ? slotsByDate.get(cell.iso) : undefined}
            {@const col = index % 7}
            {@const lastRow = index >= calendarDays.length - 7}
            {@const leftIn = col > 0 && calendarDays[index - 1].inMonth}
            {@const aboveIn = index >= 7 && calendarDays[index - 7].inMonth}
            {@const rightIn = col < 6 && calendarDays[index + 1].inMonth}
            {@const belowIn = !lastRow && calendarDays[index + 7].inMonth}
            {#if cell.inMonth}
              <div class="relative min-h-24 border-default-medium bg-white p-1 dark:bg-neutral-primary {col < 6 && rightIn ? 'border-r' : ''} {!lastRow && belowIn ? 'border-b' : ''} {cell.iso === todayIso ? 'z-10 ring-2 ring-inset ring-primary-700' : ''} {slot ? '' : 'cursor-pointer'}" onclick={() => { if (!slot) openDialog('slot', cell.iso); }}>
                <div class="text-sm">{cell.day}</div>
                {#if slot}
                  <button type="button" class="mt-1 w-full cursor-pointer rounded px-1 py-0.5 text-left text-xs hover:underline" onclick={() => openNavChild(slot.session)}>{slot.sessionName}</button>
                {/if}
              </div>
            {:else}
              <div class="min-h-24 border-dotted border-default-medium bg-gray-100 dark:bg-gray-700 {col < 6 ? 'border-r' : ''} {!lastRow ? 'border-b' : ''} {leftIn ? 'border-l' : ''} {aboveIn ? 'border-t' : ''}"></div>
            {/if}
          {/each}
        </div>
      </div>
    </Card>
    <div class="mb-3 flex items-center gap-1">
      <Heading tag="h2" class="text-xl">Joueurs</Heading>
      <QuietIconButton label="Ajouter un joueur" onclick={() => openDialog('player')}><PlusOutline size="sm" /></QuietIconButton>
    </div>
    <Card size="xl" class="p-6">
      {@render photoBanner('mb-3')}
      <div class="flex flex-wrap gap-3">
        {#each visiblePlayers as player (player.id)}
          <button type="button" class="group cursor-pointer" onclick={() => openPlayer(player.id)}>
            <span class="flex h-16 w-72 items-stretch overflow-hidden rounded-2xl border border-default-medium bg-white shadow-[0_4px_14px_rgba(15,23,42,0.14)] transition group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_20px_rgba(15,23,42,0.18)] dark:bg-neutral-primary dark:shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
              <span class="flex min-w-0 flex-1 items-center justify-center px-3 text-center text-sm font-medium">{player.name}</span>
              {#if portraits[player.id]}
                <img src={portraits[player.id]} alt="" class="h-16 w-16 shrink-0 object-cover" />
              {:else}
                <span class="flex h-16 w-16 shrink-0 items-center justify-center bg-gray-100 text-xs dark:bg-gray-700">Photo</span>
              {/if}
            </span>
          </button>
        {:else}
          <p class="text-sm">Aucun joueur</p>
        {/each}
      </div>
    </Card>
  {:else if $navArea === 'themes' && !openedTheme}
    <div class="mb-3 flex items-center gap-1">
      <Heading tag="h1" class="text-xl">Thèmes de séances</Heading>
      <QuietIconButton label="Ajouter un thème" onclick={() => openDialog('theme')}><PlusOutline size="sm" /></QuietIconButton>
    </div>
    <Card size="xl" class="p-6">
    {@render orderAlert()}
    <SearchTable bind:query placeholder="Rechercher un thème">
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
    {@render panelTitle(openedTheme.name, () => openDialog('session'), 'Ajouter une séance')}
    <Card size="xl" class="p-6">
      {@render orderAlert()}
      <SearchTable bind:query placeholder="Rechercher une séance">
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
    {@render panelTitle('Styles', () => openDialog('style'), 'Ajouter un style')}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher un style">
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
    {@render panelTitle(LIBRARY_KINDS.find(kind => kind.id === $navChild)?.label || 'Fichiers', () => openDialog('library'), 'Ajouter un fichier')}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher un fichier">
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
    {:else if dialog === 'slot'}
      <Label>Date <Input class="mt-1" type="date" bind:value={entryName} /></Label>
      <Label>Séance
        <Select class="mt-1" bind:value={sessionId} items={sessionChoices.map(session => ({ value: session.id, name: session.label }))} />
      </Label>
    {:else if dialog === 'player'}
      <Label>Nom <Input class="mt-1" bind:value={entryName} /></Label>
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

<style>
  .eval-split {
    grid-template-columns: minmax(0, 1fr);
  }
  @media (min-width: 768px) {
    .eval-split {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    :global(.is-wide) .eval-split {
      grid-template-columns: minmax(0, 28rem) minmax(0, 1fr);
    }
  }
  .eval-md { padding: 1rem; font-size: 0.975rem; line-height: 1.5; }
  .eval-md :global(h1) { margin: 0 0 0.75rem; font-size: 1.15rem; font-weight: 700; }
  .eval-md :global(h2) { margin: 0.9rem 0 0.3rem; font-size: 1rem; font-weight: 650; }
  .eval-md :global(p) { margin: 0.35rem 0; }
  .eval-md :global(ul) { margin: 0.25rem 0 0.6rem; padding-left: 1.15rem; list-style: disc; }
  .eval-md :global(li) { margin: 0.12rem 0; }
  .eval-md :global(.md-note) { list-style: none; color: #6b7280; }
  .eval-date { position: relative; z-index: 20; padding: 1rem 1rem 0; }
  .eval-date :global(input[data-part="input"]) {
    border: 0;
    background: transparent;
    box-shadow: none;
    padding: 0 2.25rem 0 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: inherit;
  }
  .eval-date :global(input[data-part="input"]:focus) {
    outline: none;
    box-shadow: none;
  }
  .eval-editor {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    height: calc(100vh - 16.5rem);
    min-height: 24rem;
    padding-bottom: 1rem;
  }
  .eval-editor :global(.raw-md) {
    flex: 1 1 auto;
    height: auto;
    min-height: 0;
    border: 0;
  }
</style>
