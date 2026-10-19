import { writable, derived, get } from 'svelte/store';
import {
  buildElementAt,
  findFreePosition,
  pitchCenter,
  type LibraryPlaceArgs
} from '$lib/utils/placement';

// ---------------------------------------------------------
// Schema versioning
// ---------------------------------------------------------

export const SCHEMA_VERSION = 2;

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

export type ElementType =
  | 'player'
  | 'ball'
  | 'cone'
  | 'coneTall'
  | 'miniGoal'
  | 'fullGoal'
  | 'pole'
  | 'ladder'
  | 'hurdle'
  | 'mannequin'
  | 'ring'
  | 'arrow'
  | 'text'
  | 'callout'
  | 'rect'
  | 'ellipse'
  | 'zone'
  | 'field';

export type TeamType = 'team1' | 'team2' | 'none';

export type ShirtPattern = 'solid' | 'stripes' | 'hoops';
export type PlayerRole = 'outfield' | 'goalkeeper';

// Equipment element types (draggable training gear)
export const EQUIPMENT_TYPES: ElementType[] = [
  'cone', 'coneTall', 'miniGoal', 'fullGoal', 'pole', 'ladder', 'hurdle', 'mannequin', 'ring'
];

// Tool-driven annotation element types
export const DRAWING_TYPES: ElementType[] = ['arrow', 'text', 'callout', 'rect', 'ellipse', 'zone'];

export interface Position {
  x: number;
  y: number;
}

export interface ComponentElement {
  id: string;
  type: ElementType;
  team: TeamType;
  position: Position;
  // Generic visual properties
  radius?: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  angle?: number; // Rotation in degrees (0-359)
  locked?: boolean;
  zIndex?: number;

  // --- Arrows / paths ---
  endPosition?: Position; // Deprecated, using pathPoints for new arrows
  pathPoints?: Position[]; // Array of points for arrows/paths
  curveType?: 'L' | 'Q' | 'C' | 'S' | 'T';
  arrowStart?: boolean;
  arrowEnd?: boolean;
  headStart?: HeadStyle;
  headEnd?: HeadStyle;
  wavy?: boolean; // dribble / conduite (sinusoidal rendering)
  strokeDasharray?: string;
  linkedStartId?: string; // ID of the element the start point is linked to
  linkedEndId?: string;   // ID of the element the end point is linked to

  // --- Players ---
  leftLegLength?: number;
  rightLegLength?: number;
  name?: string;
  skinColor?: string;
  shirtColor?: string;
  shortColor?: string;
  shirtPattern?: ShirtPattern;
  role?: PlayerRole;

  // --- Text / shapes / callouts / zones ---
  text?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  fillColor?: string;
  fillOpacity?: number;
  width?: number;   // rect / zone / ellipse bbox / equipment
  height?: number;  // rect / zone / ellipse bbox / equipment
  calloutAnchor?: Position; // tip of the speech bubble (relative to position)
}

export type HeadStyle = 'none' | 'arrow' | 'bar' | 'double';

// Animation frame: a snapshot of element states
export interface Frame {
  id: string;
  name: string;
  durationMs: number;
  elements: ComponentElement[];
}

// Session / drill metadata (for the printable coaching sheet)
export interface SessionMeta {
  date?: string;
  durationMin?: number;
  level?: string;
  objective?: string;
  description?: string;
  coachingPoints?: string;
}

export interface Page {
  id: string;
  name: string;
  schemaVersion: number;
  fieldTemplate: 'Complet' | 'Demi' | 'DemiBas';
  nextTeam1Number: number;
  nextTeam2Number: number;
  markdownContent: string;
  elements: ComponentElement[];
  showPlayerDetails: boolean;
  // Global styles
  team1Color: string;
  team2Color: string;
  team1Size: number;
  team2Size: number;
  ballColor: string;
  ballSize: number;
  showFieldStripes: boolean;
  // Field / background customization
  grassType: string;
  backgroundColor: string;
  hideGoals: boolean;
  hidePitchLines: boolean;
  view: '2d' | 'perspective';
  /** Perspective presentation (view === 'perspective') */
  perspectiveTilt?: number;       // rotateX degrees (15–55)
  perspectiveIntensity?: number;  // 0 = léger, 100 = prononcé
  perspectiveScale?: number;      // fit scale (0.7–1)
  // Animation
  frames: Frame[];
  activeFrameIndex: number;
  // Session
  session: SessionMeta;
}

