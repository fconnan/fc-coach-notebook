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
  trainerFromJson,
  styleFromPage,
  visualsFromStyle,
  type CategoryInfo,
  type PageStyle,
  type SeanceFile,
  type SeanceHeader,
  type TrainerInfo
} from './model';

const HANDLE_KEY = 'workspace_dir';
const SNAPSHOT_KEY = 'workspace_snapshot';
const CURSOR_KEY = 'fctactics_ws_cursor';
const SESSION_SNAP = 'fctactics_ws_snap';
const TAB_MARK = 'fctactics:';

type Dir = FileSystemDirectoryHandle & {
  entries: () => AsyncIterable<[string, FileSystemHandle]>;
};

export interface SeanceRef {
  file: string;
  name: string;
  sheet: string;
}

export type WorkspaceScreen = 'gate' | 'home' | 'category' | 'seance' | 'exercise';

export interface WorkspaceCursor {
  categoryId: string;
  seanceFile: string;
  exerciseId: string;
  showNotes: boolean;
  folderName: string;
  screen?: WorkspaceScreen;
}

export interface WorkspaceSnapshot {
  trainer: TrainerInfo;
  categories: CategoryInfo[];
  category: CategoryInfo | null;
  seanceList: SeanceRef[];
  seance: SeanceFile | null;
  seanceFile: string | null;
  styles: PageStyle[];
  styleFolders?: Record<string, string | null>;
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
export const seanceHeader = writable<SeanceHeader>(emptyHeader());
export const styles = writable<PageStyle[]>([]);

let root: Dir | null = null;
/** null means the style file lives in the workspace-root styles folder. */
const styleSources = new Map<string, string | null>();
let ready = false;
let timer: ReturnType<typeof setTimeout> | null = null;
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
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(JSON.stringify(value, null, 2));
  await writable.close();
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

function browserStore(kind: 'session' | 'local'): Storage | null {
  try {
    return kind === 'session' ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}

function parseMemory(raw: string): { cursor: WorkspaceCursor | null; snap: WorkspaceSnapshot | null } {
  const data = JSON.parse(raw) as WorkspaceSnapshot & { cursor?: WorkspaceCursor; snap?: WorkspaceSnapshot };
  if (data?.snap) return { cursor: data.cursor ?? null, snap: data.snap };
  if (data?.trainer || data?.categories) return { cursor: null, snap: data };
  return { cursor: null, snap: null };
}

function memoryPacks(): Array<{ cursor: WorkspaceCursor | null; snap: WorkspaceSnapshot | null }> {
  const raws: string[] = [];
  try {
    if (typeof window !== 'undefined' && window.name.startsWith(TAB_MARK)) raws.push(window.name.slice(TAB_MARK.length));
  } catch { /* ignore */ }
  for (const kind of ['session', 'local'] as const) {
    try {
      const raw = browserStore(kind)?.getItem(SESSION_SNAP);
      if (raw) raws.push(raw);
    } catch { /* ignore */ }
  }
  const packs = [];
  for (const raw of raws) {
    try { packs.push(parseMemory(raw)); } catch { /* ignore */ }
  }
  return packs;
}

function cursor(): WorkspaceCursor | null {
  for (const kind of ['session', 'local'] as const) {
    try {
      const raw = browserStore(kind)?.getItem(CURSOR_KEY);
      if (raw) return JSON.parse(raw) as WorkspaceCursor;
    } catch { /* essayer l'autre stockage */ }
  }
  return memoryPacks().find(pack => pack.cursor)?.cursor ?? null;
}

export function persistCursor() {
  if (!get(workspaceOpen)) return;
  const payload: WorkspaceCursor = {
    categoryId: get(categoryInfo)?.id || '',
    seanceFile: get(seanceFile) || '',
    exerciseId: get(currentPageId),
    showNotes: get(showNotes),
    folderName: get(folderLabel),
    screen: get(screen)
  };
  const raw = JSON.stringify(payload);
  for (const kind of ['session', 'local'] as const) {
    try { browserStore(kind)?.setItem(CURSOR_KEY, raw); } catch { /* quota */ }
  }
  writeTabMemory(payload, storedSnapshot());
}

function storedSnapshot(): WorkspaceSnapshot | null {
  return memoryPacks().find(pack => pack.snap)?.snap ?? null;
}

function writeTabMemory(saved: WorkspaceCursor | null, snap: WorkspaceSnapshot | null) {
  const previous = memoryPacks()[0];
  const nextSnap = snap ?? previous?.snap ?? null;
  const nextCursor = saved ?? previous?.cursor ?? null;
  if (!nextSnap && !nextCursor) return;
  const raw = JSON.stringify({ cursor: nextCursor, snap: nextSnap });
  for (const kind of ['session', 'local'] as const) {
    try { browserStore(kind)?.setItem(SESSION_SNAP, raw); } catch { /* quota */ }
  }
  try { window.name = TAB_MARK + raw; } catch { /* ignore */ }
}

function rememberSnapshot(snap: WorkspaceSnapshot) {
  writeTabMemory(cursor(), snap);
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
  const snap: WorkspaceSnapshot = {
    trainer: get(trainer),
    categories: get(categories),
    category: get(categoryInfo),
    seanceList: get(seanceList),
    seance: currentSeance(),
    seanceFile: get(seanceFile),
    styles: get(styles),
    styleFolders: Object.fromEntries(styleSources)
  };
  const plain = JSON.parse(JSON.stringify(snap)) as WorkspaceSnapshot;
  rememberSnapshot(plain);
  persistCursor();
  await idbSet(SNAPSHOT_KEY, plain);
}

function applySeance(data: SeanceFile, file: string, exerciseId?: string) {
  applying = true;
  const exercises = (data.exercises || []).map(page => migratePage(page));
  seanceFile.set(file);
  seanceHeader.set({
    id: data.id,
    name: data.name || 'Séance',
    sheet: data.sheet || 'S1',
    date: data.date || '',
    phase: data.phase || '',
    principle: data.principle || '',
    means: data.means || ''
  });
  pages.set(exercises);
  const wanted = exercises.find(page => page.id === exerciseId) || exercises[0];
  currentPageId.set(wanted?.id || '');
  tacticName.set(data.name || 'Séance');
  selectedIds.set([]);
  isDirty.set(false);
  applying = false;
}

function applySnapshot(snap: WorkspaceSnapshot, exerciseId?: string) {
  trainer.set(trainerFromJson(snap.trainer));
  categories.set((snap.categories || []).map(cat => ({ id: cat.id, name: cat.name })));
  categoryInfo.set(snap.category);
  seanceList.set(snap.seanceList || []);
  styles.set(snap.styles || []);
  styleSources.clear();
  for (const [id, folder] of Object.entries(snap.styleFolders || {})) styleSources.set(id, folder);
  if (snap.seance && snap.seanceFile) applySeance(snap.seance, snap.seanceFile, exerciseId);
  workspaceOpen.set(true);
}

function screenFromCursor(saved: WorkspaceCursor | null): WorkspaceScreen {
  const want = saved?.screen ?? 'home';
  if (want === 'exercise' && get(seanceFile)) return 'exercise';
  if (want === 'seance' && get(seanceFile)) return 'seance';
  if ((want === 'category' || want === 'seance' || want === 'exercise') && get(categoryInfo)) {
    return want === 'category' || !get(seanceFile) ? 'category' : want;
  }
  return 'home';
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
  if (!ready || applying || !get(workspaceOpen)) return;
  if (saving) {
    savePending = true;
    return;
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void saveOpenSeance(); }, 700);
}

export function startWorkspaceAutosave() {
  const kick = () => scheduleWorkspaceSave();
  pages.subscribe(kick);
  seanceHeader.subscribe(kick);
  styles.subscribe(kick);
  tacticName.subscribe(kick);
  showNotes.subscribe(() => persistCursor());
  currentPageId.subscribe(() => persistCursor());
  window.addEventListener('beforeunload', () => { void saveSnapshot(); });
}

async function writeStyle(style: PageStyle) {
  if (!root) return;
  const catId = styleSources.get(style.id);
  const dir = catId
    ? await childDir(await childDir(await childDir(root, 'categories'), catId), 'styles', true)
    : await childDir(root, 'styles', true);
  await writeJson(dir, `${style.id}.json`, style);
}

let trainerWrite: Promise<void> = Promise.resolve();

async function writeTrainerIndex(name: string) {
  const payload = { type: WORKSPACE_TYPE, name };
  if (root) await writeJson(root, 'index.json', payload);
  if (import.meta.env.DEV) {
    await fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
}

export function commitTrainerName(name: string) {
  trainer.update(current => ({ ...current, name }));
  trainerWrite = trainerWrite.then(() => writeTrainerIndex(get(trainer).name || '')).catch(err => console.error(err));
}

function usesSharedDisk(): boolean {
  const opened = root?.name || get(folderLabel);
  return !opened || opened === 'data';
}

async function readSharedDisk(): Promise<{ name?: string; folder?: string; categories?: CategoryInfo[]; styles?: PageStyle[] } | null> {
  if (!import.meta.env.DEV || !usesSharedDisk()) return null;
  try {
    const response = await fetch('/api/workspace');
    if (!response.ok) return null;
    return await response.json() as { name?: string; folder?: string; categories?: CategoryInfo[]; styles?: PageStyle[] };
  } catch {
    return null;
  }
}

async function readSharedSeance(categoryId: string, seanceId: string): Promise<SeanceFile | null> {
  if (!import.meta.env.DEV || !usesSharedDisk()) return null;
  try {
    const response = await fetch(`/api/workspace?category=${encodeURIComponent(categoryId)}&seance=${encodeURIComponent(seanceId)}`);
    if (!response.ok) return null;
    const data = await response.json() as { seance?: SeanceFile | null };
    return data.seance || null;
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
  if (!import.meta.env.DEV) return 'Le dossier n’est pas accessible.';
  try {
    const response = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (response.ok) return null;
    const data = await response.json().catch(() => ({})) as { error?: string };
    return data.error || 'Enregistrement impossible.';
  } catch {
    return 'Enregistrement impossible.';
  }
}

function applySharedDisk(info: { name?: string; folder?: string; categories?: CategoryInfo[]; styles?: PageStyle[] }) {
  if (!get(folderLabel)) folderLabel.set(info.folder || 'data');
  trainer.update(current => ({ ...current, type: WORKSPACE_TYPE, name: info.name || '' }));
  categories.set(info.categories || []);
  if (info.styles) styles.set(info.styles);
}

async function reloadSharedWorkspace() {
  if (!get(workspaceOpen)) return;
  const info = await readSharedDisk();
  if (info) applySharedDisk(info);
}

export async function saveOpenSeance() {
  if (!get(workspaceOpen) || saving) return;
  saving = true;
  try {
    const seance = currentSeance();
    await saveSnapshot();
    await trainerWrite;
    const current = get(trainer);
    const cat = get(categoryInfo);
    const file = get(seanceFile);
    const handleOk = Boolean(root) && await ensureAccess(false);
    if (handleOk && root) {
      await writeJson(root, 'index.json', workspaceIndex(current.name || ''));
      for (const style of get(styles)) await writeStyle(style);
      if (seance && cat && file) {
        const folder = await childDir(await childDir(root, 'categories', true), cat.id, true);
        await writeJson(folder, 'index.json', categoryIndex(cat.name));
        await writeSeanceTree(folder, file, seance);
      }
    } else if (seance && cat && file && usesSharedDisk()) {
      const error = await postShared({
        ...seanceIndex(seance),
        type: 'save-seance',
        category: cat.id,
        id: file,
        exercises: seance.exercises
      });
      if (error) return;
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
    const categoriesDir = await childDir(dir, 'categories');
    for await (const [name, handle] of categoriesDir.entries()) {
      if (handle.kind !== 'directory') continue;
      const info = await readJson<{ type?: string; name?: string }>(handle as Dir, 'index.json');
      if (!info || (info.type && info.type !== CATEGORY_TYPE)) continue;
      out.push({ id: name, name: info.name?.trim() ? info.name : name });
    }
  } catch { /* no categories yet */ }
  out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return out;
}

function workspaceIndex(name: string) {
  return { type: WORKSPACE_TYPE, name };
}

function categoryIndex(name: string) {
  return { type: CATEGORY_TYPE, name };
}

function seanceIndex(seance: SeanceFile) {
  return {
    type: SEANCE_TYPE,
    name: seance.name,
    sheet: seance.sheet || 'S1',
    date: seance.date || '',
    phase: seance.phase || '',
    principle: seance.principle || '',
    means: seance.means || ''
  };
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
  for (const page of seance.exercises) {
    await writeJson(await childDir(dir, page.id, true), 'index.json', { type: EXERCISE_TYPE, ...page, id: page.id });
  }
}

async function readSeanceFolder(parent: Dir, id: string): Promise<SeanceFile | null> {
  const dir = await childDir(parent, id);
  const info = await readJson<SeanceHeader & { type?: string }>(dir, 'index.json');
  if (!info || info.type !== SEANCE_TYPE) return null;
  const exercises: Page[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'directory') continue;
    const page = await readJson<Page & { type?: string }>(handle as Dir, 'index.json');
    if (!page || page.type !== EXERCISE_TYPE) continue;
    const { type: _type, ...rest } = page;
    exercises.push(migratePage({ ...rest, id: name }));
  }
  exercises.sort((a, b) => a.id.localeCompare(b.id, 'fr', { numeric: true }));
  return {
    id,
    name: info.name || id,
    sheet: info.sheet || 'S1',
    date: info.date || '',
    phase: info.phase || '',
    principle: info.principle || '',
    means: info.means || '',
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
  for (const style of await listStyles(handle)) {
    styleSources.set(style.id, null);
    out.push(style);
  }
  for (const cat of await listCategories(handle)) {
    const folder = await childDir(await childDir(handle, 'categories'), cat.id);
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

export function showHome() {
  screen.set('home');
  persistCursor();
}

export async function showCategory(id: string) {
  const info = get(categories).find(cat => cat.id === id);
  if (!info) return;
  if (get(isDirty)) await saveOpenSeance();
  let listed = usesSharedDisk() ? await readSharedSeances(id) : null;
  if (!listed && root && await ensureAccess(true)) {
    const folder = await childDir(await childDir(root, 'categories'), info.id);
    listed = await listSeances(folder);
  }
  if (!listed) return;
  categoryInfo.set(info);
  seanceList.set(listed);
  if (!listed.some(item => item.file === get(seanceFile))) seanceFile.set(null);
  screen.set('category');
  await saveSnapshot();
  persistCursor();
}

export async function showSeance(file: string) {
  if (file !== get(seanceFile)) await openSeance(file);
  screen.set('seance');
  persistCursor();
}

export async function showSeanceScreen() {
  if (get(isDirty)) await saveOpenSeance();
  screen.set('seance');
  persistCursor();
}

export function showExercise(id: string) {
  if (get(pages).some(page => page.id === id)) currentPageId.set(id);
  screen.set('exercise');
  persistCursor();
}

export async function renameCategory(id: string, name: string): Promise<string | null> {
  const issue = directoryNameIssue(name);
  if (issue) return issue;
  const label = name.trim();
  if (label === id) return null;
  if (get(categories).some(cat => cat.id === label)) return 'Cette catégorie existe déjà.';
  if (!root || !(await ensureAccess(true))) return 'Le dossier n’est pas accessible.';
  const parent = await childDir(root, 'categories');
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
    const dir = await childDir(root, 'styles', true);
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
    if (!seances && handleOk) {
      const folder = await childDir(await childDir(root!, 'categories'), catId);
      seances = await listSeances(folder);
    }
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
    const parent = await childDir(root, 'categories', true);
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
  if (get(seanceHeader).id) await saveOpenSeance();
  const usedSheets = new Set(get(seanceList).map(item => item.sheet));
  let sheet = 'S1';
  for (let n = 1; n <= 80; n++) {
    if (!usedSheets.has(`S${n}`)) { sheet = `S${n}`; break; }
  }
  const seance: SeanceFile = { id, name: label, sheet, date: '', phase: '', principle: '', means: '', exercises: [] };
  if (root && await ensureAccess(true)) {
    const parent = await childDir(await childDir(await childDir(root, 'categories'), cat.id), 'seances', true);
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
  showNotes.set(true);
  screen.set('seance');
  await saveSnapshot();
  persistCursor();
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
  if (get(isDirty)) await saveOpenSeance();
  let data = usesSharedDisk() ? await readSharedSeance(cat.id, file) : null;
  if (!data && root && await ensureAccess(true)) {
    const parent = await childDir(await childDir(await childDir(root, 'categories'), cat.id), 'seances');
    data = await readSeanceFolder(parent, file);
  }
  if (!data) return;
  applySeance(data, file);
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
    await writeJson(handle, 'index.json', emptyTrainer());
    await childDir(handle, 'categories', true);
    await childDir(handle, 'styles', true);
    return true;
  }
  const info = await readJson<TrainerInfo & { produit?: string; prenom?: string; nom?: string; product?: string }>(handle, 'index.json');
  if (info?.type === WORKSPACE_TYPE || info?.product === PRODUCT || info?.produit === PRODUCT) return true;
  if (isWorkspaceIndex(info) && await hasDirectory(handle, 'categories')) {
    await writeJson(handle, 'index.json', trainerFromJson(info));
    return true;
  }
  workspaceError.set('Ce dossier n’est pas un espace de travail fc-tactics. index.json doit contenir "type": "fc-tactics-workspace".');
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
  const info = await readJson<TrainerInfo & { produit?: string; prenom?: string; nom?: string }>(handle, 'index.json');
  trainer.set(trainerFromJson(info));
  categories.set(await listCategories(handle));
  styles.set(await listAllStyles(handle));
  workspaceOpen.set(true);
  const saved = cursor();
  if (saved?.folderName === handle.name) await restoreScreen(saved);
  else screen.set('home');
  ready = true;
  await saveSnapshot();
  persistCursor();
  return true;
}

async function restoreScreen(saved: WorkspaceCursor) {
  const want = saved.screen || 'home';
  const cat = get(categories).find(item => item.id === saved.categoryId);
  if (!cat || want === 'home' || want === 'gate') {
    screen.set('home');
    return;
  }
  const folder = await childDir(await childDir(root!, 'categories'), cat.id);
  categoryInfo.set(cat);
  seanceList.set(await listSeances(folder));
  if (want === 'category' || !saved.seanceFile) {
    screen.set('category');
    return;
  }
  const data = await readJson<SeanceFile>(await childDir(folder, 'seances'), saved.seanceFile);
  if (!data) {
    screen.set('category');
    return;
  }
  applySeance(data, saved.seanceFile, saved.exerciseId);
  screen.set(want === 'exercise' ? 'exercise' : 'seance');
}

function showStoredWorkspace(snap: WorkspaceSnapshot, handle: Dir | null) {
  const saved = cursor();
  root = handle;
  folderLabel.set(saved?.folderName || handle?.name || '');
  applySnapshot(snap, saved?.exerciseId);
  screen.set(screenFromCursor(saved));
  workspaceWritable.set(false);
  needsPermission.set(Boolean(handle));
  ready = true;
}

export async function restoreWorkspace(): Promise<boolean> {
  try {
    const saved = cursor();
    if (saved?.folderName) folderLabel.set(saved.folderName);
    const remembered = storedSnapshot();
    const handle = await within(idbGet<Dir>(HANDLE_KEY), 800, null);
    if (handle && await within(permitted(handle, false), 800, false)) {
      try {
        if (await adoptWorkspace(handle, false)) return true;
      } catch (err) {
        console.error(err);
      }
    }
    if (get(workspaceOpen) && remembered) {
      root = handle;
      needsPermission.set(Boolean(handle));
      return true;
    }
    const snap = remembered || await within(idbGet<WorkspaceSnapshot>(SNAPSHOT_KEY), 800, null);
    if (snap) {
      showStoredWorkspace(snap, handle);
      return true;
    }
    if (remembered) {
      showStoredWorkspace(remembered, handle);
      return true;
    }
    if (handle) {
      root = handle;
      folderLabel.set(saved?.folderName || handle.name);
      needsPermission.set(true);
    }
    screen.set('gate');
    return false;
  } finally {
    await reloadSharedWorkspace();
    restoring.set(false);
  }
}

export async function resumeWorkspace(): Promise<boolean> {
  const handle = root || await idbGet<Dir>(HANDLE_KEY);
  if (!handle) return pickWorkspace(false);
  if (!(await permitted(handle, true))) return false;
  const pending = get(workspaceWritable) ? null : (storedSnapshot() || await idbGet<WorkspaceSnapshot>(SNAPSHOT_KEY));
  const opened = await adoptWorkspace(handle, true);
  if (opened && pending?.seance && pending.seanceFile) {
    applySeance(pending.seance, pending.seanceFile, cursor()?.exerciseId);
    if (pending.styles?.length) styles.set(pending.styles);
    if (pending.trainer) trainer.set(pending.trainer);
    await saveOpenSeance();
  }
  return opened;
}

export async function categoryOds(): Promise<Uint8Array | null> {
  if (!root || !get(categoryInfo)) return null;
  const folder = await childDir(await childDir(root, 'categories'), get(categoryInfo)!.id);
  return readBytes(folder, ODS_NAME) || readBytes(root, ODS_NAME);
}

export async function storeCategoryOds(bytes: Uint8Array) {
  if (!root || !get(categoryInfo)) return;
  const folder = await childDir(await childDir(root, 'categories'), get(categoryInfo)!.id);
  await writeBytes(folder, ODS_NAME, bytes);
  const existing = await readBytes(root, ODS_NAME);
  if (!existing) await writeBytes(root, ODS_NAME, bytes);
}

export async function reloadSeances(files: SeanceFile[]) {
  if (!root || !get(categoryInfo)) return;
  const folder = await childDir(await childDir(root, 'categories'), get(categoryInfo)!.id);
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
