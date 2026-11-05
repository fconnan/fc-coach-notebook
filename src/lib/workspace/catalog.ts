import { folderSlug } from './exerciseFile';

export type WorkspaceArea = 'categories' | 'elements' | 'seasons' | 'themes';
export type WorkspaceDoor = 'repertoire' | 'season' | 'elements';

export const WORKSPACE_AREAS: { id: WorkspaceArea; label: string }[] = [
  { id: 'categories', label: 'Catégories' },
  { id: 'elements', label: 'Éléments' },
  { id: 'seasons', label: 'Saisons' },
  { id: 'themes', label: 'Thèmes' }
];

export const WORKSPACE_DOORS: {
  id: WorkspaceDoor;
  label: string;
  line: string;
  children: { id: WorkspaceArea; label: string }[];
}[] = [
  {
    id: 'repertoire',
    label: 'Thèmes',
    line: 'Bibliothèque d\'exercices regroupés par thèmes.',
    children: []
  },
  {
    id: 'season',
    label: 'Saisons',
    line: 'Planning des séances d\'entraînement et des évaluations des joueurs.',
    children: [
      { id: 'seasons', label: 'Saisons' }
    ]
  },
  {
    id: 'elements',
    label: 'Éléments',
    line: 'Objets, terrains et compositions de base pour les schémas.',
    children: [
      { id: 'elements', label: 'Éléments' }
    ]
  }
];

export function doorOf(area: WorkspaceArea | ''): WorkspaceDoor | '' {
  if (area === 'themes') return 'repertoire';
  return WORKSPACE_DOORS.find(door => door.children.some(child => child.id === area))?.id || '';
}

export interface SeasonSlot {
  date: string;
  session: string;
  sessionName: string;
  exercises?: string[];
}

export const COACH_IMAGE = 'coach.jpg';
export const PLAYER_IMAGE = 'player.jpg';
export const PLAYERS_DIR = 'players';
export const EVALUATIONS_DIR = 'evaluations';

export function coachName(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string') {
    return (value as { name: string }).name.trim();
  }
  return '';
}

export function playerNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const name = item.trim();
    const id = folderSlug(name);
    if (!name || !id || seen.has(id)) continue;
    seen.add(id);
    names.push(name);
  }
  return names;
}

const PLAYER_ITEM = /^([-*+]\s+)(.+?)\s*$/;

/** Les joueurs de la saison sont les items de premier niveau de son content.md. */
export function seasonPlayerNames(markdown: string): string[] {
  return playerNames(markdown.split(/\r?\n/).flatMap(line => {
    const match = PLAYER_ITEM.exec(line);
    return match ? [match[2]] : [];
  }));
}

export function renameSeasonPlayer(markdown: string, playerId: string, name: string): string | null {
  let found = false;
  const lines = markdown.split(/\r?\n/).map(line => {
    const match = PLAYER_ITEM.exec(line);
    if (found || !match || folderSlug(match[2]) !== playerId) return line;
    found = true;
    return `${match[1]}${name}`;
  });
  return found ? lines.join('\n') : null;
}

export interface SeasonPlayer {
  id: string;
  name: string;
  evaluations: string[];
}

export interface SeasonInfo {
  id: string;
  uuid?: string;
  name: string;
  markdown: string;
  players: SeasonPlayer[];
  slots: SeasonSlot[];
}

export interface ThemeSessionInfo {
  id: string;
  folder: string;
  name: string;
  exercises: number;
}

type StoredSlot = { session?: unknown; exercises?: unknown };

/** Créneaux d'une saison sans les séances ni les exercices supprimés, ou null si rien ne change. */
export function pruneSlots<T extends StoredSlot>(slots: T[], sessions: Set<string>, exercises: Set<string>): T[] | null {
  let changed = false;
  const next = slots.flatMap(slot => {
    if (sessions.has(String(slot.session || ''))) {
      changed = true;
      return [];
    }
    if (!Array.isArray(slot.exercises) || !slot.exercises.some(id => exercises.has(id))) return [slot];
    changed = true;
    return [{ ...slot, exercises: slot.exercises.filter(id => !exercises.has(id)) }];
  });
  return changed ? next : null;
}

export interface ThemeInfo {
  id: string;
  name: string;
  uuid: string;
  sessions: ThemeSessionInfo[];
}

export const REPERTOIRE_TYPE = 'fccn-repertoire:0';

/** Dossier des thèmes dans l'espace de travail (`data/themes`). */
export const THEMES_DIR = 'themes';

/** Dossier des saisons dans l'espace de travail (`data/seasons/<titre>`). */
export const SEASONS_DIR = 'seasons';

/** Key stored in the `themes` list of themes/index.json. */
export function themeKey(theme: Pick<ThemeInfo, 'id' | 'uuid'>): string {
  return theme.uuid || theme.id;
}

export type LibraryFileKind = 'folder' | 'yaml' | 'svg';

export interface LibraryItem {
  /** Chemin depuis la racine des données, par exemple `elements/objects/cone.yaml`. */
  path: string;
  name: string;
  kind: LibraryFileKind;
}

/** Chemin sous `elements/`, sans le préfixe. */
export function elementRel(path: string): string {
  return path.startsWith('elements/') ? path.slice('elements/'.length) : path;
}

export function areaLabel(id: WorkspaceArea): string {
  return WORKSPACE_AREAS.find(area => area.id === id)?.label || id;
}
