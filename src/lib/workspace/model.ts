import {
  DEFAULT_PAGE,
  STYLE_FIELDS,
  migratePage,
  type DrillFields,
  type Page,
  type PageMorphology
} from '$lib/stores/workspace';

export const ODS_NAME = 'classeur-fff-ligue-bretagne.ods';
export const PRODUCT = 'fc-tactics';
export const WORKSPACE_TYPE = 'fc-tactics-workspace';
export const CATEGORY_TYPE = 'fc-tactics-category';
export const SEANCE_TYPE = 'fc-tactics-seance';
export const EXERCISE_TYPE = 'fc-tactics-exercise';

export const PHASES = [
  'Conserver-progresser',
  'Déséquilibrer-finir',
  "S'opposer à la progression",
  "S'organiser pour protéger son but"
];

export const KINDS = [
  'Mise en train',
  'Procédé complémentaire',
  'Jeu',
  'Situation',
  'Exercice'
];

export const METHODS = ['Active', 'Directive'];

export const AREAS = [
  '1/2 terrain',
  'Surface de réparation',
  'Terrain foot à 11',
  'Foot à 8',
  'Zone centrale'
];

export const SECTION_TITLES = [
  'Objectif',
  'But',
  'Consignes',
  'Variables',
  'Comportements collectifs',
  'Comportements individuels',
  'Critères'
];

export const KNOWN = [
  { title: 'Objectif', key: 'objectif' },
  { title: 'But', key: 'but' },
  { title: 'Consignes', key: 'consignes' },
  { title: 'Variables', key: 'variables' },
  { title: 'Comportements collectifs', key: 'collectifs' },
  { title: 'Comportements individuels', key: 'individuels' },
  { title: 'Critères', key: 'criteres' }
] as const;

export type SectionKey = (typeof KNOWN)[number]['key'];

export interface TrainerInfo {
  type?: string;
  name: string;
}

export interface CategoryInfo {
  id: string;
  name: string;
}

export interface SeanceHeader {
  id: string;
  name: string;
  sheet: string;
  date: string;
  phase: string;
  principle: string;
  means: string;
}

export interface SeanceFile extends SeanceHeader {
  exercises: Page[];
}

export interface PageStyle {
  id: string;
  name: string;
  team1Color: string;
  team2Color: string;
  team1Size: number;
  team2Size: number;
  ballColor: string;
  ballSize: number;
  showFieldStripes: boolean;
  grassType: string;
  backgroundColor: string;
  hideGoals: boolean;
  goalNetOpacity: number;
  hidePitchLines: boolean;
  morphology: PageMorphology;
}

export function emptyTrainer(): TrainerInfo {
  return { type: WORKSPACE_TYPE, name: '' };
}

type LegacyTrainer = Partial<TrainerInfo> & { produit?: string; prenom?: string; nom?: string; product?: string };

export function trainerFromJson(info: LegacyTrainer | null | undefined): TrainerInfo {
  const legacy = [info?.prenom, info?.nom].filter(Boolean).join(' ');
  return { type: WORKSPACE_TYPE, name: (info?.name || legacy).trim() };
}

export function isWorkspaceIndex(info: LegacyTrainer | null | undefined): boolean {
  if (!info) return false;
  return info.type === WORKSPACE_TYPE || info.product === PRODUCT || info.produit === PRODUCT || Boolean(info.name || info.prenom || info.nom);
}

export function trainerLabel(t: TrainerInfo): string {
  return (t.name || '').trim();
}

const FORBIDDEN_DIR = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED_DIR = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function directoryNameIssue(raw: string, kind: 'répertoire' | 'fichier' = 'répertoire'): string | null {
  const name = raw.trim();
  if (!name) return kind === 'fichier' ? 'Indique un nom de fichier.' : 'Indique un nom de répertoire.';
  if (name === '.' || name === '..' || FORBIDDEN_DIR.test(name) || /[. ]$/.test(name) || RESERVED_DIR.test(name)) {
    return `Ce nom ne peut pas être un ${kind}. Évite \\ / : * ? " < > | et les espaces ou points en fin de nom.`;
  }
  return null;
}

export function slug(name: string): string {
  const s = (name || 'sans-titre')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'sans-titre';
}