// ---------------------------------------------------------
// Defaults
// ---------------------------------------------------------

export const DEFAULT_PAGE: Page = {
  id: '1',
  name: '',
  schemaVersion: SCHEMA_VERSION,
  fieldTemplate: 'Complet',
  markdownContent: '',
  elements: [],
  nextTeam1Number: 1,
  nextTeam2Number: 1,
  showPlayerDetails: false,
  team1Color: '#5e6ad2',
  team2Color: '#d25e5e',
  team1Size: 14,
  team2Size: 14,
  ballColor: '#ffffff',
  ballSize: 8,
  showFieldStripes: true,
  grassType: 'stripes',
  backgroundColor: '#2b6b39',
  hideGoals: false,
  hidePitchLines: false,
  view: '2d',
  perspectiveTilt: 34,
  perspectiveIntensity: 62,
  perspectiveScale: 0.86,
  frames: [],
  activeFrameIndex: 0,
  session: {}
};

/**
 * Normalises any loaded page-like object up to the current schema version.
 * Keeps backward compatibility with v0/v1 tactic files.
 */
export function migratePage(data: Partial<Page>): Page {
  const merged: Page = { ...DEFAULT_PAGE, ...data } as Page;
  // Ensure structural fields exist even if an old file omitted them
  if (!Array.isArray(merged.elements)) merged.elements = [];
  if (!Array.isArray(merged.frames)) merged.frames = [];
  if (typeof merged.activeFrameIndex !== 'number') merged.activeFrameIndex = 0;
  if (!merged.session) merged.session = {};
  if (!merged.grassType) merged.grassType = 'stripes';
  if (!merged.backgroundColor) merged.backgroundColor = '#2b6b39';
  if (!merged.view) merged.view = '2d';
  if (typeof merged.perspectiveTilt !== 'number') merged.perspectiveTilt = DEFAULT_PAGE.perspectiveTilt;
  if (typeof merged.perspectiveIntensity !== 'number') merged.perspectiveIntensity = DEFAULT_PAGE.perspectiveIntensity;
  if (typeof merged.perspectiveScale !== 'number') merged.perspectiveScale = DEFAULT_PAGE.perspectiveScale;
  merged.schemaVersion = SCHEMA_VERSION;
  return merged;
}

// ---------------------------------------------------------
// Stores
// ---------------------------------------------------------

// List of all pages
export const pages = writable<Page[]>([structuredClone(DEFAULT_PAGE)]);

// Currently focused page ID
export const currentPageId = writable<string>('1');

// Currently selected element IDs on the active page
export const selectedIds = writable<string[]>([]);

// Currently active tool (e.g., 'arrow', 'text', 'rect'...)
export const activeTool = writable<ElementType | null>(null);

// Unsaved changes flag
export const isDirty = writable<boolean>(false);

// Flag to track if a tactic (file set) is currently loaded and active.
// In the draw.io-style UX the app always starts with a ready-to-draw blank pitch.
export const isTacticLoaded = writable<boolean>(true);

// Display name of the current tactic file (without extension)
export const tacticName = writable<string>('Sans titre');

// UI theme ('light' | 'dark'), light by default
export const theme = writable<'light' | 'dark'>('light');

// Side notes (markdown session) panel toggle
export const showNotes = writable<boolean>(false);

// Save dialog & connections dialog visibility
export const showSaveDialog = writable<boolean>(false);
export const showConnections = writable<boolean>(false);

// Track the active directory handle reactively
export const activeDirectoryHandle = writable<FileSystemDirectoryHandle | null>(null);

// Pulse to trigger component re-mounts on data load
export const refreshCounter = writable<number>(0);

