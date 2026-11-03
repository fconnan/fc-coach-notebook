import { get, writable } from 'svelte/store';
import { idbGet, idbSet } from '$lib/storage/idb';
import {
  DEFAULT_PAGE,
  commitToActiveFrame,
  currentPage,
  currentPageId,
  isDirty,
  migratePage,
  pages,
  selectedIds,
  setStyleHook,
  showNotes,
  tacticName,
  updatePageSettings,
  type Page
} from '$lib/stores/workspace';
import {
  CATEGORY_TYPE,
  EXERCISE_TYPE,
  ODS_NAME,
  PRODUCT,
  SEANCE_TYPE,
  WORKSPACE_TYPE,
  blankExercise,
  directoryNameIssue,
  emptyTrainer,
  isWorkspaceIndex,
  slug,
  styleFromPage,
  visualsFromStyle,
  type CategoryInfo,
  type PageStyle,
  type SeanceFile,
  type SeanceHeader,
  type TrainerInfo
} from './model';
import { canonicalIso, frenchDateOrder, longFrenchDate } from './calendar';
import { applyExerciseDocument, exerciseFolder, folderSlug, isUuidFolder, markdownTitle, orderByIds, orderSessionIndex, orderThemeIndex, parseExerciseDocument, splitExerciseRecord } from './exerciseFile';
import { fillTemplate, readTemplate, type TemplateName } from './templates';
import {
  coachName,
  COACH_IMAGE,
  doorOf,
  EVALUATIONS_DIR,
  PLAYER_IMAGE,
  PLAYERS_DIR,
  playerNames,
  SEASONS_DIR,
  THEMES_DIR,
  LIBRARY_KINDS,
  REPERTOIRE_TYPE,
  themeKey,
  type LibraryItem,
  type LibraryKind,
  type SeasonInfo,
  type SeasonPlayer,
  type ThemeInfo,
  type WorkspaceArea,
  type WorkspaceDoor
} from './catalog';
import { armAddress, bindAddress, followAddress, parseAddress, publishAddress, type AddressTarget } from './address';
import { confirmLeaveExercise } from './exerciseDraft';

const HANDLE_KEY = 'workspace_dir';
const CURSOR_KEY = 'fctactics_ws_cursor';

type Dir = FileSystemDirectoryHandle & {
  entries: () => AsyncIterable<[string, FileSystemHandle]>;
};

export interface SeanceRef {
  file: string;
  name: string;
  sheet: string;
  date?: string;
}

export type WorkspaceScreen = 'gate' | 'home' | 'category' | 'seance' | 'exercise';

export interface WorkspaceCursor {
  categoryId: string;
  seanceFile: string;
  exerciseId: string;
  showNotes: boolean;
  folderName: string;
  screen?: WorkspaceScreen;
  area?: WorkspaceArea | '';
  door?: WorkspaceDoor | '';
  item?: string;
  child?: string;
}

export const workspaceOpen = writable(false);
export const workspaceWritable = writable(false);
export const needsPermission = writable(false);
export const folderLabel = writable('');
export const screen = writable<WorkspaceScreen>('gate');
export const restoring = writable(true);
export const workspaceError = writable<string | null>(null);
export const trainer = writable<TrainerInfo>(emptyTrainer());
export const categories = writable<CategoryInfo[]>([]);
export const categoryInfo = writable<CategoryInfo | null>(null);
export const seanceList = writable<SeanceRef[]>([]);
export const seanceFile = writable<string | null>(null);
export const exercisePaths = writable<Record<string, string>>({});
export const seanceHeader = writable<SeanceHeader>(emptyHeader());
export const sessionTheme = writable<{ name: string; markdown: string }>({ name: '', markdown: '' });
export const seasonSelection = writable<string[] | null>(null);
export const styles = writable<PageStyle[]>([]);
export const seasons = writable<SeasonInfo[]>([]);
export const themes = writable<ThemeInfo[]>([]);
export const libraryItems = writable<LibraryItem[]>([]);
export const portraitUrl = writable('');
export const navDoor = writable<WorkspaceDoor | ''>('');
export const navArea = writable<WorkspaceArea | ''>('');
export const navItem = writable('');
export const navChild = writable('');
export const navLeaf = writable('');

let root: Dir | null = null;
/** null means the style file lives in the workspace-root styles folder. */
const styleSources = new Map<string, string | null>();
let ready = false;
let applying = false;
let saving = false;
let savePending = false;

function emptyHeader(): SeanceHeader {
  return { id: '', name: '', sheet: 'S1', date: '', phase: '', principle: '', means: '' };
}

setStyleHook((page, updates) => {
  const id = page.styleId;
  if (!id) return;
  styles.update(list => list.map(style => (style.id === id ? { ...style, ...updates } : style)));
  pages.update(list => list.map(p => (p.id !== page.id && p.styleId === id ? { ...p, ...updates } : p)));
});

function asDir(handle: Dir): Dir & {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
} {
  return handle;
}

