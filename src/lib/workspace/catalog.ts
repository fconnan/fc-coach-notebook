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
    line: 'Ce sont des thèmes de séances.',
    children: []
  },
  {
    id: 'season',
    label: 'Saison',
    line: 'Le planning et les évaluations',
    children: [
      { id: 'seasons', label: 'Saisons' }
    ]
  },
  {
    id: 'studio',
    label: 'Atelier',
    line: 'Terrains, formes et couleurs',
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
  sheet: string;
  date: string;
  session: string;
  sessionName: string;
}

export interface SeasonInfo {
  id: string;
  uuid?: string;
  name: string;
  zone: string;
  from: string;
  to: string;
  categoryFolder: string;
  categoryName: string;
  slots: SeasonSlot[];
}

export interface ThemeSessionInfo {
  id: string;
  folder: string;
  name: string;
  audience: string;
  phase: string;
}

export interface ThemeInfo {
  id: string;
  name: string;
  uuid: string;
  sessions: ThemeSessionInfo[];
}

export const REPERTOIRE_TYPE = 'fccn-repertoire:0';

/** Key stored in the `themes` list of repertoire/index.json. */
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