// Global control for the Tactic Browser modal visibility
export const showTacticBrowser = writable<boolean>(false);

// Global control for the Export dialog visibility
export const showExportDialog = writable<boolean>(false);

// Viewport (zoom & pan)
export const zoom = writable<number>(1);
export const pan = writable<Position>({ x: 0, y: 0 });

// Clipboard for copy/paste
export const clipboard = writable<ComponentElement[]>([]);

// Animation playback state
export const isPlaying = writable<boolean>(false);
// Interpolated elements shown on the canvas while playing
export const playbackElements = writable<ComponentElement[]>([]);

// Derived store to get the currently active page object easily
export const currentPage = derived(
  [pages, currentPageId],
  ([$pages, $currentPageId]) => {
    return $pages.find(p => p.id === $currentPageId) || $pages[0];
  }
);

// Derived store to get the selected element(s) objects
export const selectedElements = derived(
  [currentPage, selectedIds],
  ([$currentPage, $selectedIds]) => {
    return $currentPage?.elements.filter(el => $selectedIds.includes(el.id)) || [];
  }
);

// ---------------------------------------------------------
// History (Undo / Redo)
// ---------------------------------------------------------

export const historyPast = writable<Page[][]>([]);
export const historyFuture = writable<Page[][]>([]);
export const canUndo = derived(historyPast, ($p) => $p.length > 0);
export const canRedo = derived(historyFuture, ($f) => $f.length > 0);

const HISTORY_LIMIT = 60;
const COALESCE_MS = 400;
let lastSnapshotTime = 0;

/**
 * Snapshot the current pages state before a mutation.
 * Rapid successive calls (e.g. during a drag) are coalesced into a single
 * undo step unless `force` is set.
 */
export function pushHistory(force = false) {
  const now = Date.now();
  if (!force && now - lastSnapshotTime < COALESCE_MS) return;
  lastSnapshotTime = now;
  const snap = structuredClone(get(pages));
  historyPast.update(p => {
    const next = [...p, snap];
    return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
  });
  historyFuture.set([]);
}

export function undo() {
  const past = get(historyPast);
  if (past.length === 0) return;
  const prev = past[past.length - 1];
  historyPast.set(past.slice(0, -1));
  historyFuture.update(f => [structuredClone(get(pages)), ...f]);
  pages.set(prev);
  isDirty.set(true);
  lastSnapshotTime = 0;
}

export function redo() {
  const future = get(historyFuture);
  if (future.length === 0) return;
  const next = future[0];
  historyFuture.set(future.slice(1));
  historyPast.update(p => [...p, structuredClone(get(pages))]);
  pages.set(next);
  isDirty.set(true);
  lastSnapshotTime = 0;
}

function resetHistory() {
  historyPast.set([]);
  historyFuture.set([]);
  lastSnapshotTime = 0;
}

// ---------------------------------------------------------
// Actions (Reducers / Mutations)
// ---------------------------------------------------------

export function addElement(element: Omit<ComponentElement, 'id'>) {
  pushHistory(true);
  const newElement: ComponentElement = {
    ...element,
    id: crypto.randomUUID()
  };

  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, elements: [...page.elements, newElement] };
      }
      return page;
    });
  });

  // Select the newly added element
  selectedIds.set([newElement.id]);
  return newElement.id;
}

/** Place a library item at a given position (with collision offset). */
export function placeElementAt(position: Position, args: LibraryPlaceArgs) {
  const page = get(currentPage);
  if (!page) return;
  activeTool.set(null);
  const pos = findFreePosition(position, page.elements);
  addElement(buildElementAt(page, pos, args));
  if (args.type === 'player' && args.label !== 'G' && args.team && args.team !== 'none') {
    incrementTeamNumber(args.team);
  }
}

/** Place a library item at the centre of the visible pitch. */
export function placeAtCenter(args: LibraryPlaceArgs) {
  const page = get(currentPage);
  if (!page) return;
  placeElementAt(pitchCenter(page.fieldTemplate), args);
}

