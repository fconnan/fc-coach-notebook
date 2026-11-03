import { folderSlug } from './exerciseFile';

export type WorkspaceArea = 'categories' | 'library' | 'seasons' | 'styles' | 'themes';
export type WorkspaceDoor = 'repertoire' | 'season' | 'studio';

export const WORKSPACE_AREAS: { id: WorkspaceArea; label: string }[] = [
  { id: 'categories', label: 'Catégories' },
  { id: 'library', label: 'Bibliothèque' },
  { id: 'seasons', label: 'Saisons' },
  { id: 'styles', label: 'Styles' },
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
    id: 'studio',
    label: 'Atelier',
    line: 'Bibliothèque d\'objets pour les schémas de séances.',
    children: [
      { id: 'library', label: 'Bibliothèque' },
      { id: 'styles', label: 'Styles' }
    ]
  }
];

export function doorOf(area: WorkspaceArea | ''): WorkspaceDoor | '' {
  if (area === 'themes') return 'repertoire';
  return WORKSPACE_DOORS.find(door => door.children.some(child => child.id === area))?.id || '';
}

export const LIBRARY_KINDS = [
  { id: 'objects', label: 'Objets' },
  { id: 'pitches', label: 'Terrains' },
  { id: 'shapes', label: 'Formes' }
] as const;

export type LibraryKind = (typeof LIBRARY_KINDS)[number]['id'];

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

export interface SeasonPlayer {
  id: string;
  name: string;
  evaluations: string[];
}

export interface SeasonInfo {
  id: string;
  uuid?: string;
  name: string;
  players: SeasonPlayer[];
  slots: SeasonSlot[];
}

export interface ThemeSessionInfo {
  id: string;
  folder: string;
  name: string;
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

export interface LibraryItem {
  domain: string;
  kind: LibraryKind;
  name: string;
  file: string;
}

export function areaLabel(id: WorkspaceArea): string {
  return WORKSPACE_AREAS.find(area => area.id === id)?.label || id;
}