async function permitted(handle: Dir, ask: boolean): Promise<boolean> {
  const dir = asDir(handle);
  const opts = { mode: 'readwrite' as const };
  let perm: PermissionState = 'prompt';
  try { perm = (await dir.queryPermission?.(opts)) || 'prompt'; } catch { perm = 'prompt'; }
  if (perm !== 'granted' && ask) {
    try { perm = (await dir.requestPermission?.(opts)) || 'prompt'; } catch { return false; }
  }
  if (perm === 'granted') return true;
  try {
    await handle.getFileHandle('index.json');
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(dir: Dir, name: string): Promise<T | null> {
  try {
    const file = await dir.getFileHandle(name);
    const text = await (await file.getFile()).text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJson(dir: Dir, name: string, value: unknown) {
  await writeText(dir, name, JSON.stringify(value, null, 2));
}

async function readText(dir: Dir, name: string): Promise<string | null> {
  try {
    const file = await dir.getFileHandle(name);
    return await (await file.getFile()).text();
  } catch {
    return null;
  }
}

async function writeText(dir: Dir, name: string, text: string) {
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(text);
  await writable.close();
}

async function loadExercise(dir: Dir): Promise<(Page & { type?: string }) | null> {
  const page = await readJson<Record<string, unknown>>(dir, 'index.json');
  if (!page || page.type !== EXERCISE_TYPE) return null;
  return applyExerciseDocument(page, await readText(dir, 'content.md')) as Page & { type?: string };
}

async function storeExercise(dir: Dir, page: Page) {
  const { index, document } = splitExerciseRecord({ type: EXERCISE_TYPE, ...page, id: page.id });
  await writeJson(dir, 'index.json', index);
  await writeText(dir, 'content.md', document);
}

async function readBytes(dir: Dir, name: string): Promise<Uint8Array | null> {
  try {
    const file = await dir.getFileHandle(name);
    return new Uint8Array(await (await file.getFile()).arrayBuffer());
  } catch {
    return null;
  }
}

async function writeBytes(dir: Dir, name: string, bytes: Uint8Array) {
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(new Blob([bytes as BlobPart]));
  await writable.close();
}

async function childDir(dir: Dir, name: string, create = false): Promise<Dir> {
  return dir.getDirectoryHandle(name, { create }) as Promise<Dir>;
}

async function under(dir: Dir, names: string[], create = false): Promise<Dir> {
  let current = dir;
  for (const name of names) current = await childDir(current, name, create);
  return current;
}

function cursor(): WorkspaceCursor | null {
  try {
    const raw = sessionStorage.getItem(CURSOR_KEY);
    return raw ? JSON.parse(raw) as WorkspaceCursor : null;
  } catch {
    return null;
  }
}

export function persistCursor() {
  if (!get(workspaceOpen)) return;
  const payload: WorkspaceCursor = {
    categoryId: get(categoryInfo)?.id || '',
    seanceFile: get(seanceFile) || '',
    exerciseId: get(currentPageId),
    showNotes: get(showNotes),
    folderName: get(folderLabel),
    screen: get(screen),
    area: get(navArea),
    door: get(navDoor),
    item: get(navItem),
    child: get(navChild)
  };
  try { sessionStorage.setItem(CURSOR_KEY, JSON.stringify(payload)); } catch { /* quota */ }
  if (!get(restoring)) publishAddress('push');
}

function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(value => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

function currentSeance(): SeanceFile | null {
  const header = get(seanceHeader);
  if (!header.id) return null;
  commitToActiveFrame();
  return {
    ...header,
    name: get(tacticName) || header.name || 'Séance',
    exercises: get(pages).map(page => migratePage(page))
  };
}

async function saveSnapshot() {
  persistCursor();
}

function applySeance(data: SeanceFile, file: string, exerciseId?: string, paths?: Record<string, string>) {
  applying = true;
  if (paths && Object.keys(paths).length) exercisePaths.set(paths);
  const exercises = (data.exercises || []).map(page => migratePage(page));
  seanceFile.set(file);
  seanceHeader.set({
    id: data.id,
    name: data.name || 'Séance',
    sheet: data.sheet || '',
    date: data.date || '',
    phase: data.phase || '',
    principle: data.principle || '',
    means: data.means || '',
    markdown: data.markdown || ''
  });
  pages.set(exercises);
  const wanted = exercises.find(page => page.id === exerciseId) || exercises[0];
  currentPageId.set(wanted?.id || '');
  tacticName.set(data.name || 'Séance');
  selectedIds.set([]);
  isDirty.set(false);
  applying = false;
}

async function ensureAccess(ask: boolean): Promise<boolean> {
  if (!root) return false;
  if (!(await permitted(root, ask))) {
    needsPermission.set(true);
    workspaceWritable.set(false);
    return false;
  }
  const wasLocked = !get(workspaceWritable);
  workspaceWritable.set(true);
  needsPermission.set(false);
  if (wasLocked && get(isDirty)) scheduleWorkspaceSave();
  return true;
}

export function scheduleWorkspaceSave() {
  // Le disque n’est écrit que par Ctrl+S ou le bouton Enregistrer.
}

export function startWorkspaceAutosave() {
  showNotes.subscribe(() => persistCursor());
  currentPageId.subscribe(() => persistCursor());
  window.addEventListener('beforeunload', () => { void saveSnapshot(); });
}

async function writeStyle(style: PageStyle) {
  if (!root) return;
  const catId = styleSources.get(style.id);
  const dir = catId
    ? await under(root, [THEMES_DIR, 'categories', catId, 'styles'], true)
    : await under(root, ['studio', 'styles'], true);
  await writeJson(dir, `${style.id}.json`, style);
}

let coachWrite: Promise<void> = Promise.resolve();
let portraitObjectUrl = '';

function showPortrait(url: string) {
  if (portraitObjectUrl) URL.revokeObjectURL(portraitObjectUrl);
  portraitObjectUrl = url.startsWith('blob:') ? url : '';
  portraitUrl.set(url);
}

function openSeasonId(): string {
  return get(navArea) === 'seasons' ? get(navItem) : '';
}

let workspaceCoach = '';

function finishCoach() {
  trainer.set({ type: WORKSPACE_TYPE, name: workspaceCoach });
}

function rememberCoach(name: string) {
  workspaceCoach = name.trim();
  finishCoach();
}

async function jpegBytes(file: File): Promise<Uint8Array | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

async function readPortraitUrl(playerId = ''): Promise<string> {
  const seasonId = playerId ? openSeasonId() : '';
  if (playerId && !seasonId) return '';
  const query = playerId ? `season=${encodeURIComponent(seasonId)}&player=${encodeURIComponent(playerId)}` : '';
  if (usesSharedDisk()) {
    try {
      const response = await fetch(`/api/workspace/portrait${query ? `?${query}` : ''}`, { cache: 'no-store' });
      if (!response.ok) return '';
      return URL.createObjectURL(await response.blob());
    } catch {
      return '';
    }
  }
  if (!root) return '';
  try {
    const dir = playerId ? await under(root, [...seasonId.split('/'), PLAYERS_DIR, playerId]) : root;
    const bytes = await readBytes(dir, playerId ? PLAYER_IMAGE : COACH_IMAGE);
    if (!bytes) return '';
    return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
  } catch {
    return '';
  }
}

export async function refreshPortrait() {
  showPortrait(await readPortraitUrl());
}

export async function playerPortraitUrl(playerId: string): Promise<string> {
  return readPortraitUrl(playerId);
}

async function storePortrait(file: File, playerId = ''): Promise<string | null> {
  const seasonId = playerId ? openSeasonId() : '';
  if (playerId) {
    const season = get(seasons).find(item => item.id === seasonId);
    if (!season) return 'Ouvre une saison.';
    if (!season.players.some(player => player.id === playerId)) return 'Ouvre un joueur.';
  }
  if (!file.type.startsWith('image/')) return 'Choisis une image.';
  if (file.size > 2 * 1024 * 1024) return 'Image trop lourde.';
  const bytes = await jpegBytes(file);
  if (!bytes || bytes.length > 2 * 1024 * 1024) return bytes ? 'Image trop lourde.' : 'Image impossible à enregistrer.';
  const handleOk = Boolean(root) && await ensureAccess(true);
  if (handleOk && root) {
    const dir = playerId ? await under(root, [...seasonId.split('/'), PLAYERS_DIR, playerId], true) : root;
    await writeBytes(dir, playerId ? PLAYER_IMAGE : COACH_IMAGE, bytes);
  }
  if (usesSharedDisk()) {
    try {
      const query = playerId ? `season=${encodeURIComponent(seasonId)}&player=${encodeURIComponent(playerId)}` : '';
      const response = await fetch(`/api/workspace/portrait${query ? `?${query}` : ''}`, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg' },
        body: bytes
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        return data.error || 'Image impossible à enregistrer.';
      }
    } catch {
      return 'Image impossible à enregistrer.';
    }
  } else if (!handleOk) {
    return 'Le dossier n’est pas accessible.';
  }
  if (!playerId) await refreshPortrait();
  return null;
}

export async function savePortrait(file: File): Promise<string | null> {
  return storePortrait(file);
}

export async function savePlayerPortrait(playerId: string, file: File): Promise<string | null> {
  return storePortrait(file, playerId);
}

async function persistCoach(name: string) {
  if (root) {
    try {
      const data = await readJson<Record<string, unknown>>(root, 'index.json');
      if (data) {
        const { type, ...rest } = data;
        delete rest.coach;
        await writeJson(root, 'index.json', { type: type || WORKSPACE_TYPE, coach: name, ...rest });
      }
    } catch { /* dossier non ouvert */ }
  }
  if (usesSharedDisk()) await postShared({ type: 'coach', name });
}

export function commitCoachName(name: string) {
  rememberCoach(name);
  const run = coachWrite.then(() => persistCoach(workspaceCoach));
  coachWrite = run.catch(() => undefined);
}

function usesSharedDisk(): boolean {
  const opened = root?.name || get(folderLabel);
  return !opened || opened === 'data';
}

type SharedDisk = {
  coach?: unknown;
  folder?: string;
  categories?: CategoryInfo[];
  styles?: PageStyle[];
  seasons?: SeasonInfo[];
  themes?: ThemeInfo[];
  library?: LibraryItem[];
};

type QuickView = {
  trainer?: { name?: string; folder?: string };
  seasons?: SeasonInfo[];
  themes?: ThemeInfo[];
  session?: { seance: SeanceFile; paths: Record<string, string>; theme?: { name?: string; markdown?: string } } | null;
  missing?: string;
};

async function readSharedView(pathname: string): Promise<QuickView | null> {
  if (!import.meta.env.DEV || !usesSharedDisk()) return null;
  try {
    const response = await fetch(`/api/workspace?view=${encodeURIComponent(pathname)}`);
    if (!response.ok) return null;
    return await response.json() as QuickView;
  } catch {
    return null;
  }
}

function viewReady(target: AddressTarget | null, view: QuickView): boolean {
  if (!target) return false;
  if (view.missing) return true;
  if (!target.door) return true;
  if (target.door === 'season') {
    if (!view.seasons) return false;
    if (!target.child) return true;
    const season = view.seasons.find(item => item.uuid === target.item || item.id === target.item);
    if (season?.players.some(player => player.id === target.child)) return true;
    return Boolean(view.session?.seance);
  }
  if (target.door === 'repertoire') return Boolean(view.themes) && (!target.child || Boolean(view.session?.seance));
  return false;
}

function applyQuickView(target: AddressTarget | null, view: QuickView) {
  try {
  if (view.trainer?.folder && !get(folderLabel)) folderLabel.set(view.trainer.folder);
  if (view.seasons) seasons.set(view.seasons);
  if (view.themes) themes.set(view.themes);
  workspaceOpen.set(true);
  workspaceWritable.set(true);
  needsPermission.set(false);
  ready = true;
  if (!target?.door) {
    navDoor.set('');
    navArea.set('');
    navLeaf.set('');
    screen.set('home');
    return;
  }
  navDoor.set(target.door);
  navArea.set(target.area);
  if (view.missing) {
    missingPage.set(view.missing);
    navItem.set('');
    navChild.set('');
    navLeaf.set('');
    screen.set('home');
    return;
  }
  if (target.door === 'season') {
    const season = get(seasons).find(item => item.uuid === target.item || item.id === target.item);
    navItem.set(season?.id || '');
    navChild.set(target.child);
    if (!target.item || !target.child) {
      screen.set('home');
      return;
    }
    if (season?.players.some(player => player.id === target.child)) {
      const player = season.players.find(item => item.id === target.child);
      navLeaf.set(target.exercise && player?.evaluations.includes(target.exercise) ? target.exercise : '');
      screen.set('home');
      return;
    }
    navLeaf.set('');
    if (!view.session?.seance) return;
    applySeance(view.session.seance, target.child, target.exercise, view.session.paths);
    rememberTheme(target.child, view.session.theme ? { name: view.session.theme.name || '', markdown: view.session.theme.markdown || '' } : undefined);
    applySeasonView(target.child, season);
    screen.set(target.exercise && get(pages).some(page => page.id === target.exercise) ? 'exercise' : 'seance');
    return;
  }
  if (target.door === 'repertoire') {
    const theme = get(themes).find(item => item.uuid === target.item || item.id === target.item);
    navItem.set(theme?.id || '');
    navChild.set(target.child);
    navLeaf.set('');
    if (!target.item || !target.child) {
      seasonSelection.set(null);
      screen.set('home');
      return;
    }
    if (!view.session?.seance) return;
    applySeance(view.session.seance, target.child, target.exercise, view.session.paths);
    rememberTheme(target.child, view.session.theme ? { name: view.session.theme.name || '', markdown: view.session.theme.markdown || '' } : undefined);
    seasonSelection.set(null);
    screen.set(target.exercise && get(pages).some(page => page.id === target.exercise) ? 'exercise' : 'seance');
  }
  } finally {
    if (typeof view.trainer?.name === 'string') rememberCoach(view.trainer.name);
    else finishCoach();
  }
}

async function readSharedDisk(): Promise<SharedDisk | null> {
  if (!import.meta.env.DEV || !usesSharedDisk()) return null;
  try {
    const response = await fetch('/api/workspace');
    if (!response.ok) return null;
    return await response.json() as SharedDisk;
  } catch {
    return null;
  }
}

async function readSharedSeance(categoryId: string, seanceId: string): Promise<{ seance: SeanceFile; paths: Record<string, string>; theme: { name: string; markdown: string } } | null> {
  if (!import.meta.env.DEV || !usesSharedDisk()) return null;
  try {
    const response = await fetch(`/api/workspace?category=${encodeURIComponent(categoryId)}&seance=${encodeURIComponent(seanceId)}`);
    if (!response.ok) return null;
    const data = await response.json() as { seance?: SeanceFile | null; paths?: Record<string, string>; theme?: { name?: string; markdown?: string } };
    if (!data.seance) return null;
    return {
      seance: data.seance,
      paths: data.paths || {},
      theme: { name: data.theme?.name || '', markdown: data.theme?.markdown || '' }
    };
  } catch {
    return null;
  }
}

async function readSharedSeances(id: string): Promise<SeanceRef[] | null> {
  if (!import.meta.env.DEV || !usesSharedDisk()) return null;
  try {
    const response = await fetch(`/api/workspace?category=${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    const data = await response.json() as { seances?: SeanceRef[] };
    return data.seances || [];
  } catch {
    return null;
  }
}

async function postShared(body: unknown): Promise<string | null> {
  const sent = await postJson(body);
  return sent.error || null;
}

async function postJson<T>(body: unknown): Promise<{ data?: T; error?: string }> {
  if (!import.meta.env.DEV) return { error: 'Le dossier n’est pas accessible.' };
  try {
    const response = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) return { error: data.error || 'Enregistrement impossible.' };
    return { data };
  } catch {
    return { error: 'Enregistrement impossible.' };
  }
}

async function markdownFrom(name: TemplateName, values: Record<string, string>): Promise<string> {
  const filled = fillTemplate(await readTemplate(name), values).replace(/\n+$/, '');
  const title = values.name || values.date || '';
  return `${filled || (title ? `# ${title}` : '')}\n`;
}

function applySharedDisk(info: SharedDisk) {
  if (!get(folderLabel)) folderLabel.set(info.folder || 'data');
  categories.set(info.categories || []);
  if (info.styles) styles.set(info.styles);
  seasons.set(info.seasons || []);
  themes.set(info.themes || []);
  libraryItems.set(info.library || []);
  rememberCoach(coachName(info.coach));
}

async function reloadSharedWorkspace() {
  if (!get(workspaceOpen)) return;
  const info = await readSharedDisk();
  if (info) applySharedDisk(info);
}

function repertoireSession(node: IndexNode, id: string): boolean {
  return node.data.type === SEANCE_TYPE && node.data.id === id && node.segments[0] === THEMES_DIR && node.segments.length === 3;
}

function shiftPaths(from: string, to: string) {
  if (!from || from === to) return;
  exercisePaths.update(map => {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(map)) next[key] = value.startsWith(from) ? `${to}${value.slice(from.length)}` : value;
    return next;
  });
}

async function renameDir(parent: Dir, current: string, title: string): Promise<string> {
  const desired = folderSlug(title);
  if (!desired || desired === current) return current;
  try {
    await parent.getDirectoryHandle(desired);
    return current;
  } catch { /* le nom est libre */ }
  try {
    const handle = await parent.getDirectoryHandle(current);
    const movable = handle as FileSystemDirectoryHandle & { move?: (name: string) => Promise<void> };
    if (!movable.move) return current;
    await movable.move(desired);
    return desired;
  } catch {
    return current;
  }
}

export async function saveSessionMarkdown(markdown: string): Promise<boolean> {
  const id = get(seanceHeader).id;
  if (!id) return false;
  const text = `${markdown.replace(/\r\n/g, '\n').replace(/\n+$/, '')}\n`;
  const handleOk = Boolean(root) && await ensureAccess(false);
  let folder = '';
  if (handleOk && root) {
    const nodes: IndexNode[] = [];
    await collectIndexes(root, [], nodes);
    const session = nodes.find(node => repertoireSession(node, id));
    if (!session) return false;
    await writeText(await dirAt(root, session.segments), 'content.md', text);
    folder = await renameDir(await dirAt(root, session.segments.slice(0, -1)), session.segments[2] || '', markdownTitle(text));
  } else if (usesSharedDisk()) {
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'save-session-markdown', explicit: true, id, markdown: text })
      });
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({})) as { folder?: string };
      folder = data.folder || '';
    } catch {
      return false;
    }
  } else {
    return false;
  }
  const title = markdownTitle(text);
  seanceHeader.update(header => ({ ...header, markdown: text, name: title || header.name }));
  const theme = get(themes).find(item => item.sessions.some(session => session.id === id));
  const previous = theme?.sessions.find(session => session.id === id)?.folder || '';
  if (title) tacticName.set(title);
  themes.update(list => list.map(item => ({
    ...item,
    sessions: item.sessions.map(session => session.id === id ? { ...session, name: title || session.name, folder: folder || session.folder } : session)
  })));
  seasons.update(list => list.map(season => ({
    ...season,
    slots: season.slots.map(slot => slot.session === id ? { ...slot, sessionName: title || slot.sessionName } : slot)
  })));
  if (theme && previous && folder && folder !== previous) shiftPaths(`${THEMES_DIR}/${theme.id}/${previous}/`, `${THEMES_DIR}/${theme.id}/${folder}/`);
  return true;
}

export async function saveThemeMarkdown(themeId: string, markdown: string): Promise<boolean> {
  const theme = get(themes).find(item => item.id === themeId || item.uuid === themeId);
  if (!theme) return false;
  const text = `${markdown.replace(/\r\n/g, '\n').replace(/\n+$/, '')}\n`;
  const handleOk = Boolean(root) && await ensureAccess(false);
  let folder = theme.id;
  if (handleOk && root) {
    const dir = await under(root, [THEMES_DIR, theme.id]);
    await writeText(dir, 'content.md', text);
    folder = await renameDir(await under(root, [THEMES_DIR]), theme.id, markdownTitle(text));
  } else if (usesSharedDisk()) {
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'save-theme-markdown', explicit: true, id: theme.uuid || theme.id, markdown: text })
      });
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({})) as { folder?: string };
      folder = data.folder || theme.id;
    } catch {
      return false;
    }
  } else {
    return false;
  }
  const title = markdownTitle(text);
  sessionTheme.update(current => ({ ...current, markdown: text, name: title || current.name }));
  themes.update(list => list.map(item => item.id === theme.id ? { ...item, id: folder, name: title || item.name } : item));
  if (get(navItem) === theme.id) navItem.set(folder);
  if (folder !== theme.id) shiftPaths(`${THEMES_DIR}/${theme.id}/`, `${THEMES_DIR}/${folder}/`);
  persistCursor();
  return true;
}

export async function saveSeasonMarkdown(markdown: string): Promise<boolean> {
  const season = get(seasons).find(item => item.id === get(navItem));
  if (!season) return false;
  const text = `${markdown.replace(/\r\n/g, '\n').replace(/\n+$/, '')}\n`;
  const current = season.id.split('/')[1] || '';
  const handleOk = Boolean(root) && await ensureAccess(false);
  let folder = current;
  if (handleOk && root) {
    const dir = await under(root, [SEASONS_DIR, current]);
    await writeText(dir, 'content.md', text);
    folder = await renameDir(await under(root, [SEASONS_DIR]), current, markdownTitle(text));
  } else if (usesSharedDisk()) {
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'save-season-markdown', explicit: true, id: season.uuid || season.id, markdown: text })
      });
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({})) as { folder?: string };
      folder = data.folder || current;
    } catch {
      return false;
    }
  } else {
    return false;
  }
  const title = markdownTitle(text);
  const nextId = `${SEASONS_DIR}/${folder}`;
  seasons.update(list => list.map(item => item.id === season.id ? { ...item, id: nextId, name: title || item.name } : item));
  if (get(navItem) === season.id) navItem.set(nextId);
  persistCursor();
  if (folder !== current) void refreshPortrait();
  return true;
}

function rememberSlotExercises(seasonId: string, sessionId: string, ids: string[]) {
  seasons.update(list => list.map(season => {
    if (season.id !== seasonId && season.uuid !== seasonId) return season;
    let found = false;
    const slots = season.slots.map(slot => {
      if (slot.session !== sessionId) return slot;
      found = true;
      return { ...slot, exercises: ids };
    });
    if (!found) slots.push({ date: '', session: sessionId, sessionName: get(seanceHeader).name, exercises: ids });
    return { ...season, slots };
  }));
}

async function writeHandleSlotExercises(workspace: Dir, seasonId: string, sessionId: string, ids: string[]): Promise<string | null> {
  const nodes: IndexNode[] = [];
  await collectIndexes(workspace, [], nodes);
  const season = nodes.find(node => node.data.type === SEASON_TYPE && (node.segments.join('/') === seasonId || node.data.id === seasonId));
  if (!season) return 'Cette saison n’existe pas.';
  const slots = season.data.slots || [];
  let found = false;
  for (const slot of slots) {
    if (String(slot.session || '') !== sessionId) continue;
    slot.exercises = ids;
    found = true;
  }
  if (!found) slots.push({ date: '', session: sessionId, exercises: ids });
  season.data.slots = slots;
  await writeJson(await dirAt(workspace, season.segments), 'index.json', season.data);
  return null;
}

export async function saveSeasonExercises(ids: string[]): Promise<string | null> {
  const seasonId = get(navItem);
  const sessionId = get(navChild);
  if (get(navArea) !== 'seasons' || !seasonId || !sessionId) return 'Cette saison n’est pas ouverte.';
  const handleOk = Boolean(root) && await ensureAccess(false);
  if (handleOk && root) {
    const error = await writeHandleSlotExercises(root, seasonId, sessionId, ids);
    if (error) return error;
  } else if (usesSharedDisk()) {
    const error = await postShared({ type: 'save-slot-exercises', explicit: true, season: seasonId, session: sessionId, exercises: ids });
    if (error) return error;
  } else {
    return 'Le dossier n’est pas accessible.';
  }
  rememberSlotExercises(seasonId, sessionId, ids);
  seasonSelection.set(ids);
  return null;
}

export async function saveOpenSeance() {
  if (!get(workspaceOpen) || saving) return;
  saving = true;
  try {
    const seance = currentSeance();
    await saveSnapshot();
    await coachWrite;
    const cat = get(categoryInfo);
    const file = get(seanceFile);
    const handleOk = Boolean(root) && await ensureAccess(false);
    if (handleOk && root) {
      for (const style of get(styles)) await writeStyle(style);
      if (seance && file) await saveHandleSeance(root, cat?.id || '', file, seance);
    } else if (seance && file && usesSharedDisk()) {
      try {
        const response = await fetch('/api/workspace', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...seanceIndex(seance),
            type: 'save-seance',
            explicit: true,
            category: cat?.id || '',
            id: file,
            exercises: seance.exercises
          })
        });
        if (!response.ok) return;
        const data = await response.json().catch(() => ({})) as { paths?: Record<string, string> };
        if (data.paths && Object.keys(data.paths).length) exercisePaths.set(data.paths);
      } catch {
        return;
      }
    } else if (!handleOk) {
      return;
    }
    isDirty.set(false);
  } catch (err) {
    console.error(err);
  } finally {
    saving = false;
    if (savePending) {
      savePending = false;
      scheduleWorkspaceSave();
    }
  }
}

async function listCategories(dir: Dir): Promise<CategoryInfo[]> {
  const out: CategoryInfo[] = [];
  try {
    const categoriesDir = await under(dir, [THEMES_DIR, 'categories']);
    for await (const [name, handle] of categoriesDir.entries()) {
      if (handle.kind !== 'directory') continue;
      const info = await readJson<{ type?: string; name?: string; audience?: string; id?: string }>(handle as Dir, 'index.json');
      if (!info || (info.type && info.type !== CATEGORY_TYPE)) continue;
      out.push({
        id: name,
        name: info.name?.trim() ? info.name : name,
        audience: info.audience || '',
        uuid: info.id || ''
      });
    }
  } catch { /* no categories yet */ }
  out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return out;
}

function categoryIndex(name: string) {
  return { type: CATEGORY_TYPE, name };
}

function seanceIndex(seance: SeanceFile) {
  return orderSessionIndex({
    type: SEANCE_TYPE,
    id: seance.id,
    exercises: seance.exercises.map(page => page.id).filter(Boolean)
  });
}

async function removeChild(dir: Dir, name: string) {
  await (dir as FileSystemDirectoryHandle).removeEntry(name, { recursive: true });
}

async function writeSeanceTree(categoryDir: Dir, seanceId: string, seance: SeanceFile) {
  const dir = await childDir(await childDir(categoryDir, 'seances', true), seanceId, true);
  await writeJson(dir, 'index.json', seanceIndex(seance));
  const keep = new Set(seance.exercises.map(page => page.id));
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'directory' || keep.has(name)) continue;
    const info = await readJson<{ type?: string }>(handle as Dir, 'index.json');
    if (info?.type === EXERCISE_TYPE) await removeChild(dir, name);
  }
  for (const [index, page] of seance.exercises.entries()) {
    await storeExercise(await childDir(dir, page.id, true), page);
  }
}

async function readSeanceFolder(parent: Dir, id: string): Promise<SeanceFile | null> {
  const dir = await childDir(parent, id);
  const info = await readJson<SeanceHeader & { type?: string }>(dir, 'index.json');
  if (!info || info.type !== SEANCE_TYPE) return null;
  const found: Array<{ folder: string; page: Page }> = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'directory') continue;
    const page = await loadExercise(handle as Dir);
    if (!page) continue;
    const { type: _type, ...rest } = page;
    found.push({ folder: name, page: migratePage({ ...rest, id: rest.id || name }) });
  }
  found.sort((a, b) => a.folder.localeCompare(b.folder, 'fr', { numeric: true }));
  const seen = new Set<string>();
  const exercises = orderByIds(found.flatMap(({ page }) => {
    if (seen.has(page.id)) return [];
    seen.add(page.id);
    return [page];
  }), (info as { exercises?: unknown }).exercises);
  const markdown = (await readText(dir, 'content.md')) || '';
  return {
    id,
    name: info.name || markdownTitle(markdown) || id,
    sheet: info.sheet || 'S1',
    date: info.date || '',
    phase: info.phase || '',
    principle: info.principle || '',
    means: info.means || '',
    markdown,
    exercises
  };
}

async function listSeances(folder: Dir): Promise<SeanceRef[]> {
  const out: SeanceRef[] = [];
  try {
    const dir = await childDir(folder, 'seances');
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'directory') continue;
      const info = await readJson<{ type?: string; name?: string; sheet?: string }>(handle as Dir, 'index.json');
      if (!info || info.type !== SEANCE_TYPE) continue;
      out.push({ file: name, name: info.name?.trim() || name, sheet: info.sheet || 'S1' });
    }
  } catch { /* empty */ }
  out.sort((a, b) => a.sheet.localeCompare(b.sheet, 'fr', { numeric: true }) || a.name.localeCompare(b.name, 'fr'));
  return out;
}

const SEASON_TYPE = 'fccn-season:0';

type IndexNode = {
  segments: string[];
  title?: string;
  data: {
    type?: string;
    id?: string;
    name?: string;
    sheet?: string;
    date?: string;
    order?: number;
    audience?: string;
    phase?: string;
    principle?: string;
    means?: string;
    slots?: Array<{ date?: string; session?: string; exercises?: string[] }>;
    coach?: unknown;
    players?: unknown;
    exercises?: string[];
    sessions?: string[];
    themes?: string[];
  };
};

async function collectIndexes(dir: Dir, segments: string[], out: IndexNode[], depth = 0) {
  if (depth > 8) return;
  let entries: Array<[string, FileSystemHandle]> = [];
  try {
    for await (const entry of dir.entries()) entries.push(entry);
  } catch { return; }
  for (const [name, handle] of entries) {
    if (handle.kind === 'directory') await collectIndexes(handle as Dir, [...segments, name], out, depth + 1);
    else if (name === 'index.json') {
      const data = await readJson<IndexNode['data']>(dir, 'index.json');
      if (!data) continue;
      let title = '';
      if ((data.type === SEANCE_TYPE || data.type === 'fccn-theme:0' || data.type === SEASON_TYPE) && !data.name?.trim()) title = markdownTitle((await readText(dir, 'content.md')) || '');
      out.push({ segments: segments.slice(), data, title });
    }
  }
}

async function dirAt(start: Dir, segments: string[]): Promise<Dir> {
  let current = start;
  for (const name of segments) current = await childDir(current, name);
  return current;
}

async function listLibrary(dir: Dir): Promise<LibraryItem[]> {
  const out: LibraryItem[] = [];
  let library: Dir;
  try { library = await under(dir, ['studio', 'library']); } catch { return out; }
  for await (const [domain, domainHandle] of library.entries()) {
    if (domainHandle.kind !== 'directory') continue;
    for await (const [kind, kindHandle] of (domainHandle as Dir).entries()) {
      if (kindHandle.kind !== 'directory' || !LIBRARY_KINDS.some(item => item.id === kind)) continue;
      for await (const [file, fileHandle] of (kindHandle as Dir).entries()) {
        if (fileHandle.kind !== 'file' || !/\.(svg|ya?ml)$/i.test(file)) continue;
        out.push({
          domain,
          kind: kind as LibraryKind,
          name: file.replace(/\.(svg|ya?ml)$/i, ''),
          file: `studio/library/${domain}/${kind}/${file}`
        });
      }
    }
  }
  out.sort((a, b) => a.domain.localeCompare(b.domain, 'fr') || a.kind.localeCompare(b.kind, 'fr') || a.name.localeCompare(b.name, 'fr'));
  return out;
}

function sessionNameOf(node: Pick<IndexNode, 'title' | 'data'> | undefined, fallback = ''): string {
  return node?.title?.trim() || node?.data.name?.trim() || fallback;
}

async function readPlayers(dir: Dir, names: unknown): Promise<SeasonPlayer[]> {
  const players: SeasonPlayer[] = [];
  for (const name of playerNames(names)) {
    const id = folderSlug(name);
    if (!id) continue;
    const evaluations: string[] = [];
    try {
      const evals = await under(dir, [PLAYERS_DIR, id, EVALUATIONS_DIR]);
      for await (const [file, fileHandle] of evals.entries()) {
        const match = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(file);
        if (fileHandle.kind === 'file' && match) evaluations.push(match[1]);
      }
    } catch { /* pas encore d'évaluations */ }
    evaluations.sort();
    players.push({ id, name, evaluations });
  }
  return players;
}

async function readHandleBrowse(dir: Dir) {
  const nodes: IndexNode[] = [];
  await collectIndexes(dir, [], nodes);
  const seasonNodes = nodes.filter(node => node.data.type === SEASON_TYPE && node.segments[0] === SEASONS_DIR && node.segments.length === 2);
  const seasonList: SeasonInfo[] = await Promise.all(seasonNodes.map(async node => {
    const folder = node.segments[1];
    const slots = (node.data.slots || []).map(slot => {
      const sessionId = String(slot.session || '');
      const session = nodes.find(item => item.data.type === SEANCE_TYPE && item.data.id === sessionId);
      return {
        date: slot.date || '',
        session: sessionId,
        sessionName: sessionNameOf(session, sessionId),
        exercises: Array.isArray(slot.exercises) ? slot.exercises.filter(id => id !== '') : undefined
      };
    });
    return {
      id: node.segments.join('/'),
      uuid: node.data.id || '',
      name: node.title || node.data.name || folder,
      players: await readPlayers(await dirAt(dir, node.segments), node.data.players),
      slots
    };
  }));
  seasonList.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  seasons.set(seasonList);
  themes.set(themesOf(nodes));
  libraryItems.set(await listLibrary(dir));
}

function themesOf(nodes: IndexNode[]): ThemeInfo[] {
  const repertoire = nodes.find(node => node.data.type === REPERTOIRE_TYPE && node.segments.join('/') === THEMES_DIR);
  const list = nodes.filter(node => node.data.type === 'fccn-theme:0' && node.segments[0] === THEMES_DIR && node.segments.length === 2).map(node => {
    const id = node.segments[1];
    const sessions = nodes
      .filter(item => item.data.type === SEANCE_TYPE && item.segments[0] === THEMES_DIR && item.segments[1] === id && item.segments.length === 3)
      .sort((a, b) => (a.data.order || 0) - (b.data.order || 0) || sessionNameOf(a).localeCompare(sessionNameOf(b), 'fr'))
      .map(item => ({
        id: item.data.id || item.segments[2] || '',
        folder: item.segments[2] || '',
        name: sessionNameOf(item)
      }));
    return { id, name: node.title || node.data.name || id, uuid: node.data.id || '', sessions: orderByIds(sessions, node.data.sessions) };
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return orderByIds(list, repertoire?.data.themes, themeKey);
}

async function writeThemeOrder(workspace: Dir, keys: string[]) {
  const dir = await under(workspace, [THEMES_DIR], true);
  const current = await readJson<Record<string, unknown>>(dir, 'index.json');
  await writeJson(dir, 'index.json', { type: REPERTOIRE_TYPE, ...current, themes: keys });
}

async function writeSessionOrder(themeDir: Dir, keys: string[]) {
  const current = await readJson<Record<string, unknown>>(themeDir, 'index.json');
  await writeJson(themeDir, 'index.json', orderThemeIndex({ ...current, sessions: keys }));
}

function seasonsFor(_nodes: IndexNode[], _categoryId: string, _categoryUuid: string) {
  return [];
}

async function listCategorySeances(workspace: Dir, categoryId: string): Promise<SeanceRef[]> {
  const nodes: IndexNode[] = [];
  await collectIndexes(workspace, [], nodes);
  const category = nodes.find(node => node.segments.join('/') === `${THEMES_DIR}/categories/${categoryId}`);
  const seasons = seasonsFor(nodes, categoryId, category?.data.id || '');
  const slots = seasons.flatMap(season => season.data.slots || []);
  if (slots.length) {
    const refs = slots.map(slot => {
      const sessionId = String(slot.session || '');
      const session = nodes.find(node => node.data.type === SEANCE_TYPE && node.data.id === sessionId);
      return {
        file: sessionId,
        name: sessionNameOf(session, sessionId),
        sheet: '',
        date: slot.date || ''
      };
    });
    refs.sort((a, b) => frenchDateOrder(a.date) - frenchDateOrder(b.date) || a.sheet.localeCompare(b.sheet, 'fr', { numeric: true }));
    return refs;
  }
  try {
    return await listSeances(await under(workspace, [THEMES_DIR, 'categories', categoryId]));
  } catch {
    return [];
  }
}

async function readSessionDirectory(dir: Dir, rel: string, header: SeanceHeader, order: unknown = []): Promise<{ seance: SeanceFile; paths: Record<string, string> }> {
  const found: Array<{ folder: string; page: Page & { type?: string } }> = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'directory') continue;
    const page = await loadExercise(handle as Dir);
    if (!page) continue;
    found.push({ folder: name, page });
  }
  found.sort((a, b) => a.folder.localeCompare(b.folder, 'fr', { numeric: true }));
  const paths: Record<string, string> = {};
  const seen = new Set<string>();
  const exercises = orderByIds(found.flatMap(({ folder, page }) => {
    const { type: _type, ...rest } = page;
    const id = rest.id || folder;
    if (seen.has(id)) return [];
    seen.add(id);
    paths[id] = `${rel}/${folder}`;
    return [migratePage({ ...rest, id })];
  }), order);
  return { seance: { ...header, markdown: (await readText(dir, 'content.md')) || '', exercises }, paths };
}

async function readHandleSeance(workspace: Dir, categoryId: string, file: string): Promise<{ seance: SeanceFile; paths: Record<string, string>; theme: { name: string; markdown: string } } | null> {
  const nodes: IndexNode[] = [];
  await collectIndexes(workspace, [], nodes);
  const session = nodes.find(node => node.data.type === SEANCE_TYPE && (node.data.id === file || node.segments.join('/') === `${THEMES_DIR}/categories/${categoryId}/seances/${file}`));
  if (!session) {
    try {
      const parent = await under(workspace, [THEMES_DIR, 'categories', categoryId, 'seances']);
      const data = await readSeanceFolder(parent, file);
      if (!data) return null;
      const paths: Record<string, string> = {};
      for (const page of data.exercises) paths[page.id] = `${THEMES_DIR}/categories/${categoryId}/seances/${file}/${page.id}`;
      return { seance: data, paths, theme: { name: '', markdown: '' } };
    } catch {
      return null;
    }
  }
  const header: SeanceHeader = {
    id: session.data.id || file,
    name: sessionNameOf(session, file),
    sheet: session.data.sheet || '',
    date: session.data.date || '',
    phase: session.data.phase || '',
    principle: session.data.principle || '',
    means: session.data.means || ''
  };
  const loaded = await readSessionDirectory(await dirAt(workspace, session.segments), session.segments.join('/'), header, session.data.exercises);
  return { ...loaded, theme: await readThemeText(workspace, session.segments) };
}

async function readThemeText(workspace: Dir, segments: string[]): Promise<{ name: string; markdown: string }> {
  if (segments.length < 2) return { name: '', markdown: '' };
  const dir = await dirAt(workspace, segments.slice(0, 2));
  const info = await readJson<{ name?: string }>(dir, 'index.json');
  const markdown = (await readText(dir, 'content.md')) || '';
  return { name: info?.name || markdownTitle(markdown), markdown };
}

function rememberFolder(folders: Map<string, string>, id: string, name: string) {
  const current = folders.get(id);
  if (!current || (isUuidFolder(current) && !isUuidFolder(name))) folders.set(id, name);
}

async function keepSchema(from: Dir, to: Dir) {
  const schema = await readText(from, 'schema.yaml');
  if (schema === null || await readText(to, 'schema.yaml') !== null) return;
  await writeText(to, 'schema.yaml', schema);
}

async function writeExerciseFolders(dir: Dir, exercises: Page[], prefix: string): Promise<Record<string, string>> {
  const folders = new Map<string, string>();
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'directory') continue;
    const info = await readJson<{ type?: string; id?: string }>(handle as Dir, 'index.json');
    if (info?.type === EXERCISE_TYPE) rememberFolder(folders, info.id || name, name);
  }
  const keep = new Set<string>();
  const paths: Record<string, string> = {};
  const used = new Set(folders.values());
  for (const page of exercises) {
    let folder = folders.get(page.id);
    if (!folder) {
      if (directoryNameIssue(page.id, 'répertoire')) continue;
      folder = page.id;
    }
    const desired = page.name?.trim() ? exerciseFolder(page.name) : '';
    if (desired && desired !== folder && await hasDirectory(dir, desired)) {
      const owner = await readJson<{ id?: string }>(await childDir(dir, desired), 'index.json');
      if (!owner?.id || owner.id === page.id) {
        folder = desired;
        folders.set(page.id, desired);
      }
    } else if (desired && desired !== folder && !used.has(desired)) {
      try {
        const handle = await dir.getDirectoryHandle(folder);
        const movable = handle as FileSystemDirectoryHandle & { move?: (name: string) => Promise<void> };
        if (movable.move) {
          await movable.move(desired);
          used.delete(folder);
          used.add(desired);
          folders.set(page.id, desired);
          folder = desired;
        }
      } catch { /* le dossier numéroté reste à créer sous l'identifiant */ }
    }
    keep.add(folder);
    paths[page.id] = `${prefix}/${folder}`;
    await storeExercise(await childDir(dir, folder, true), page);
  }
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'directory' || keep.has(name)) continue;
    const info = await readJson<{ type?: string; id?: string }>(handle as Dir, 'index.json');
    if (info?.type !== EXERCISE_TYPE) continue;
    const survivor = info.id ? folders.get(info.id) : '';
    if (survivor && survivor !== name) await keepSchema(handle as Dir, await childDir(dir, survivor, true));
    if (await readText(handle as Dir, 'schema.yaml') !== null) {
      const kept = survivor ? await readText(await childDir(dir, survivor, true), 'schema.yaml') : null;
      if (kept === null) continue;
    }
    await removeChild(dir, name);
  }
  return paths;
}

async function saveHandleSeance(workspace: Dir, _categoryId: string, _file: string, seance: SeanceFile) {
  const nodes: IndexNode[] = [];
  await collectIndexes(workspace, [], nodes);
  const session = nodes.find(node => repertoireSession(node, seance.id));
  if (!session) return;
  const dir = await dirAt(workspace, session.segments);
  await writeJson(dir, 'index.json', orderSessionIndex({
    ...session.data,
    type: SEANCE_TYPE,
    id: session.data.id,
    exercises: seance.exercises.map(page => page.id).filter(Boolean)
  }));
  exercisePaths.set(await writeExerciseFolders(dir, seance.exercises, session.segments.join('/')));
}

async function listStyles(folder: Dir): Promise<PageStyle[]> {
  const out: PageStyle[] = [];
  try {
    const dir = await childDir(folder, 'styles');
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
      const style = await readJson<PageStyle>(dir, name);
      if (style?.id) out.push(style);
    }
  } catch { /* empty */ }
  return out;
}

async function listAllStyles(handle: Dir): Promise<PageStyle[]> {
  styleSources.clear();
  const out: PageStyle[] = [];
  try {
    for (const style of await listStyles(await childDir(handle, 'studio'))) {
      styleSources.set(style.id, null);
      out.push(style);
    }
  } catch { /* pas encore d'atelier */ }
  for (const cat of await listCategories(handle)) {
    const folder = await under(handle, [THEMES_DIR, 'categories', cat.id]);
    for (const style of await listStyles(folder)) {
      if (styleSources.has(style.id)) continue;
      styleSources.set(style.id, cat.id);
      out.push(style);
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return out;
}

async function isEmptyDir(dir: Dir): Promise<boolean> {
  for await (const _entry of dir.entries()) return false;
  return true;
}

async function hasDirectory(dir: Dir, name: string): Promise<boolean> {
  try {
    await dir.getDirectoryHandle(name);
    return true;
  } catch {
    return false;
  }
}

function uniqueSlug(base: string, used: Set<string>): string {
  let name = slug(base);
  let n = 2;
  while (used.has(name)) name = `${slug(base)}-${n++}`;
  return name;
}

export const breadcrumbEpoch = writable(0);
export const missingPage = writable('');

async function releaseExercise(): Promise<boolean> {
  missingPage.set('');
  if (get(screen) !== 'exercise') return true;
  const ok = await confirmLeaveExercise();
  if (!ok) breadcrumbEpoch.update(n => n + 1);
  return ok;
}

export async function showHome() {
  if (!(await releaseExercise())) return;
  navDoor.set('');
  navArea.set('');
  navItem.set('');
  navChild.set('');
  navLeaf.set('');
  screen.set('home');
  finishCoach();
  persistCursor();
}

export async function openDoor(door: WorkspaceDoor) {
  if (!(await releaseExercise())) return;
  navDoor.set(door);
  navItem.set('');
  navChild.set('');
  navLeaf.set('');
  navArea.set(door === 'season' ? 'seasons' : door === 'repertoire' ? 'themes' : '');
  screen.set('home');
  finishCoach();
  persistCursor();
}

export async function openArea(area: WorkspaceArea | '') {
  if (!(await releaseExercise())) return;
  navDoor.set(doorOf(area));
  navArea.set(area);
  navItem.set('');
  navChild.set('');
  navLeaf.set('');
  screen.set('home');
  finishCoach();
  persistCursor();
}

export async function openNavItem(id: string) {
  if (!(await releaseExercise())) return;
  navItem.set(id);
  navChild.set('');
  navLeaf.set('');
  const area = get(navArea);
  if (area === 'categories' && id) {
    await showCategory(id);
    return;
  }
  screen.set('home');
  finishCoach();
  persistCursor();
}

export function openEvaluation(date: string) {
  navLeaf.set(date);
  persistCursor();
}

export function closeEvaluation() {
  navLeaf.set('');
  persistCursor();
}

export async function openNavChild(id: string) {
  if (!(await releaseExercise())) return;
  navLeaf.set('');
  navChild.set(id);
  const area = get(navArea);
  if (!id) {
    screen.set(area === 'categories' && get(navItem) ? 'category' : 'home');
    persistCursor();
    return;
  }
  if (area === 'categories') {
    await showSeance(id);
    return;
  }
  if (area === 'themes') {
    await openThemeSession(id);
    return;
  }
  if (area === 'seasons') {
    const season = get(seasons).find(item => item.id === get(navItem));
    if (season?.players.some(player => player.id === id)) {
      screen.set('home');
      persistCursor();
      return;
    }
    await openSeasonSession(id);
    return;
  }
  screen.set('home');
  persistCursor();
}

async function openThemeSession(file: string) {
  const theme = get(themes).find(item => item.id === get(navItem));
  if (!theme?.sessions.some(item => item.id === file)) return;
  await loadSessionScreen(file);
}

async function openSeasonSession(file: string) {
  const season = get(seasons).find(item => item.id === get(navItem));
  if (!season?.slots.some(slot => slot.session === file)) return;
  await loadSessionScreen(file, season);
}

function applySeasonView(file: string, season: SeasonInfo | undefined) {
  if (!season) {
    seasonSelection.set(null);
    return;
  }
  const chosen = season.slots.find(slot => slot.session === file && Array.isArray(slot.exercises));
  seasonSelection.set(chosen?.exercises ?? []);
}

function rememberTheme(file: string, theme?: { name: string; markdown: string }) {
  const known = get(themes).find(item => item.sessions.some(session => session.id === file));
  sessionTheme.set({
    name: theme?.name || known?.name || '',
    markdown: theme?.markdown || ''
  });
}

async function loadSessionScreen(file: string, season?: SeasonInfo) {
  const categoryId = season ? 'themes' : (get(categoryInfo)?.id || 'themes');
  const known = get(exercisePaths);
  const openPages = get(pages);
  const pathsReady = openPages.length > 0 && openPages.every(page => page.id && known[page.id]);
  if (file === get(seanceFile) && get(seanceHeader).id && pathsReady) {
    applySeasonView(file, season);
    screen.set('seance');
    persistCursor();
    return;
  }
  let loaded = usesSharedDisk() ? await readSharedSeance(categoryId, file) : null;
  if (!loaded && root && await ensureAccess(true)) loaded = await readHandleSeance(root, categoryId, file);
  if (!loaded) return;
  applySeance(loaded.seance, file, undefined, loaded.paths);
  rememberTheme(file, loaded.theme);
  applySeasonView(file, season);
  screen.set('seance');
  await saveSnapshot();
  persistCursor();
}

export async function showCategory(id: string) {
  if (!(await releaseExercise())) return;
  const info = get(categories).find(cat => cat.id === id);
  if (!info) return;
  let listed = usesSharedDisk() ? await readSharedSeances(id) : null;
  if (!listed && root && await ensureAccess(true)) listed = await listCategorySeances(root, info.id);
  if (!listed) return;
  categoryInfo.set(info);
  seanceList.set(listed);
  if (!listed.some(item => item.file === get(seanceFile))) seanceFile.set(null);
  screen.set('category');
  await saveSnapshot();
  persistCursor();
}

export async function showSeance(file: string) {
  if (!(await releaseExercise())) return;
  if (file !== get(seanceFile)) await openSeance(file);
  screen.set('seance');
  persistCursor();
}

export async function showSeanceScreen() {
  if (!(await releaseExercise())) return;
  screen.set('seance');
  persistCursor();
}

export async function showExercise(id: string) {
  if (get(screen) === 'exercise' && get(currentPageId) === id) return;
  if (!(await releaseExercise())) return;
  screen.set('exercise');
  if (get(pages).some(page => page.id === id)) currentPageId.set(id);
  persistCursor();
}

export async function renameCategory(id: string, name: string): Promise<string | null> {
  const issue = directoryNameIssue(name);
  if (issue) return issue;
  const label = name.trim();
  if (label === id) return null;
  if (get(categories).some(cat => cat.id === label)) return 'Cette catégorie existe déjà.';
  if (!root || !(await ensureAccess(true))) return 'Le dossier n’est pas accessible.';
  const parent = await under(root, [THEMES_DIR, 'categories']);
  const folder = await childDir(parent, id);
  const movable = folder as FileSystemDirectoryHandle & { move?: (next: string) => Promise<void> };
  if (!movable.move) return 'Ce navigateur ne peut pas renommer le dossier.';
  try { await movable.move(label); }
  catch { return 'Impossible de renommer le dossier.'; }
  const next: CategoryInfo = { id: label, name: label };
  await writeJson(await childDir(parent, label), 'index.json', categoryIndex(label));
  for (const [styleId, catId] of styleSources) if (catId === id) styleSources.set(styleId, label);
  categories.update(list => list.map(cat => (cat.id === id ? next : cat)).sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  if (get(categoryInfo)?.id === id) categoryInfo.set(next);
  await saveSnapshot();
  return null;
}

export async function createStyle(fileName: string, displayName: string): Promise<string | null> {
  const issue = directoryNameIssue(fileName, 'fichier');
  if (issue) return issue;
  const label = displayName.trim();
  if (!label) return 'Indique un nom.';
  const id = fileName.trim();
  if (get(styles).some(style => style.id === id)) return 'Ce fichier existe déjà.';
  const style = styleFromPage(structuredClone(DEFAULT_PAGE), id, label);
  if (root && await ensureAccess(true)) {
    const dir = await under(root, ['studio', 'styles'], true);
    try {
      await dir.getFileHandle(`${id}.json`);
      return 'Ce fichier existe déjà.';
    } catch { /* le fichier n'existe pas */ }
    styleSources.set(style.id, null);
    await writeStyle(style);
  } else {
    const error = await postShared({ type: 'style', style });
    if (error) return error;
    styleSources.set(style.id, null);
  }
  styles.update(list => [...list, style].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  await saveSnapshot();
  return null;
}

export async function updateStyle(id: string, patch: Partial<PageStyle>) {
  let next: PageStyle | null = null;
  styles.update(list => list.map(style => {
    if (style.id !== id) return style;
    next = { ...style, ...patch, id };
    return next;
  }));
  if (!next) return;
  const saved: PageStyle = next;
  if (root && await ensureAccess(true)) await writeStyle(saved);
  else await postShared({ type: 'style', style: saved, update: true });
  const visual = visualsFromStyle(saved);
  pages.update(list => list.map(page => (page.styleId === id ? { ...page, ...visual } : page)));
  await saveSnapshot();
}

export async function refreshWorkspace() {
  const sharedPromise = readSharedDisk();
  const handleOk = Boolean(root) && await ensureAccess(true);
  const shared = await sharedPromise;
  if (!shared && !handleOk) return;
  const catId = get(categoryInfo)?.id || '';
  const file = get(seanceFile);
  const listed = shared ? (shared.categories || []) : await listCategories(root!);
  if (shared) applySharedDisk(shared);
  else {
    categories.set(listed);
    styles.set(await listAllStyles(root!));
    await readHandleBrowse(root!);
  }
  if (catId && !listed.some(cat => cat.id === catId)) {
    categoryInfo.set(null);
    seanceList.set([]);
    seanceFile.set(null);
    screen.set('home');
    await saveSnapshot();
    return;
  }
  if (catId) {
    let seances = usesSharedDisk() ? await readSharedSeances(catId) : null;
    if (!seances && handleOk) seances = await listCategorySeances(root!, catId);
    if (!seances) {
      await saveSnapshot();
      persistCursor();
      return;
    }
    seanceList.set(seances);
    if (file && !seances.some(item => item.file === file)) {
      seanceFile.set(null);
      if (get(screen) === 'seance' || get(screen) === 'exercise') screen.set('category');
    }
  }
  await saveSnapshot();
  persistCursor();
}

export async function createCategory(dirName: string, displayName: string): Promise<string | null> {
  const issue = directoryNameIssue(dirName);
  if (issue) return issue;
  const label = displayName.trim();
  if (!label) return 'Indique un nom.';
  const id = dirName.trim();
  if (get(categories).some(cat => cat.id === id)) return 'Ce répertoire existe déjà.';
  const info: CategoryInfo = { id, name: label };
  if (root && await ensureAccess(true)) {
    const parent = await under(root, [THEMES_DIR, 'categories'], true);
    try {
      await parent.getDirectoryHandle(id);
      return 'Ce répertoire existe déjà.';
    } catch { /* le répertoire n'existe pas */ }
    const folder = await childDir(parent, id, true);
    await writeJson(folder, 'index.json', categoryIndex(label));
    await childDir(folder, 'seances', true);
    const template = await readBytes(root, ODS_NAME);
    if (template) await writeBytes(folder, ODS_NAME, template);
  } else {
    const error = await postShared({ type: 'category', id, name: label });
    if (error) return error;
  }
  categories.update(list => [...list, info].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  await saveSnapshot();
  return null;
}

export async function createSeance(dirName: string, displayName: string): Promise<string | null> {
  const issue = directoryNameIssue(dirName);
  if (issue) return issue;
  const label = displayName.trim();
  if (!label) return 'Indique un nom.';
  const id = dirName.trim();
  const cat = get(categoryInfo);
  if (!cat) return 'Ouvre une catégorie.';
  if (get(seanceList).some(item => item.file === id)) return 'Ce répertoire existe déjà.';
  const usedSheets = new Set(get(seanceList).map(item => item.sheet));
  let sheet = 'S1';
  for (let n = 1; n <= 80; n++) {
    if (!usedSheets.has(`S${n}`)) { sheet = `S${n}`; break; }
  }
  const seance: SeanceFile = { id, name: label, sheet, date: '', phase: '', principle: '', means: '', exercises: [] };
  if (root && await ensureAccess(true)) {
    const parent = await under(root, [THEMES_DIR, 'categories', cat.id, 'seances'], true);
    try {
      await parent.getDirectoryHandle(id);
      return 'Ce répertoire existe déjà.';
    } catch { /* le répertoire n'existe pas */ }
    await writeJson(await childDir(parent, id, true), 'index.json', seanceIndex(seance));
  } else {
    const error = await postShared({ type: 'seance', category: cat.id, id, name: label, sheet });
    if (error) return error;
  }
  seanceList.update(list => [...list, { file: id, name: label, sheet }].sort((a, b) => a.sheet.localeCompare(b.sheet, 'fr', { numeric: true })));
  applySeance(seance, id);
  navChild.set(id);
  showNotes.set(true);
  screen.set('seance');
  await saveSnapshot();
  persistCursor();
  return null;
}

async function reloadBrowse() {
  if (usesSharedDisk()) {
    const info = await readSharedDisk();
    if (info) applySharedDisk(info);
    return;
  }
  if (root && await ensureAccess(true)) await readHandleBrowse(root);
}

export async function createSeason(name: string): Promise<string | null> {
  const label = name.trim();
  const folder = folderSlug(label);
  const issue = folder ? directoryNameIssue(folder) : 'Indique un nom.';
  if (issue) return issue;
  const id = `${SEASONS_DIR}/${folder}`;
  if (get(seasons).some(item => item.id === id)) return 'Cette saison existe déjà.';
  const doc = {
    type: SEASON_TYPE,
    id: crypto.randomUUID(),
    players: [] as string[],
    slots: [] as unknown[]
  };
  if (root && await ensureAccess(true)) {
    const dir = await under(root, [SEASONS_DIR, folder], true);
    if (await readJson(dir, 'index.json')) return 'Cette saison existe déjà.';
    await writeJson(dir, 'index.json', doc);
    await writeText(dir, 'content.md', await markdownFrom('season', { name: label }));
  } else {
    const error = await postShared({ type: 'season', name: label });
    if (error) return error;
  }
  await reloadBrowse();
  navItem.set(id);
  persistCursor();
  return null;
}

export async function createSlot(date: string, session: string): Promise<string | null> {
  const seasonId = get(navItem);
  const season = get(seasons).find(item => item.id === seasonId);
  if (!season) return 'Ouvre une saison.';
  const when = date.trim();
  if (!when || !session) return 'Indique la date et la séance.';
  if (season.slots.some(slot => slot.date === when)) return 'Cette date existe déjà.';
  if (root && await ensureAccess(true)) {
    const dir = await under(root, seasonId.split('/'));
    const data = await readJson<Record<string, unknown>>(dir, 'index.json');
    if (!data) return 'Cette saison n’existe pas.';
    const slots = Array.isArray(data.slots) ? [...data.slots as object[]] : [];
    slots.push({ date: when, session });
    data.slots = slots;
    await writeJson(dir, 'index.json', data);
  } else {
    const error = await postShared({ type: 'slot', season: seasonId, date: when, session });
    if (error) return error;
  }
  await reloadBrowse();
  return null;
}

async function readSheet(playerId: string, date = ''): Promise<string> {
  const seasonId = openSeasonId();
  if (!seasonId || !playerId) return '';
  if (usesSharedDisk()) {
    const query = `season=${encodeURIComponent(seasonId)}&player=${encodeURIComponent(playerId)}${date ? `&evaluation=${encodeURIComponent(date)}` : ''}`;
    try {
      const response = await fetch(`/api/workspace?${query}`);
      if (!response.ok) return '';
      const data = await response.json() as { markdown?: string };
      return data.markdown || '';
    } catch {
      return '';
    }
  }
  if (!root) return '';
  try {
    const dir = await under(root, date
      ? [...seasonId.split('/'), PLAYERS_DIR, playerId, EVALUATIONS_DIR]
      : [...seasonId.split('/'), PLAYERS_DIR, playerId]);
    return (await readText(dir, date ? `${date}.md` : 'content.md')) || '';
  } catch {
    return '';
  }
}

export function loadPlayerMarkdown(playerId: string): Promise<string> {
  return readSheet(playerId);
}

export function loadEvaluation(playerId: string, date: string): Promise<string> {
  return readSheet(playerId, date);
}

export async function createPlayer(name: string): Promise<string | null> {
  const seasonId = openSeasonId();
  const season = get(seasons).find(item => item.id === seasonId);
  if (!season) return 'Ouvre une saison.';
  const label = name.trim();
  const folder = folderSlug(label);
  if (!folder) return 'Indique un nom.';
  if (season.players.some(player => player.id === folder)) return 'Ce joueur existe déjà.';
  if (root && await ensureAccess(true)) {
    const dir = await under(root, seasonId.split('/'));
    const data = await readJson<Record<string, unknown>>(dir, 'index.json');
    if (!data) return 'Cette saison n’existe pas.';
    const names = playerNames(data.players);
    if (names.some(item => folderSlug(item) === folder)) return 'Ce joueur existe déjà.';
    const { type, id, slots, players: _players, ...rest } = data;
    await writeJson(dir, 'index.json', { type, id, players: [...names, label], ...rest, slots });
  } else {
    const error = await postShared({ type: 'player', season: seasonId, name: label });
    if (error) return error;
  }
  await reloadBrowse();
  return null;
}

export async function renamePlayer(playerId: string, name: string): Promise<string | null> {
  const seasonId = openSeasonId();
  const season = get(seasons).find(item => item.id === seasonId);
  if (!season) return 'Ouvre une saison.';
  const current = season.players.find(player => player.id === playerId);
  if (!current) return 'Ce joueur n’existe pas.';
  const label = name.trim();
  const folder = folderSlug(label);
  if (!folder) return 'Indique un nom.';
  if (label === current.name) return null;
  if (folder !== playerId && season.players.some(player => player.id === folder)) return 'Ce joueur existe déjà.';
  if (root && await ensureAccess(true)) {
    const dir = await under(root, seasonId.split('/'));
    const data = await readJson<Record<string, unknown>>(dir, 'index.json');
    if (!data) return 'Cette saison n’existe pas.';
    const names = playerNames(data.players);
    const index = names.findIndex(item => folderSlug(item) === playerId);
    if (index < 0) return 'Ce joueur n’existe pas.';
    if (folder !== playerId) {
      try {
        const parent = await under(root, [...seasonId.split('/'), PLAYERS_DIR]);
        await parent.getDirectoryHandle(playerId);
        const moved = await renameDir(parent, playerId, label);
        if (moved !== folder) return 'Impossible de renommer ce joueur.';
      } catch { /* pas encore de dossier */ }
    }
    names[index] = label;
    const { type, id, slots, players: _players, ...rest } = data;
    await writeJson(dir, 'index.json', { type, id, players: names, ...rest, slots });
  } else {
    const error = await postShared({ type: 'rename-player', season: seasonId, player: playerId, name: label });
    if (error) return error;
  }
  seasons.update(list => list.map(item => item.id === seasonId ? {
    ...item,
    players: item.players.map(player => player.id === playerId ? { ...player, id: folder, name: label } : player)
  } : item));
  if (get(navChild) === playerId && folder !== playerId) {
    navChild.set(folder);
    persistCursor();
  }
  await reloadBrowse();
  return null;
}

export async function savePlayerMarkdown(playerId: string, markdown: string): Promise<{ id: string } | { error: string }> {
  const seasonId = openSeasonId();
  if (!seasonId || !playerId) return { error: 'Ouvre un joueur.' };
  const text = `${markdown.replace(/\r\n/g, '\n').replace(/\n+$/, '')}\n`;
  const handleOk = Boolean(root) && await ensureAccess(false);
  let id = playerId;
  if (handleOk && root) {
    const parent = await under(root, [...seasonId.split('/'), PLAYERS_DIR]);
    await writeText(await under(parent, [playerId]), 'content.md', text);
    id = await renameDir(parent, playerId, markdownTitle(text));
  } else if (usesSharedDisk()) {
    const sent = await postJson<{ id?: string }>({ type: 'save-player-markdown', explicit: true, season: seasonId, player: playerId, markdown: text });
    if (sent.error || !sent.data?.id) return { error: sent.error || 'Enregistrement impossible.' };
    id = sent.data.id;
  } else {
    return { error: 'Le dossier n’est pas accessible.' };
  }
  await reloadBrowse();
  return { id };
}

export async function createEvaluation(playerId: string, date: string): Promise<string | null> {
  const seasonId = openSeasonId();
  const player = get(seasons).find(item => item.id === seasonId)?.players.find(item => item.id === playerId);
  if (!player) return 'Ouvre un joueur.';
  const when = canonicalIso(date);
  if (!when) return 'Date invalide.';
  if (player.evaluations.includes(when)) return 'Cette date existe déjà.';
  if (root && await ensureAccess(true)) {
    const dir = await under(root, [...seasonId.split('/'), PLAYERS_DIR, playerId, EVALUATIONS_DIR], true);
    if (await readText(dir, `${when}.md`)) return 'Cette date existe déjà.';
    await writeText(dir, `${when}.md`, await markdownFrom('evaluation', { date: longFrenchDate(when) }));
  } else {
    const error = await postShared({ type: 'evaluation', season: seasonId, player: playerId, date: when });
    if (error) return error;
  }
  await reloadBrowse();
  return null;
}

export async function saveEvaluation(playerId: string, date: string, markdown: string): Promise<{ date: string } | { error: string }> {
  const seasonId = openSeasonId();
  const when = canonicalIso(date);
  if (!seasonId || !playerId || !when) return { error: 'Évaluation invalide.' };
  const text = `${markdown.replace(/\r\n/g, '\n').replace(/\n+$/, '')}\n`;
  const nextDate = canonicalIso(markdownTitle(text)) || when;
  const handleOk = Boolean(root) && await ensureAccess(false);
  if (handleOk && root) {
    const dir = await under(root, [...seasonId.split('/'), PLAYERS_DIR, playerId, EVALUATIONS_DIR], true);
    const current = await readText(dir, `${when}.md`);
    if (!current && await readText(dir, `${nextDate}.md`)) return { error: 'Cette date existe déjà.' };
    if (current && nextDate !== when && await readText(dir, `${nextDate}.md`)) return { error: 'Cette date existe déjà.' };
    await writeText(dir, `${nextDate}.md`, text);
    if (nextDate !== when) {
      try { await dir.removeEntry(`${when}.md`); } catch { /* l'ancien fichier reste */ }
    }
  } else if (usesSharedDisk()) {
    const sent = await postJson<{ date?: string }>({ type: 'save-evaluation', explicit: true, season: seasonId, player: playerId, date: when, markdown: text });
    if (sent.error || !sent.data?.date) return { error: sent.error || 'Enregistrement impossible.' };
    await reloadBrowse();
    return { date: sent.data.date };
  } else {
    return { error: 'Le dossier n’est pas accessible.' };
  }
  await reloadBrowse();
  return { date: nextDate };
}

export async function createTheme(dirName: string, displayName: string): Promise<string | null> {
  const issue = directoryNameIssue(dirName);
  if (issue) return issue;
  const label = displayName.trim();
  if (!label) return 'Indique un nom.';
  const id = dirName.trim();
  if (get(themes).some(item => item.id === id)) return 'Ce répertoire existe déjà.';
  if (root && await ensureAccess(true)) {
    const parent = await under(root, [THEMES_DIR], true);
    try {
      await parent.getDirectoryHandle(id);
      return 'Ce répertoire existe déjà.';
    } catch { /* le répertoire n'existe pas */ }
    const folder = await childDir(parent, id, true);
    const themeId = crypto.randomUUID();
    await writeJson(folder, 'index.json', orderThemeIndex({ type: 'fccn-theme:0', id: themeId, sessions: [] }));
    await writeText(folder, 'content.md', await markdownFrom('theme', { name: label }));
    await writeThemeOrder(root, [...get(themes).map(themeKey), themeId]);
  } else {
    const error = await postShared({ type: 'theme', id, name: label });
    if (error) return error;
  }
  await reloadBrowse();
  navItem.set(id);
  persistCursor();
  return null;
}

export async function createThemeSession(dirName: string, displayName: string): Promise<string | null> {
  const theme = get(themes).find(item => item.id === get(navItem));
  if (!theme) return 'Ouvre un thème.';
  const issue = directoryNameIssue(dirName);
  if (issue) return issue;
  const label = displayName.trim();
  if (!label) return 'Indique un nom.';
  const folder = dirName.trim();
  if (theme.sessions.some(item => item.folder === folder)) return 'Ce répertoire existe déjà.';
  if (root && await ensureAccess(true)) {
    const themeDir = await under(root, [THEMES_DIR, theme.id]);
    try {
      await themeDir.getDirectoryHandle(folder);
      return 'Ce répertoire existe déjà.';
    } catch { /* le répertoire n'existe pas */ }
    const sessionDir = await childDir(themeDir, folder, true);
    const sessionId = crypto.randomUUID();
    await writeJson(sessionDir, 'index.json', orderSessionIndex({
      type: SEANCE_TYPE,
      id: sessionId,
      exercises: []
    }));
    await writeText(sessionDir, 'content.md', await markdownFrom('session', { name: label }));
    await writeSessionOrder(themeDir, [...theme.sessions.map(item => item.id), sessionId]);
  } else {
    const error = await postShared({ type: 'session', theme: theme.id, id: folder, name: label });
    if (error) return error;
  }
  await reloadBrowse();
  return null;
}

export async function reorderThemes(ids: string[]): Promise<string | null> {
  const byId = new Map(get(themes).map(theme => [theme.id, theme]));
  const next = ids.flatMap(id => byId.get(id) ?? []);
  themes.set(next);
  const keys = next.map(themeKey);
  if (root && await ensureAccess(true)) {
    await writeThemeOrder(root, keys);
    return null;
  }
  const error = await postShared({ type: 'order-themes', themes: keys });
  if (error) await reloadBrowse();
  return error;
}

export async function reorderThemeSessions(themeId: string, ids: string[]): Promise<string | null> {
  const theme = get(themes).find(item => item.id === themeId);
  if (!theme) return 'Ouvre un thème.';
  const byId = new Map(theme.sessions.map(session => [session.id, session]));
  const sessions = ids.flatMap(id => byId.get(id) ?? []);
  themes.update(list => list.map(item => (item.id === themeId ? { ...item, sessions } : item)));
  const keys = sessions.map(session => session.id);
  if (root && await ensureAccess(true)) {
    await writeSessionOrder(await under(root, [THEMES_DIR, themeId]), keys);
    return null;
  }
  const error = await postShared({ type: 'order-sessions', theme: themeId, sessions: keys });
  if (error) await reloadBrowse();
  return error;
}

export async function reorderExercises(ids: string[]): Promise<string | null> {
  const id = get(seanceHeader).id;
  if (!id) return 'Ouvre une séance.';
  const byId = new Map(get(pages).map(page => [page.id, page]));
  pages.set(ids.flatMap(key => byId.get(key) ?? []));
  if (root && await ensureAccess(true)) {
    const nodes: IndexNode[] = [];
    await collectIndexes(root, [], nodes);
    const session = nodes.find(node => repertoireSession(node, id));
    if (!session) return 'Cette séance n’existe pas.';
    await writeJson(await dirAt(root, session.segments), 'index.json', { ...session.data, exercises: ids });
    return null;
  }
  return postShared({ type: 'order-exercises', id, exercises: ids });
}

export async function createLibraryItem(fileName: string): Promise<string | null> {
  const domain = get(navItem);
  const kind = get(navChild) as LibraryKind;
  if (!domain || !LIBRARY_KINDS.some(item => item.id === kind)) return 'Ouvre un dossier de la bibliothèque.';
  const issue = directoryNameIssue(fileName, 'fichier');
  if (issue) return issue;
  const name = fileName.trim();
  if (get(libraryItems).some(item => item.domain === domain && item.kind === kind && item.name === name)) return 'Ce fichier existe déjà.';
  const ext = kind === 'shapes' ? 'yaml' : 'svg';
  const source = kind === 'shapes'
    ? `type: fccn-schema:0\nname: ${name}\nunits: relative\nplayers: []\n`
    : kind === 'pitches'
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 72 56.5">\n</svg>\n'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 1 1">\n</svg>\n';
  if (root && await ensureAccess(true)) {
    const dir = await under(root, ['studio', 'library', domain, kind], true);
    try {
      await dir.getFileHandle(`${name}.${ext}`);
      return 'Ce fichier existe déjà.';
    } catch { /* le fichier n'existe pas */ }
    await writeText(dir, `${name}.${ext}`, source);
  } else {
    const error = await postShared({ type: 'library', domain, kind, name });
    if (error) return error;
  }
  await reloadBrowse();
  return null;
}

export async function createExercise(dirName: string, displayName: string): Promise<string | null> {
  const issue = directoryNameIssue(dirName);
  if (issue) return issue;
  const label = displayName.trim();
  if (!label) return 'Indique un nom.';
  const id = dirName.trim();
  if (!get(categoryInfo) || !get(seanceFile)) return 'Ouvre une séance.';
  if (get(pages).some(page => page.id === id)) return 'Ce répertoire existe déjà.';
  const page = blankExercise(label);
  const drafted = parseExerciseDocument(fillTemplate(await readTemplate('exercise'), { name: label }));
  page.name = drafted.name || label;
  page.drill = { ...(page.drill || {}), ...drafted.drill, kind: drafted.drill.kind || label };
  page.markdownContent = drafted.markdownContent;
  const base = get(currentPage);
  if (base?.styleId) Object.assign(page, visualsFromStyle(styleFromPage(base, base.styleId, label)));
  page.id = id;
  page.name = label;
  pages.update(list => [...list, page]);
  currentPageId.set(id);
  isDirty.set(true);
  await saveOpenSeance();
  return null;
}

export async function openSeance(file: string) {
  const cat = get(categoryInfo);
  if (!cat) return;
  if (file === get(seanceFile)) return;
  let loaded = usesSharedDisk() ? await readSharedSeance(cat.id, file) : null;
  if (!loaded && root && await ensureAccess(true)) loaded = await readHandleSeance(root, cat.id, file);
  if (!loaded) return;
  applySeance(loaded.seance, file, undefined, loaded.paths);
  await saveSnapshot();
  persistCursor();
}

export function useStyle(id: string) {
  const style = get(styles).find(item => item.id === id);
  if (!style) return;
  updatePageSettings(visualsFromStyle(style));
}

export function saveStyleFromExercise(name: string) {
  const page = get(currentPage);
  if (!page) return;
  const used = new Set(get(styles).map(style => style.id));
  const style = styleFromPage(page, uniqueSlug(name || 'style', used), name.trim() || 'Style');
  styles.update(list => [...list, style]);
  updatePageSettings({ styleId: style.id }, { skipHistory: true });
  scheduleWorkspaceSave();
}

export async function pickWorkspace(askTemplate = false): Promise<boolean> {
  const picker = (window as unknown as { showDirectoryPicker?: (o: { mode: 'readwrite' }) => Promise<Dir> }).showDirectoryPicker;
  if (!picker) {
    alert("Ce navigateur ne peut pas ouvrir un dossier. Utilisez Chrome ou Edge.");
    return false;
  }
  let handle: Dir;
  try { handle = await picker({ mode: 'readwrite' }); }
  catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return false;
    throw err;
  }
  return adoptWorkspace(handle, true);
}

export function openWorkspaceDirectory(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return adoptWorkspace(handle as Dir, true);
}

async function recognize(handle: Dir): Promise<boolean> {
  workspaceError.set(null);
  if (await isEmptyDir(handle)) {
    await writeJson(handle, 'index.json', { type: WORKSPACE_TYPE });
    await under(handle, [THEMES_DIR], true);
    await under(handle, ['studio', 'styles'], true);
    return true;
  }
  const info = await readJson<TrainerInfo & { produit?: string; prenom?: string; nom?: string; product?: string }>(handle, 'index.json');
  if (info?.type === WORKSPACE_TYPE || info?.type === 'fc-tactics-workspace' || info?.product === PRODUCT || info?.product === 'fc-tactics' || info?.produit === PRODUCT || info?.produit === 'fc-tactics') return true;
  if (isWorkspaceIndex(info) && await hasDirectory(handle, THEMES_DIR)) {
    await writeJson(handle, 'index.json', { type: WORKSPACE_TYPE });
    return true;
  }
  workspaceError.set('Ce dossier n’est pas un espace de travail FC Coach Notebook. index.json doit contenir "type": "fccn-workspace:0".');
  screen.set('gate');
  workspaceOpen.set(false);
  return false;
}

async function adoptWorkspace(handle: Dir, ask: boolean): Promise<boolean> {
  if (!(await permitted(handle, ask))) {
    root = handle;
    folderLabel.set(handle.name);
    needsPermission.set(true);
    workspaceOpen.set(false);
    screen.set('gate');
    return false;
  }
  if (!(await recognize(handle))) return false;
  root = handle;
  await idbSet(HANDLE_KEY, handle);
  if (handle.name) folderLabel.set(handle.name);
  workspaceWritable.set(true);
  needsPermission.set(false);
  workspaceError.set(null);
  ready = false;
  categories.set(await listCategories(handle));
  styles.set(await listAllStyles(handle));
  await readHandleBrowse(handle);
  workspaceOpen.set(true);
  const saved = cursor();
  if (saved?.folderName === handle.name) await restoreScreen(saved);
  else screen.set('home');
  const index = await readJson<{ coach?: unknown }>(handle, 'index.json');
  rememberCoach(coachName(index?.coach));
  ready = true;
  await saveSnapshot();
  persistCursor();
  return true;
}

function applyNav(saved: WorkspaceCursor | null) {
  if (!saved) return;
  if (saved.area === 'categories') {
    navDoor.set('repertoire');
    navArea.set('themes');
    navItem.set('');
    navChild.set('');
    return;
  }
  if (saved.area || saved.door) {
    navDoor.set(saved.door || doorOf(saved.area || ''));
    navArea.set(saved.area === 'themes' ? 'themes' : (saved.area || ''));
    navItem.set(saved.item || '');
    navChild.set(saved.child || '');
    return;
  }
  if (saved.categoryId && saved.screen && saved.screen !== 'home' && saved.screen !== 'gate') {
    navDoor.set('repertoire');
    navArea.set('categories');
    navItem.set(saved.categoryId);
    navChild.set(saved.seanceFile || '');
  }
}

async function restoreScreen(saved: WorkspaceCursor) {
  applyNav(saved);
  const want = saved.screen || 'home';
  const cat = get(categories).find(item => item.id === saved.categoryId);
  if (!cat || want === 'home' || want === 'gate') {
    screen.set('home');
    return;
  }
  categoryInfo.set(cat);
  seanceList.set(await listCategorySeances(root!, cat.id));
  if (want === 'category' || !saved.seanceFile) {
    screen.set('category');
    return;
  }
  const loaded = await readHandleSeance(root!, cat.id, saved.seanceFile);
  if (!loaded) {
    screen.set('category');
    return;
  }
  applySeance(loaded.seance, saved.seanceFile, saved.exerciseId, loaded.paths);
  screen.set(want === 'exercise' ? 'exercise' : 'seance');
}

async function restoreCursorFromDisk() {
  const saved = cursor();
  if (!saved?.screen || saved.screen === 'home' || saved.screen === 'gate') {
    if (get(screen) === 'gate') screen.set('home');
    return;
  }
  if (!get(workspaceOpen)) return;
  await goToAddress({
    door: saved.door || '',
    area: saved.area || '',
    item: saved.item || '',
    child: saved.child || '',
    exercise: saved.screen === 'exercise' ? saved.exerciseId : ''
  });
}

async function ensureExercisePaths() {
  const here = get(screen);
  if (here !== 'seance' && here !== 'exercise') return;
  const list = get(pages);
  const known = get(exercisePaths);
  if (list.length && list.every(page => page.id && known[page.id])) return;
  const file = get(seanceFile);
  if (!file) return;
  const categoryId = get(categoryInfo)?.id || 'themes';
  let loaded = usesSharedDisk() ? await readSharedSeance(categoryId, file) : null;
  if (!loaded && root && await ensureAccess(false)) loaded = await readHandleSeance(root, categoryId, file);
  if (!loaded?.paths || !Object.keys(loaded.paths).length) return;
  exercisePaths.set(loaded.paths);
}

export async function restoreWorkspace(): Promise<boolean> {
  const path = typeof location === 'undefined' ? '/' : location.pathname;
  const target = parseAddress(path);
  if (target?.door) {
    navDoor.set(target.door);
    navArea.set(target.area);
  }
  const saved = cursor();
  if (saved?.folderName) folderLabel.set(saved.folderName);
  const sharedLikely = !saved?.folderName || saved.folderName === 'data';
  const wantsView = sharedLikely && target !== null && (target.door === '' || target.door === 'season' || target.door === 'repertoire');
  const viewPromise = wantsView ? readSharedView(path) : Promise.resolve(null);
  let painted = false;
  try {
    const handlePromise = within(idbGet<Dir>(HANDLE_KEY), 800, null);
    const view = await viewPromise;
    if (view && viewReady(target, view)) {
      applyQuickView(target, view);
      painted = true;
      restoring.set(false);
    }
    const handle = await handlePromise;
    if (!sharedLikely && handle && await within(permitted(handle, false), 800, false)) {
      try {
        if (await adoptWorkspace(handle, false)) return true;
      } catch (err) {
        console.error(err);
      }
    }
    const shared = await readSharedDisk();
    if (shared) {
      applySharedDisk(shared);
      workspaceOpen.set(true);
      workspaceWritable.set(true);
      needsPermission.set(false);
      ready = true;
      return true;
    }
    if (painted) return true;
    if (handle) {
      root = handle;
      folderLabel.set(saved?.folderName || handle.name);
      needsPermission.set(true);
    }
    screen.set('gate');
    return false;
  } finally {
    if (path === '/' || path === '') {
      await followAddress(path, 'fill');
      await restoreCursorFromDisk();
    } else if (!painted || (typeof location !== 'undefined' && location.pathname === path)) {
      await followAddress(path, painted ? 'url' : 'disk');
    }
    await ensureExercisePaths();
    armAddress();
    restoring.set(false);
    if ((path === '/' || path === '') && get(workspaceOpen)) publishAddress('replace');
  }
}

export async function resumeWorkspace(): Promise<boolean> {
  const handle = root || await idbGet<Dir>(HANDLE_KEY);
  if (!handle) return pickWorkspace(false);
  if (!(await permitted(handle, true))) return false;
  return adoptWorkspace(handle, true);
}

export async function categoryOds(): Promise<Uint8Array | null> {
  if (!root || !get(categoryInfo)) return null;
  const folder = await under(root, [THEMES_DIR, 'categories', get(categoryInfo)!.id]);
  return readBytes(folder, ODS_NAME) || readBytes(root, ODS_NAME);
}

export async function storeCategoryOds(bytes: Uint8Array) {
  if (!root || !get(categoryInfo)) return;
  const folder = await under(root, [THEMES_DIR, 'categories', get(categoryInfo)!.id]);
  await writeBytes(folder, ODS_NAME, bytes);
  const existing = await readBytes(root, ODS_NAME);
  if (!existing) await writeBytes(root, ODS_NAME, bytes);
}

export async function reloadSeances(files: SeanceFile[]) {
  if (!root || !get(categoryInfo)) return;
  const folder = await under(root, [THEMES_DIR, 'categories', get(categoryInfo)!.id]);
  const used = new Set<string>();
  const refs: SeanceRef[] = [];
  let first: { id: string; seance: SeanceFile } | null = null;
  for (const seance of files) {
    const id = uniqueSlug(seance.name || seance.sheet || 'seance', used);
    used.add(id);
    const exerciseIds = new Set<string>();
    const exercises = (seance.exercises || []).map(page => {
      const exerciseId = !directoryNameIssue(page.id) && !exerciseIds.has(page.id)
        ? page.id
        : uniqueSlug(page.name || 'exercice', exerciseIds);
      exerciseIds.add(exerciseId);
      return { ...page, id: exerciseId };
    });
    const stored = { ...seance, id, exercises };
    await writeSeanceTree(folder, id, stored);
    refs.push({ file: id, name: seance.name, sheet: seance.sheet });
    if (!first) first = { id, seance: stored };
  }
  seanceList.set(refs);
  if (first) applySeance(first.seance, first.id);
  await saveSnapshot();
}

export function patchHeader(updates: Partial<SeanceHeader>) {
  seanceHeader.update(header => ({ ...header, ...updates }));
  if (updates.name) {
    tacticName.set(updates.name);
    const file = get(seanceFile);
    seanceList.update(list => list.map(item => (item.file === file ? { ...item, name: updates.name! } : item)));
  }
  if (updates.sheet) {
    const file = get(seanceFile);
    seanceList.update(list => list.map(item => (item.file === file ? { ...item, sheet: updates.sheet! } : item)));
  }
  isDirty.set(true);
}

export async function attachTemplate(bytes: Uint8Array) {
  if (!root) return;
  await writeBytes(root, ODS_NAME, bytes);
  if (get(categoryInfo)) await storeCategoryOds(bytes);
}

function publicItem(area: WorkspaceArea | '', item: string): string {
  if (!item) return '';
  if (area === 'themes') return get(themes).find(theme => theme.id === item)?.uuid || item;
  if (area === 'categories') return get(categories).find(category => category.id === item)?.uuid || item;
  if (area === 'seasons') return get(seasons).find(season => season.id === item)?.uuid || item;
  return item;
}

function publicChild(area: WorkspaceArea | '', child: string): string {
  if (!child) return '';
  if (area === 'categories' && get(seanceFile)) return get(seanceHeader).id || child;
  return child;
}

function resolveItem(area: WorkspaceArea | '', token: string): string {
  if (area === 'themes') return get(themes).find(theme => theme.uuid === token || theme.id === token)?.id || token;
  if (area === 'categories') return get(categories).find(category => category.uuid === token || category.id === token)?.id || token;
  if (area === 'seasons') return get(seasons).find(season => season.uuid === token || season.id === token)?.id || token;
  return token;
}

function resolveChild(area: WorkspaceArea | '', item: string, token: string): string {
  if (area === 'themes') {
    const theme = get(themes).find(entry => entry.id === item);
    return theme?.sessions.find(session => session.id === token || session.folder === token)?.id || token;
  }
  return token;
}

function missingItem(area: WorkspaceArea | '', item: string): string {
  if (area === 'themes' && !get(themes).some(theme => theme.id === item)) return 'Ce thème n’existe plus.';
  if (area === 'seasons' && !get(seasons).some(season => season.id === item)) return 'Cette saison n’existe plus.';
  if (area === 'styles' && !get(styles).some(style => style.id === item)) return 'Ce style n’existe plus.';
  if (area === 'library' && !get(libraryItems).some(entry => entry.domain === item)) return 'Ce domaine de la bibliothèque n’existe plus.';
  return '';
}

function missingChild(area: WorkspaceArea | '', item: string, child: string): string {
  if (area === 'themes') {
    const theme = get(themes).find(entry => entry.id === item);
    if (!theme?.sessions.some(session => session.id === child)) return `Cette séance n’existe plus dans le thème « ${theme?.name || item} ».`;
  }
  if (area === 'seasons') {
    const season = get(seasons).find(entry => entry.id === item);
    if (season?.players.some(player => player.id === child)) return '';
    if (!season?.slots.some(slot => slot.session === child)) return `Cette séance ne fait plus partie du planning de la saison « ${season?.name || item} ».`;
  }
  if (area === 'library' && !LIBRARY_KINDS.some(kind => kind.id === child)) return 'Ce dossier de la bibliothèque n’existe plus.';
  return '';
}

async function goToAddress(target: AddressTarget) {
  if (!get(workspaceOpen)) return;
  missingPage.set('');
  if (!target.door) {
    if (get(navDoor) || get(screen) !== 'home') await showHome();
    return;
  }
  if (target.area === 'categories') {
    await openDoor('repertoire');
    return;
  }
  if (!target.area) {
    if (get(navDoor) !== target.door || get(navArea) || get(screen) === 'gate') await openDoor(target.door);
    return;
  }
  const onDoor = get(navDoor) === target.door && (target.door === 'season' || get(navArea) === target.area);
  if (!onDoor) {
    if (target.door === 'season') await openDoor('season');
    else await openArea(target.area);
  }
  if (!target.item) {
    if (get(navItem) || get(navChild) || get(screen) === 'seance' || get(screen) === 'exercise') await openNavItem('');
    else if (get(screen) === 'gate') screen.set('home');
    return;
  }
  const item = resolveItem(target.area, target.item);
  const lostItem = missingItem(target.area, item);
  if (lostItem) {
    missingPage.set(lostItem);
    return;
  }
  const child = target.child ? resolveChild(target.area, item, target.child) : '';
  const here = get(screen);
  const itemOpen = get(navItem) === item && (target.area !== 'categories' || Boolean(child) || here === 'category');
  if (!itemOpen) await openNavItem(item);
  if (!child) {
    if (get(navChild) || get(screen) === 'seance' || get(screen) === 'exercise') await openNavChild('');
    return;
  }
  const lostChild = missingChild(target.area, item, child);
  if (lostChild) {
    if (get(navChild)) await openNavChild('');
    missingPage.set(lostChild);
    return;
  }
  const knownPaths = get(exercisePaths);
  const openPages = get(pages);
  const pathsReady = (target.area !== 'themes' && target.area !== 'seasons') || (openPages.length > 0 && openPages.every(page => page.id && knownPaths[page.id]));
  const childOpen = pathsReady && get(navChild) === child && (get(screen) === 'seance' || get(screen) === 'exercise' || target.area === 'library' || target.area === 'styles');
  if (!childOpen) await openNavChild(child);
  const openedSeason = target.area === 'seasons' ? get(seasons).find(entry => entry.id === item) : undefined;
  const openedPlayer = openedSeason?.players.find(entry => entry.id === child);
  if (openedPlayer) {
    const date = target.exercise;
    if (date && !openedPlayer.evaluations.includes(date)) {
      navLeaf.set('');
      missingPage.set(`Cette évaluation ne fait plus partie du suivi de ${openedPlayer.name}.`);
      return;
    }
    navLeaf.set(date);
    return;
  }
  if (target.exercise && !get(pages).some(page => page.id === target.exercise)) {
    if (get(screen) === 'exercise') await showSeanceScreen();
    missingPage.set(`Cet exercice n’existe plus dans la séance « ${get(seanceHeader).name || 'Séance'} ».`);
    return;
  }
  if (target.exercise && (get(screen) !== 'exercise' || get(currentPageId) !== target.exercise)) await showExercise(target.exercise);
  else if (!target.exercise && get(screen) === 'exercise') await showSeanceScreen();
}

function evaluationStem(area: WorkspaceArea | ''): string {
  if (get(screen) === 'exercise') return get(currentPageId);
  if (area !== 'seasons') return '';
  const season = get(seasons).find(item => item.id === get(navItem));
  if (!season?.players.some(player => player.id === get(navChild))) return '';
  return get(navLeaf);
}

bindAddress(
  () => {
    if (!get(workspaceOpen) || get(screen) === 'gate') return { door: '', area: '', item: '', child: '', exercise: '' };
    const area = get(navArea);
    return {
      door: get(navDoor),
      area,
      item: publicItem(area, get(navItem)),
      child: publicChild(area, get(navChild)),
      exercise: evaluationStem(area)
    };
  },
  goToAddress
);