export function updateElement(id: string, updates: Partial<ComponentElement>) {
  pushHistory();
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        // 1. Update the targeted element
        const nextElements = page.elements.map(el => el.id === id ? { ...el, ...updates } : el);
        const movedEl = nextElements.find(el => el.id === id);

        // 2. If it's a move, update linked arrows
        if (movedEl && updates.position) {
          return {
            ...page,
            elements: nextElements.map(el => {
              if (el.type === 'arrow' && (el.linkedStartId === id || el.linkedEndId === id)) {
                const newPoints = [...(el.pathPoints || [el.position, el.endPosition || { x: el.position.x + 50, y: el.position.y }])];
                let changed = false;
                if (el.linkedStartId === id) {
                  newPoints[0] = movedEl.position;
                  changed = true;
                }
                if (el.linkedEndId === id) {
                  newPoints[newPoints.length - 1] = movedEl.position;
                  changed = true;
                }
                if (changed) {
                  return { ...el, pathPoints: newPoints, position: newPoints[0] };
                }
              }
              return el;
            })
          };
        }
        return { ...page, elements: nextElements };
      }
      return page;
    });
  });
}

/** Move several elements by a delta (used for group drag). */
export function moveElements(ids: string[], dx: number, dy: number, base: Record<string, Position>) {
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id !== activeId) return page;
      const moved = page.elements.map(el => {
        if (!ids.includes(el.id) || !base[el.id]) return el;
        const np = { x: base[el.id].x + dx, y: base[el.id].y + dy };
        if (el.type === 'arrow' && el.pathPoints && base[el.id + ':path']) {
          const bp = (base as any)[el.id + ':path'] as Position[];
          return { ...el, position: np, pathPoints: bp.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) };
        }
        return { ...el, position: np };
      });
      return { ...page, elements: moved };
    });
  });
}

export function removeElements(ids: string[]) {
  pushHistory(true);
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return {
          ...page,
          elements: page.elements.filter(el => !ids.includes(el.id))
        };
      }
      return page;
    });
  });

  // Clear selection if deleted
  selectedIds.update(current => current.filter(id => !ids.includes(id)));
}

export function deleteSelected() {
  const ids = get(selectedIds);
  if (ids.length > 0) {
    removeElements(ids);
  }
}

// ---------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------

export function selectElement(id: string, additive = false) {
  selectedIds.update(curr => {
    if (additive) {
      return curr.includes(id) ? curr.filter(i => i !== id) : [...curr, id];
    }
    return curr.includes(id) && curr.length === 1 ? curr : [id];
  });
}

export function clearSelection() {
  selectedIds.set([]);
}

// ---------------------------------------------------------
// Clipboard
// ---------------------------------------------------------

export function copySelection() {
  const els = get(selectedElements);
  if (els.length > 0) {
    clipboard.set(structuredClone(els));
  }
}

export function cutSelection() {
  copySelection();
  deleteSelected();
}

export function pasteClipboard() {
  const items = get(clipboard);
  if (!items.length) return;
  pushHistory(true);
  isDirty.set(true);
  const OFFSET = 30;
  const newIds: string[] = [];
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id !== activeId) return page;
      const clones = items.map(it => {
        const id = crypto.randomUUID();
        newIds.push(id);
        const clone: ComponentElement = {
          ...structuredClone(it),
          id,
          position: { x: it.position.x + OFFSET, y: it.position.y + OFFSET },
          linkedStartId: undefined,
          linkedEndId: undefined
        };
        if (clone.pathPoints) {
          clone.pathPoints = clone.pathPoints.map(pt => ({ x: pt.x + OFFSET, y: pt.y + OFFSET }));
        }
        return clone;
      });
      return { ...page, elements: [...page.elements, ...clones] };
    });
  });
  selectedIds.set(newIds);
}

export function duplicateSelection() {
  copySelection();
  pasteClipboard();
}

// ---------------------------------------------------------
// Layer ordering
// ---------------------------------------------------------