export function styleFromPage(page: Page, id: string, name: string): PageStyle {
  return {
    id,
    name,
    team1Color: page.team1Color,
    team2Color: page.team2Color,
    team1Size: page.team1Size,
    team2Size: page.team2Size,
    ballColor: page.ballColor,
    ballSize: page.ballSize,
    showFieldStripes: page.showFieldStripes,
    grassType: page.grassType,
    backgroundColor: page.backgroundColor,
    hideGoals: page.hideGoals,
    goalNetOpacity: page.goalNetOpacity ?? 0.25,
    hidePitchLines: page.hidePitchLines,
    morphology: page.morphology || 'man'
  };
}

export function visualsFromStyle(style: PageStyle): Partial<Page> {
  const out: Partial<Page> = { styleId: style.id };
  for (const key of STYLE_FIELDS) {
    (out as Record<string, unknown>)[key] = style[key as keyof PageStyle];
  }
  return out;
}

export function blankExercise(name = 'Exercice 1'): Page {
  const page = structuredClone(DEFAULT_PAGE);
  page.id = crypto.randomUUID();
  page.name = name;
  page.drill = {};
  return page;
}

function headingKey(title: string): SectionKey | null {
  const t = title.trim().toLowerCase();
  if (/crit[eè]res/.test(t)) return 'criteres';
  return KNOWN.find(h => h.title.toLowerCase() === t)?.key ?? null;
}

/** Split markdown into the cells the official sheet knows, plus everything else. */
export function splitMarkdown(md: string): { sections: Partial<Record<SectionKey, string>>; extra: string } {
  const sections: Partial<Record<SectionKey, string>> = {};
  const extras: string[] = [];
  let bucket: string[] = [];
  let key: SectionKey | 'extra' = 'extra';

  const flush = () => {
    const text = bucket.join('\n').trim();
    bucket = [];
    if (!text) return;
    if (key === 'extra') extras.push(text);
    else sections[key] = sections[key] ? `${sections[key]}\n\n${text}` : text;
  };

  for (const line of (md || '').split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      const known = headingKey(m[2]);
      if (known) key = known;
      else {
        key = 'extra';
        bucket.push(line);
      }
      continue;
    }
    bucket.push(line);
  }
  flush();
  return { sections, extra: extras.join('\n\n').trim() };
}

/** Consignes cell: the consignes section, then any prose that has no cell of its own. */
export function consignesCell(md: string): string {
  const { sections, extra } = splitMarkdown(md);
  return [sections.consignes || '', extra].filter(Boolean).join('\n\n');
}

/** Replace one sheet section and keep the other cells, including unmapped prose. */
export function writeSection(md: string, key: SectionKey, value: string): string {
  const split = splitMarkdown(md);
  split.sections[key] = value;
  if (key === 'consignes') split.extra = '';
  const base = markdownFromCells(split.sections);
  if (key !== 'consignes' && split.extra) return `${base}\n\n${split.extra}`.trim();
  return base;
}

export function markdownFromCells(cells: Partial<Record<SectionKey, string>>): string {
  const parts: string[] = [];
  for (const h of KNOWN) {
    const text = cells[h.key]?.trim();
    if (text) parts.push(`## ${h.title}\n\n${text}`);
  }
  return parts.join('\n\n');
}

export function drillFromBlock(block: {
  kind?: string;
  method?: string;
  duration?: string;
  area?: string;
  headcount?: string;
}): DrillFields {
  return {
    kind: block.kind || '',
    method: block.method || '',
    duration: block.duration || '',
    area: block.area || '',
    headcount: block.headcount || '',
    equipment: ''
  };
}

/** Turn the previous single-page localStorage document into a séance, when it has content. */
export function legacySeance(): { seance: SeanceFile; style: PageStyle } | null {
  if (typeof localStorage === 'undefined') return null;
  let raw: string | null = null;
  try { raw = localStorage.getItem('fctactics_session'); } catch { return null; }
  if (!raw) return null;
  let data: { name?: string; page?: Partial<Page> };
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data?.page) return null;
  const page = migratePage(data.page);
  const hasContent = page.elements.length > 0 || (page.markdownContent || '').trim() || (data.name && data.name !== 'Sans titre');
  if (!hasContent) return null;
  const style = styleFromPage(page, 'style-1', 'Style 1');
  page.styleId = style.id;
  page.name = page.name || 'Exercice 1';
  return {
    style,
    seance: {
      id: crypto.randomUUID(),
      name: data.name || page.name || 'Séance',
      sheet: 'S1',
      date: page.session?.date || '',
      phase: '',
      principle: '',
      means: '',
      exercises: [page]
    }
  };
}
