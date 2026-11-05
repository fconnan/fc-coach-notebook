<script lang="ts">
  import { onMount } from 'svelte';
  import SeanceBoard from './SeanceBoard.svelte';
  import ExerciseEditor from './ExerciseEditor.svelte';
  import ElementYamlEditor from './ElementYamlEditor.svelte';
  import SvgEditor from './SvgEditor.svelte';
  import { RowDrag } from '$lib/utils/rowDrag.svelte';
  import { matches } from '$lib/utils/search';
  import SearchTable from './SearchTable.svelte';
  import { currentPage } from '$lib/stores/workspace';
  import {
    seasons, themes, libraryItems, screen,
    exercisePaths,
    navDoor, navArea, navItem, navChild, navLeaf, missingPage,
    showHome, createCategory, openDoor, openArea, openNavItem, openNavChild, openEvaluation, createSeance,
    createSeason, createSlot, createTheme, createThemeSession, createLibraryFolder, createLibraryItem,
    reorderThemes, reorderThemeSessions,
    commitCoachName, refreshPortrait, savePortrait, portraitUrl, trainer,
    renamePlayer, loadEvaluation, saveEvaluation, saveSeasonMarkdown,
    deleteSeason, deleteTheme, deleteThemeSession, deleteLibraryItem,
    playerPortraitUrl, savePlayerPortrait
  } from '$lib/workspace/state';
  import EvaluationCharts from './EvaluationCharts.svelte';
  import EvaluationTrend from './EvaluationTrend.svelte';
  import RawMarkdown from './RawMarkdown.svelte';
  import SplitPane from './SplitPane.svelte';
  import PortraitCard from './PortraitCard.svelte';
  import QuietIconButton from './QuietIconButton.svelte';
  import RowActions from './RowActions.svelte';
  import ConfirmDelete, { plural, type DeleteRequest } from './ConfirmDelete.svelte';
  import { confirmLeaveEditors, registerEditorGate, type EditorGate } from '$lib/workspace/editorLeave';
  import { renderMarkdown } from '$lib/workspace/markdownHtml';
  import { BarsOutline, PenOutline, PlusOutline } from 'flowbite-svelte-icons';
  import {
    WORKSPACE_DOORS, elementRel,
    type LibraryItem, type SeasonInfo, type ThemeInfo, type ThemeSessionInfo, type WorkspaceArea, type WorkspaceDoor
  } from '$lib/workspace/catalog';
  import { WEEKDAYS, longFrenchDate, monthGrid, monthLabel, shiftMonth, todayParts } from '$lib/workspace/calendar';
  import { skillsMarkerFrom, withoutSkillsMarker, type SkillsMarker } from '$lib/workspace/evaluation';
  import { fillTemplate, readTemplate } from '$lib/workspace/templates';
  import seancesArt from '$lib/assets/door-seances.jpg';
  import seasonArt from '$lib/assets/door-season.jpg';
  import elementsArt from '$lib/assets/door-atelier.jpg';
  import {
    Alert, Button, ButtonGroup, Card, Datepicker, Heading, Input, Label, Modal, Select,
    TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell
  } from 'flowbite-svelte';

  let dialog = $state<'category' | 'seance' | 'season' | 'slot' | 'theme' | 'session' | 'library' | null>(null);
  let libraryKind = $state<'folder' | 'yaml' | 'svg'>('yaml');
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
  let skillsMarker = $state<SkillsMarker | null>(null);
  let draftPlayer = $state('');
  let evaluationTexts = $state<Record<string, string>>({});
  let editorToken = $state('');
  let savingEvaluation = $state(false);
  const CHART_ZOOM = 'fctactics_eval_zoom';
  let chartZoom = $state(savedChartZoom());

  function clampZoom(value: number) {
    return Math.min(2.5, Math.max(0.5, Math.round(value * 100) / 100));
  }

  function savedChartZoom(): number {
    try {
      const value = Number(sessionStorage.getItem(CHART_ZOOM));
      return value ? clampZoom(value) : 1;
    } catch { return 1; }
  }

  function setChartZoom(value: number) {
    chartZoom = clampZoom(value);
    try { sessionStorage.setItem(CHART_ZOOM, String(chartZoom)); } catch { /* ignore */ }
  }

  function zoomCharts(factor: number) {
    setChartZoom(chartZoom * factor);
  }

  function bindChartZoom(node: HTMLElement) {
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoomCharts(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return { destroy() { node.removeEventListener('wheel', onWheel); } };
  }
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
  const SEASON_VIEW = 'fctactics_season_view';
  let seasonView = $state<'players' | 'sessions'>(savedSeasonView());
  const drag = new RowDrag();

  function savedSeasonView(): 'players' | 'sessions' {
    try { return sessionStorage.getItem(SEASON_VIEW) === 'sessions' ? 'sessions' : 'players'; } catch { return 'players'; }
  }

  function showSeasonView(next: 'players' | 'sessions') {
    seasonView = next;
    try { sessionStorage.setItem(SEASON_VIEW, next); } catch { /* ignore */ }
  }

  let deleteRequest = $state<DeleteRequest | null>(null);

  function plannedIn(sessions: ThemeSessionInfo[]) {
    const ids = new Set(sessions.map(session => session.id));
    const count = $seasons.reduce((sum, season) => sum + season.slots.filter(slot => ids.has(slot.session)).length, 0);
    return `${plural(count, 'séance planifiée', 'séances planifiées')} dans les saisons`;
  }

  function askDeleteSeason(season: SeasonInfo) {
    deleteRequest = {
      title: 'Supprimer la saison',
      subject: 'La saison',
      name: season.name,
      deleted: 'supprimée',
      items: [
        plural(season.players.length, 'joueur', 'joueurs'),
        plural(season.players.reduce((sum, player) => sum + player.evaluations.length, 0), 'évaluation', 'évaluations'),
        plural(season.slots.length, 'séance planifiée', 'séances planifiées')
      ],
      note: 'Les séances restent disponibles dans les thèmes.',
      run: () => deleteSeason(season.id)
    };
  }

  function askDeleteTheme(theme: ThemeInfo) {
    deleteRequest = {
      title: 'Supprimer le thème',
      subject: 'Le thème',
      name: theme.name,
      deleted: 'supprimé',
      items: [
        plural(theme.sessions.length, 'séance', 'séances'),
        plural(theme.sessions.reduce((sum, session) => sum + session.exercises, 0), 'exercice', 'exercices'),
        plannedIn(theme.sessions)
      ],
      run: () => deleteTheme(theme.id)
    };
  }

  function askDeleteSession(theme: ThemeInfo, session: ThemeSessionInfo) {
    deleteRequest = {
      title: 'Supprimer la séance',
      subject: 'La séance',
      name: session.name,
      deleted: 'supprimée',
      items: [plural(session.exercises, 'exercice', 'exercices'), plannedIn([session])],
      run: () => deleteThemeSession(theme.id, session.id)
    };
  }

  function askDeleteFile(item: LibraryItem) {
    const folder = item.kind === 'folder';
    const inside = folder
      ? $libraryItems.filter(entry => entry.kind !== 'folder' && entry.path.startsWith(`${item.path}/`)).length
      : 0;
    deleteRequest = {
      title: folder ? 'Supprimer le dossier' : 'Supprimer le fichier',
      subject: folder ? 'Le dossier' : 'Le fichier',
      name: item.name,
      deleted: 'supprimé',
      items: folder ? [plural(inside, 'fichier', 'fichiers')] : undefined,
      run: () => deleteLibraryItem(item.path)
    };
  }

  let seasonEditing = $state(false);
  let seasonDraft = $state('');
  let seasonError = $state('');
  let savingSeason = $state(false);

  $effect(() => {
    void $navItem;
    seasonEditing = false;
  });

  function editSeason() {
    seasonDraft = openedSeason?.markdown || '';
    seasonError = '';
    seasonEditing = true;
  }

  async function saveSeason(): Promise<boolean> {
    savingSeason = true;
    seasonError = '';
    const ok = await saveSeasonMarkdown(seasonDraft);
    savingSeason = false;
    if (!ok) {
      seasonError = 'Enregistrement impossible.';
      return false;
    }
    seasonEditing = false;
    return true;
  }

  function discardSeason() {
    seasonDraft = openedSeason?.markdown || '';
    seasonEditing = false;
  }

  const seasonGate: EditorGate = {
    dirty: () => seasonEditing && seasonDraft !== (openedSeason?.markdown || ''),
    save: saveSeason,
    discard: discardSeason
  };

  async function cancelSeason() {
    if (!(await confirmLeaveEditors(seasonGate))) return;
    discardSeason();
  }

  const openedSeason = $derived($seasons.find(season => season.id === $navItem) ?? null);
  const openedTheme = $derived($themes.find(theme => theme.id === $navItem) ?? null);
  const elementHere = $derived($libraryItems.find(item => elementRel(item.path) === $navItem) ?? null);
  const elementRows = $derived($libraryItems.filter(item => {
    const rel = elementRel(item.path);
    const parent = rel.split('/').slice(0, -1).join('/');
    return parent === $navItem;
  }).sort((a, b) => {
    if ((a.kind === 'folder') !== (b.kind === 'folder')) return a.kind === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr');
  }));
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
  const visibleElements = $derived(elementRows.filter(item => matches(query, item.name)));
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
    void readTemplate('evaluation').then(text => {
      if (!stop) skillsMarker = skillsMarkerFrom(text);
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
    return withoutSkillsMarker(text.replace(/^#[^\r\n]*\r?\n(?:\r?\n)?/, ''));
  }

  async function startEvaluation() {
    if (!currentPlayer) return;
    photoError = '';
    const template = await readTemplate('evaluation');
    skillsMarker = skillsMarkerFrom(template);
    const source = fillTemplate(template, { date: '' });
    const body = evaluationBody(source).replace(/\n+$/, '\n');
    draftPlayer = currentPlayer.id;
    evaluationDraft = body;
    evaluationSaved = body;
    evaluationDate = dateFromIso(todayParts().iso);
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

  function evaluationDirty(): boolean {
    if (!evaluationEditing) return false;
    if (!evaluationDate) return evaluationDraft !== evaluationSaved;
    return !(localIso(evaluationDate) === (evaluationNew ? '' : $navLeaf) && evaluationDraft === evaluationSaved);
  }

  async function saveOpenEvaluation(): Promise<boolean> {
    if (!currentPlayer || !evaluationDate) return false;
    const date = localIso(evaluationDate);
    const previous = evaluationNew ? '' : $navLeaf;
    if (!date) return false;
    if (date !== previous && currentPlayer.evaluations.includes(date)) {
      photoError = 'Cette date existe déjà.';
      return false;
    }
    const text = `# ${longFrenchDate(date)}\n\n${evaluationBody(evaluationDraft).replace(/\n+$/, '')}\n`;
    savingEvaluation = true;
    const saved = await saveEvaluation(currentPlayer.id, date, text);
    savingEvaluation = false;
    if ('error' in saved) {
      photoError = saved.error;
      return false;
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
    return true;
  }

  function revertEvaluation() {
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

  const evaluationGate: EditorGate = {
    dirty: evaluationDirty,
    save: saveOpenEvaluation,
    discard: revertEvaluation
  };

  async function cancelEvaluation() {
    if (!(await confirmLeaveEditors(evaluationGate))) return;
    revertEvaluation();
  }

  onMount(() => {
    const stopSeason = registerEditorGate(seasonGate);
    const stopEvaluation = registerEditorGate(evaluationGate);
    return () => {
      stopSeason();
      stopEvaluation();
    };
  });

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
    : dialog === 'season' ? 'Nouvelle saison'
    : dialog === 'slot' ? 'Nouveau créneau'
    : dialog === 'theme' ? 'Nouveau thème'
    : 'Ajouter');

  const doorArt: Record<WorkspaceDoor, string> = {
    repertoire: seancesArt,
    season: seasonArt,
    elements: elementsArt
  };

  function closeDialog() {
    dialog = null;
    entryOpen = false;
  }

  function openDialog(kind: NonNullable<typeof dialog>, date = '') {
    dialog = kind;
    libraryKind = 'yaml';
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
    dialogError = libraryKind === 'folder'
      ? (await createLibraryFolder(entryName)) || ''
      : (await createLibraryItem(entryName, libraryKind)) || '';
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

  function elementKind(kind: LibraryItem['kind']): string {
    if (kind === 'folder') return 'Dossier';
    if (kind === 'yaml') return 'Élément';
    return 'Dessin';
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
    {@render panelTitle('Saisons')}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher une saison" addLabel="Ajouter une saison" onadd={() => openDialog('season')}>
        <TableHead>
          <TableHeadCell>Nom</TableHeadCell>
          <TableHeadCell class="w-px"><span class="sr-only">Actions</span></TableHeadCell>
        </TableHead>
        <TableBody>
          {#each visibleSeasons as season (season.id)}
            <TableBodyRow class="cursor-pointer" onclick={() => openNavItem(season.id)}>
              <TableBodyCell>{season.name}</TableBodyCell>
              <TableBodyCell class="py-0"><RowActions ondelete={() => askDeleteSeason(season)} /></TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={2}>{emptyText('Aucune saison')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else if openedSeason && currentPlayer && ($navLeaf || evaluationNew)}
    <div class="eval-split flex flex-col gap-4">
      {@render photoBanner('shrink-0')}
      <SplitPane view="evaluation" stack class="min-h-0 flex-1">
      {#snippet left()}
      <div class="eval-frame min-w-0 overflow-hidden rounded-xl border border-default-medium bg-white dark:bg-neutral-primary">
        <div class="eval-tools" class:is-editing={evaluationEditing}>
          {#if evaluationEditing}
            <QuietIconButton label="Annuler" onclick={() => { void cancelEvaluation(); }}>
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
                <span class="eval-date-label">Date:</span>
                {#if evaluationDate}
                  <span class="eval-date-value">{longFrenchDate(localIso(evaluationDate))}</span>
                {/if}
                <Datepicker
                  bind:value={evaluationDate}
                  locale="fr-FR"
                  firstDayOfWeek={1}
                  placeholder=""
                  dateFormat={{ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }}
                  inputmode="none"
                  color="brand"
                  inputProps={{ readonly: true, 'aria-label': 'Date', tabindex: -1 }}
                />
              </div>
              <div class="eval-x">
                <div class="eval-editor">
                  <RawMarkdown bind:value={evaluationDraft} />
                </div>
              </div>
            {/key}
          {:else}
            <div class="eval-x">
              <div class="eval-md">{@html renderMarkdown(withoutSkillsMarker(evaluationDraft))}</div>
            </div>
          {/if}
        {/if}
      </div>
      {/snippet}
      {#snippet right()}
      <div class="eval-charts-pane min-w-0 overflow-hidden rounded-xl border border-default-medium bg-white dark:bg-neutral-primary" use:bindChartZoom>
        <div class="eval-zoom">
          <QuietIconButton label="Réduire" disabled={chartZoom <= 0.5} onclick={() => zoomCharts(1 / 1.1)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 12h12" /></svg>
          </QuietIconButton>
          <button type="button" class="eval-zoom-reset" onclick={() => setChartZoom(1)}>reset</button>
          <QuietIconButton label="Agrandir" disabled={chartZoom >= 2.5} onclick={() => zoomCharts(1.1)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M12 6v12M6 12h12" /></svg>
          </QuietIconButton>
        </div>
        <div class="eval-x">
          <EvaluationCharts markdown={evaluationLive} marker={skillsMarker} zoom={chartZoom} />
        </div>
      </div>
      {/snippet}
      </SplitPane>
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
        marker={skillsMarker}
        onopen={openEvaluation}
      />
    </Card>
  {:else if openedSeason && seasonEditing}
    <div class="mb-3 flex items-center gap-1">
      <Heading tag="h2" class="text-xl">{openedSeason.name}</Heading>
      <QuietIconButton label="Annuler" onclick={() => { void cancelSeason(); }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 6l12 12M18 6 6 18" /></svg>
      </QuietIconButton>
      <QuietIconButton label="Sauver" disabled={savingSeason || seasonDraft === openedSeason.markdown} onclick={() => { void saveSeason(); }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 13 4 4L19 7" /></svg>
      </QuietIconButton>
    </div>
    {#if seasonError}<Alert color="red" class="mb-3">{seasonError}</Alert>{/if}
    <Card size="xl" class="season-editor overflow-hidden p-0">
      <RawMarkdown bind:value={seasonDraft} uri="file:///season/content.md" />
    </Card>
  {:else if openedSeason}
    <Heading tag="h2" class="mb-3 text-xl">{openedSeason.name}</Heading>
    <div class="mb-3 flex items-center gap-1">
      <ButtonGroup size="sm" aria-label="Contenu de la saison">
        <Button size="sm" color={seasonView === 'players' ? 'brand' : 'alternative'} onclick={() => showSeasonView('players')}>Joueurs</Button>
        <Button size="sm" color={seasonView === 'sessions' ? 'brand' : 'alternative'} onclick={() => showSeasonView('sessions')}>Séances</Button>
      </ButtonGroup>
    </div>
    {#if seasonView === 'players'}
      <Button size="sm" color="alternative" class="mb-3 gap-2" onclick={editSeason}>
        <PenOutline size="sm" />Modifier la liste des joueurs
      </Button>
    {/if}
    {#if seasonView === 'sessions'}
      <Card size="xl" class="p-6">
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
    {:else}
      <Card size="xl" class="p-6">
        {@render photoBanner('mb-3')}
        <div class="flex flex-wrap gap-3">
          {#each visiblePlayers as player (player.id)}
            <button type="button" class="group cursor-pointer" onclick={() => openPlayer(player.id)}>
              <span class="flex h-16 w-60 items-stretch overflow-hidden rounded-2xl border border-default-medium bg-white shadow-[0_4px_14px_rgba(15,23,42,0.14)] transition group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_20px_rgba(15,23,42,0.18)] dark:bg-neutral-primary dark:shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
                <span class="flex min-w-0 flex-1 items-center justify-center px-3 text-center text-sm leading-tight font-medium"><span class="line-clamp-3 break-words">{player.name}</span></span>
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
    {/if}
  {:else if $navArea === 'themes' && !openedTheme}
    {@render panelTitle('Thèmes de séances')}
    <Card size="xl" class="p-6">
    {@render orderAlert()}
    <SearchTable bind:query placeholder="Rechercher un thème" addLabel="Ajouter un thème" onadd={() => openDialog('theme')}>
      <TableHead>
        <TableHeadCell class="w-24">Ordre</TableHeadCell>
        <TableHeadCell>Nom</TableHeadCell>
        <TableHeadCell class="w-px"><span class="sr-only">Actions</span></TableHeadCell>
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
            <TableBodyCell class="py-0"><RowActions ondelete={() => askDeleteTheme(theme)} /></TableBodyCell>
          </TableBodyRow>
        {:else}
          <TableBodyRow><TableBodyCell colspan={3}>{emptyText('Aucun thème')}</TableBodyCell></TableBodyRow>
        {/each}
      </TableBody>
    </SearchTable>
    </Card>
  {:else if openedTheme}
    {@render panelTitle(openedTheme.name)}
    <Card size="xl" class="p-6">
      {@render orderAlert()}
      <SearchTable bind:query placeholder="Rechercher une séance" addLabel="Ajouter une séance" onadd={() => openDialog('session')}>
        <TableHead>
          <TableHeadCell class="w-24">Ordre</TableHeadCell>
          <TableHeadCell>Nom</TableHeadCell>
          <TableHeadCell>Public</TableHeadCell>
          <TableHeadCell>Phase</TableHeadCell>
          <TableHeadCell class="w-px"><span class="sr-only">Actions</span></TableHeadCell>
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
              <TableBodyCell class="py-0"><RowActions ondelete={() => askDeleteSession(openedTheme, session)} /></TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={5}>{emptyText('Aucune séance')}</TableBodyCell></TableBodyRow>
          {/each}
        </TableBody>
      </SearchTable>
    </Card>
  {:else if $navArea === 'elements' && (elementHere?.kind === 'yaml' || elementHere?.kind === 'svg')}
    <div class="element-editor">
      {#key elementHere.path}
        {#if elementHere.kind === 'yaml'}
          <ElementYamlEditor file={elementHere.path} />
        {:else}
          <SvgEditor file={elementHere.path} />
        {/if}
      {/key}
    </div>
  {:else if $navArea === 'elements'}
    {@render panelTitle($navItem ? ($navItem.split('/').pop() || 'Éléments') : 'Éléments')}
    <Card size="xl" class="p-6">
      <SearchTable bind:query placeholder="Rechercher" addLabel="Ajouter" onadd={() => openDialog('library')}>
        <TableHead>
          <TableHeadCell>Nom</TableHeadCell>
          <TableHeadCell>Type</TableHeadCell>
          <TableHeadCell class="w-px"><span class="sr-only">Actions</span></TableHeadCell>
        </TableHead>
        <TableBody>
          {#each visibleElements as item (item.path)}
            <TableBodyRow class="cursor-pointer" onclick={() => openNavItem(elementRel(item.path))}>
              <TableBodyCell>{item.name}</TableBodyCell>
              <TableBodyCell>{elementKind(item.kind)}</TableBodyCell>
              <TableBodyCell class="py-0"><RowActions ondelete={() => askDeleteFile(item)} /></TableBodyCell>
            </TableBodyRow>
          {:else}
            <TableBodyRow><TableBodyCell colspan={3}>{emptyText('Aucun élément')}</TableBodyCell></TableBodyRow>
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
    {:else if dialog === 'library'}
      <Label>Type
        <Select class="mt-1" bind:value={libraryKind} items={[
          { value: 'folder', name: 'Dossier' },
          { value: 'yaml', name: 'Élément' },
          { value: 'svg', name: 'Dessin SVG' }
        ]} />
      </Label>
      <Label>Nom <Input class="mt-1" bind:value={entryName} /></Label>
    {:else}
      <Label>Répertoire
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

<ConfirmDelete bind:request={deleteRequest} />

<style>
  .element-editor {
    height: calc(100dvh - 10.5rem);
    min-height: 24rem;
  }
  .eval-split {
    height: calc(100dvh - 12.5rem);
    min-height: 22rem;
  }
  :global(.is-wide) .eval-split { --split-left: 28rem; }
  .eval-frame,
  .eval-charts-pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
  }
  .eval-x {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow-x: scroll;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .eval-charts-pane { position: relative; }
  .eval-tools {
    position: sticky;
    top: 0.45rem;
    z-index: 30;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 0.25rem;
    height: 0;
    margin-top: 0.45rem;
    margin-right: 2rem;
    overflow: visible;
    opacity: 0;
    pointer-events: none;
  }
  .eval-frame:hover .eval-tools,
  .eval-tools.is-editing { opacity: 1; }
  .eval-frame:hover .eval-tools :global(button),
  .eval-tools.is-editing :global(button) { pointer-events: auto; }
  .eval-zoom {
    position: sticky;
    top: 0.45rem;
    z-index: 5;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 0.25rem;
    height: 0;
    margin-top: 0.45rem;
    margin-right: 2rem;
    overflow: visible;
    opacity: 0;
    pointer-events: none;
  }
  .eval-charts-pane:hover .eval-zoom { opacity: 1; }
  .eval-charts-pane:hover .eval-zoom :global(button) { pointer-events: auto; }
  .eval-zoom-reset {
    height: 1.25rem;
    padding: 0 0.45rem;
    border-radius: 0.375rem;
    background: var(--color-brand);
    color: white;
    font-size: 0.75rem;
    line-height: 1.25rem;
  }
  .eval-zoom-reset:hover { background: var(--color-brand-strong); color: white; }
  .eval-md { padding: 1rem; font-size: 0.975rem; line-height: 1.5; }
  .eval-md :global(h1) { margin: 0 0 0.75rem; font-size: 1.15rem; font-weight: 700; }
  .eval-md :global(h2) { margin: 0.9rem 0 0.3rem; font-size: 1rem; font-weight: 650; }
  .eval-md :global(p) { margin: 0.35rem 0; }
  .eval-md :global(ul) { margin: 0.25rem 0 0.6rem; padding-left: 1.15rem; list-style: disc; }
  .eval-md :global(li) { margin: 0.12rem 0; }
  .eval-md :global(.md-note) { list-style: none; color: #6b7280; }
  .eval-date {
    position: relative;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 1rem 0.85rem;
  }
  .eval-date-label,
  .eval-date-value {
    font-size: 0.95rem;
    line-height: 1.2;
  }
  .eval-date-label { font-weight: 650; }
  .eval-date :global([data-scope="datepicker"]) { display: flex; }
  .eval-date :global([data-scope="datepicker"] > .relative) {
    display: flex;
    align-items: center;
  }
  .eval-date :global(input[data-part="input"]) {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }
  .eval-date :global(button[data-part="trigger"]) {
    position: static;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border-radius: 0.375rem;
    background: var(--color-brand);
    color: white;
  }
  .eval-date :global(button[data-part="trigger"]:hover) {
    background: var(--color-brand-strong);
    color: white;
  }
  .eval-date :global(button[data-part="trigger"] svg) {
    color: white;
  }
  .eval-editor {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
    padding-bottom: 1rem;
  }
  :global(.season-editor) :global(.raw-md) {
    border: 0;
  }
  .eval-editor :global(.raw-md) {
    flex: 1 1 auto;
    height: auto;
    min-height: 0;
    border: 0;
  }
</style>