export function bringToFront(ids: string[]) {
  reorder(ids, 'front');
}
export function sendToBack(ids: string[]) {
  reorder(ids, 'back');
}
function reorder(ids: string[], where: 'front' | 'back') {
  pushHistory(true);
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id !== activeId) return page;
      const moving = page.elements.filter(el => ids.includes(el.id));
      const rest = page.elements.filter(el => !ids.includes(el.id));
      return { ...page, elements: where === 'front' ? [...rest, ...moving] : [...moving, ...rest] };
    });
  });
}

export function toggleLockSelection() {
  const els = get(selectedElements);
  const anyUnlocked = els.some(e => !e.locked);
  pushHistory(true);
  els.forEach(el => updateElementSilent(el.id, { locked: anyUnlocked }));
}

/** Update without pushing a fresh history entry (used inside batched ops). */
function updateElementSilent(id: string, updates: Partial<ComponentElement>) {
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => page.id === activeId
      ? { ...page, elements: page.elements.map(el => el.id === id ? { ...el, ...updates } : el) }
      : page);
  });
}

export function setFieldTemplate(template: 'Complet' | 'Demi' | 'DemiBas') {
  pushHistory(true);
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, fieldTemplate: template };
      }
      return page;
    });
  });
}

export function incrementTeamNumber(team: TeamType) {
  if (team === 'none') return;
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return {
          ...page,
          nextTeam1Number: team === 'team1' ? page.nextTeam1Number + 1 : page.nextTeam1Number,
          nextTeam2Number: team === 'team2' ? page.nextTeam2Number + 1 : page.nextTeam2Number
        };
      }
      return page;
    });
  });
}

export function setShowPlayerDetails(visible: boolean) {
  pushHistory(true);
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, showPlayerDetails: visible };
      }
      return page;
    });
  });
}

export function setMarkdownContent(content: string) {
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, markdownContent: content };
      }
      return page;
    });
  });
}

export function updatePageSettings(updates: Partial<Page>) {
  pushHistory();
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, ...updates };
      }
      return page;
    });
  });
}

// ---------------------------------------------------------
// Animation frames
// ---------------------------------------------------------

function patchActivePage(fn: (page: Page) => Page) {
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => (page.id === activeId ? fn(page) : page));
  });
}

/** Capture the current canvas elements into a brand-new frame at the end. */
export function captureFrame() {
  pushHistory(true);
  isDirty.set(true);
  patchActivePage(page => {
    const frames = page.frames.length === 0
      ? [makeFrame('Frame 1', page.elements)]
      : [...page.frames];
    const newFrame = makeFrame(`Frame ${frames.length + 1}`, page.elements);
    frames.push(newFrame);
    return { ...page, frames, activeFrameIndex: frames.length - 1 };
  });
}

export function makeFrame(name: string, elements: ComponentElement[]): Frame {
  return {
    id: crypto.randomUUID(),
    name,
    durationMs: 1000,
    elements: structuredClone(elements)
  };
}

/** Persist the live canvas into the active frame (if frames exist). */
export function commitToActiveFrame() {
  patchActivePage(page => {
    if (page.frames.length === 0) return page;
    const idx = Math.min(page.activeFrameIndex, page.frames.length - 1);
    const frames = page.frames.map((f, i) =>
      i === idx ? { ...f, elements: structuredClone(page.elements) } : f
    );
    return { ...page, frames };
  });
}

/** Load a frame's elements onto the live canvas. */
export function gotoFrame(index: number) {
  // Save current edits into the current frame first
  commitToActiveFrame();
  patchActivePage(page => {
    if (index < 0 || index >= page.frames.length) return page;
    return {
      ...page,
      activeFrameIndex: index,
      elements: structuredClone(page.frames[index].elements)
    };
  });
  selectedIds.set([]);
}

export function deleteFrame(index: number) {
  pushHistory(true);
  isDirty.set(true);
  patchActivePage(page => {
    if (page.frames.length <= 1) {
      // Removing the last frame disables animation mode
      return { ...page, frames: [], activeFrameIndex: 0 };
    }
    const frames = page.frames.filter((_, i) => i !== index);
    const newIdx = Math.max(0, Math.min(index, frames.length - 1));
    return { ...page, frames, activeFrameIndex: newIdx, elements: structuredClone(frames[newIdx].elements) };
  });
}

export function duplicateFrame(index: number) {
  pushHistory(true);
  isDirty.set(true);
  patchActivePage(page => {
    if (index < 0 || index >= page.frames.length) return page;
    const src = page.frames[index];
    const copy = makeFrame(`${src.name} (copie)`, src.elements);
    const frames = [...page.frames];
    frames.splice(index + 1, 0, copy);
    return { ...page, frames, activeFrameIndex: index + 1, elements: structuredClone(copy.elements) };
  });
}

export function setFrameDuration(index: number, durationMs: number) {
  isDirty.set(true);
  patchActivePage(page => ({
    ...page,
    frames: page.frames.map((f, i) => (i === index ? { ...f, durationMs } : f))
  }));
}

/**
 * Replaces all players of a team with a preset formation.
 * `positions` are absolute display-space coordinates.
 */
export function setTeamFormation(team: TeamType, positions: { label: string; x: number; y: number }[]) {
  if (team === 'none') return;
  pushHistory(true);
  isDirty.set(true);
  patchActivePage(page => {
    const others = page.elements.filter(el => !(el.type === 'player' && el.team === team));
    const color = team === 'team1' ? page.team1Color : page.team2Color;
    const size = team === 'team1' ? page.team1Size : page.team2Size;
    const players: ComponentElement[] = positions.map(p => ({
      id: crypto.randomUUID(),
      type: 'player',
      team,
      position: { x: p.x, y: p.y },
      label: p.label,
      radius: size,
      color,
      role: p.label === 'G' ? 'goalkeeper' : 'outfield',
      angle: team === 'team2' ? 180 : 0
    }));
    const maxNum = positions.reduce((m, p) => {
      const n = parseInt(p.label);
      return isNaN(n) ? m : Math.max(m, n);
    }, 0);
    return {
      ...page,
      elements: [...others, ...players],
      nextTeam1Number: team === 'team1' ? maxNum + 1 : page.nextTeam1Number,
      nextTeam2Number: team === 'team2' ? maxNum + 1 : page.nextTeam2Number
    };
  });
  selectedIds.set([]);
}

export function updateSession(updates: Partial<SessionMeta>) {
  isDirty.set(true);
  patchActivePage(page => ({ ...page, session: { ...page.session, ...updates } }));
}

/**
 * Replaces the entire session content with external data.
 * Always ensures a unique ID to trigger UI refreshes.
 */
export function importPage(data: Partial<Page>) {
  const newId = data.id || `page-${Date.now()}`;
  const newPage: Page = migratePage({ ...data, id: newId });

  pages.set([newPage]);
  currentPageId.set(newId);
  if (newPage.name) tacticName.set(newPage.name);
  refreshCounter.update(n => n + 1);
  selectedIds.set([]);
  resetHistory();
  zoom.set(1);
  pan.set({ x: 0, y: 0 });
  isTacticLoaded.set(true);
}

/**
 * Resets the workspace to a fresh blank tactic (ready to draw).
 */
export function newTactic() {
  const blank = structuredClone(DEFAULT_PAGE);
  blank.id = `page-${Date.now()}`;
  pages.set([blank]);
  currentPageId.set(blank.id);
  tacticName.set('Sans titre');
  isTacticLoaded.set(true);
  isDirty.set(false);
  selectedIds.set([]);
  resetHistory();
  zoom.set(1);
  pan.set({ x: 0, y: 0 });
  refreshCounter.update(n => n + 1);
}

/**
 * Resets the session to the empty/welcome state.
 */
export function unloadTactic() {
  pages.set([structuredClone(DEFAULT_PAGE)]);
  isTacticLoaded.set(false);
  isDirty.set(false);
  selectedIds.set([]);
  resetHistory();
}

// History stack (kept for compatibility; superseded by historyPast/Future)
export const historyStack = writable<any[]>([]);
export const historyIndex = writable<number>(-1);

// Helper to grab value non-reactively when needed
function getCurrentPageId() {
  return get(currentPageId);
}
