const UUID_FOLDER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidFolder(name: string): boolean {
  return UUID_FOLDER.test(name);
}

export function orderByIds<T extends { id?: string }>(items: T[], ids: unknown, keyOf: (item: T) => string = item => item.id || ''): T[] {
  if (!Array.isArray(ids)) return items;
  const rank = new Map<string, number>();
  for (const id of ids) {
    if (typeof id === 'string' && id && !rank.has(id)) rank.set(id, rank.size);
  }
  if (!rank.size) return items;
  return items
    .map((item, index) => ({ item, index, place: rank.get(keyOf(item)) ?? rank.size + index }))
    .sort((a, b) => a.place - b.place || a.index - b.index)
    .map(entry => entry.item);
}

export function folderSlug(name: string): string {
  return name.trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function exerciseFolder(name: string): string {
  return folderSlug(name) || 'exercice';
}

const FIELDS = [
  ['Procédé', 'kind'],
  ['Méthode', 'method'],
  ['Durée', 'duration'],
  ['Aire', 'area'],
  ['Effectif', 'headcount'],
  ['Matériels', 'equipment']
] as const;

export interface ExerciseText {
  name: string;
  drill: {
    kind: string;
    method: string;
    duration: string;
    area: string;
    headcount: string;
    equipment: string;
  };
  markdownContent: string;
}

function emptyDrill(): ExerciseText['drill'] {
  return { kind: '', method: '', duration: '', area: '', headcount: '', equipment: '' };
}

export function exerciseDocument(text: ExerciseText): string {
  const lines = [`# ${text.name.trim() || 'Exercice'}`, ''];
  for (const [label, key] of FIELDS) {
    const value = text.drill[key]?.trim();
    if (value) lines.push(`- ${label}: ${value}`);
  }
  lines.push('');
  const body = text.markdownContent.trim();
  if (body) lines.push(body);
  return `${lines.join('\n').trim()}\n`;
}

export function parseExerciseDocument(source: string): ExerciseText {
  const labels = new Map(FIELDS.map(([label, key]) => [label.toLowerCase(), key]));
  const drill = emptyDrill();
  let name = '';
  let seenHeading = false;
  let inBody = false;
  const body: string[] = [];
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!inBody) {
      const heading = /^#\s+(.*)$/.exec(line);
      if (heading && !seenHeading) {
        seenHeading = true;
        const title = heading[1].trim();
        const numbered = /^(\d{2,})\s+-\s+(.+)$/.exec(title);
        if (numbered) {
          drill.kind = numbered[2].trim();
          continue;
        }
        if (title.toLowerCase() !== 'exercice') name = title;
        continue;
      }
      const field = /^[-*]\s+([^:]+):\s*(.*)$/.exec(line);
      if (field) {
        const key = labels.get(field[1].trim().toLowerCase());
        if (key) {
          drill[key] = field[2].trim();
          continue;
        }
      }
      if (!line.trim()) continue;
      inBody = true;
    }
    body.push(line);
  }
  return { name, drill, markdownContent: body.join('\n').trim() };
}

export function markdownTitle(source: string): string {
  return parseExerciseDocument(source).name;
}

/** Ordre stable de index.json. type reste le premier. */
const INDEX_ORDER = [
  'type', 'id', 'tags'
];

/** Déjà portés par content.md, ou ancien dessin jamais lu par le carnet. */
const DROPPED_INDEX_KEYS = new Set([
  'name',
  'session',
  'schemaVersion',
  'fieldTemplate',
  'nextTeam1Number', 'nextTeam2Number', 'showPlayerDetails', 'morphology',
  'team1Color', 'team2Color', 'team1Size', 'team2Size',
  'ballColor', 'ballSize', 'showFieldStripes', 'grassType', 'backgroundColor',
  'hideGoals', 'goalNetOpacity', 'hidePitchLines', 'view',
  'frames', 'activeFrameIndex', 'elements',
  'perspectiveTilt', 'perspectiveIntensity', 'perspectiveScale',
  'cam3dYaw', 'cam3dPitch', 'cam3dPosition', 'cam3dDistance', 'cam3dRadius', 'cam3dTarget',
  'playerAnimations'
]);

function exerciseTags(index: Record<string, unknown>): string[] {
  const tags: string[] = [];
  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const tag = value.trim().toLowerCase();
    if (tag && !tags.includes(tag)) tags.push(tag);
  };
  if (Array.isArray(index.tags)) for (const tag of index.tags) add(tag);
  const session = index.session;
  if (session && typeof session === 'object') add((session as { level?: unknown }).level);
  return tags;
}

export function orderExerciseIndex(index: Record<string, unknown>): Record<string, unknown> {
  const tags = exerciseTags(index);
  const ordered: Record<string, unknown> = {};
  for (const key of INDEX_ORDER) {
    if (key === 'tags') {
      if (tags.length) ordered.tags = tags;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(index, key)) ordered[key] = index[key];
  }
  for (const key of Object.keys(index)) {
    if (DROPPED_INDEX_KEYS.has(key) || key === 'tags') continue;
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) ordered[key] = index[key];
  }
  return ordered;
}

/** Champs de séance déjà portés par content.md, ou remplacés par le tag de l'exercice. */
const DROPPED_SESSION_KEYS = new Set(['name', 'audience', 'phase', 'principle', 'means']);
const SESSION_INDEX_ORDER = ['type', 'id', 'order', 'exercises'];

/** Le nom du thème est le titre de content.md. sessions reste la liste ordonnée. */
const DROPPED_THEME_KEYS = new Set(['name']);
const THEME_INDEX_ORDER = ['type', 'id', 'sessions'];

export function orderThemeIndex(index: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of THEME_INDEX_ORDER) {
    if (Object.prototype.hasOwnProperty.call(index, key)) ordered[key] = index[key];
  }
  for (const key of Object.keys(index)) {
    if (DROPPED_THEME_KEYS.has(key) || Object.prototype.hasOwnProperty.call(ordered, key)) continue;
    ordered[key] = index[key];
  }
  return ordered;
}

export function orderSessionIndex(index: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of SESSION_INDEX_ORDER) {
    if (Object.prototype.hasOwnProperty.call(index, key)) ordered[key] = index[key];
  }
  for (const key of Object.keys(index)) {
    if (DROPPED_SESSION_KEYS.has(key) || Object.prototype.hasOwnProperty.call(ordered, key)) continue;
    ordered[key] = index[key];
  }
  return ordered;
}

export function splitExerciseRecord(page: Record<string, unknown>): { index: Record<string, unknown>; document: string } {
  const raw = page.drill && typeof page.drill === 'object' ? page.drill as Partial<ExerciseText['drill']> : {};
  const drill = emptyDrill();
  for (const key of Object.keys(drill) as Array<keyof ExerciseText['drill']>) drill[key] = String(raw[key] || '');
  const document = exerciseDocument({
    name: String(page.name || ''),
    drill,
    markdownContent: String(page.markdownContent || '')
  });
  const index = { ...page };
  delete index.markdownContent;
  delete index.drill;
  return { index: orderExerciseIndex(index), document };
}

export function applyExerciseDocument(page: Record<string, unknown>, source: string | null): Record<string, unknown> {
  if (source == null) return page;
  const text = parseExerciseDocument(source);
  const previous = page.drill && typeof page.drill === 'object' ? page.drill : {};
  return {
    ...page,
    name: text.name || String(page.name || ''),
    drill: { ...previous, ...text.drill },
    markdownContent: text.markdownContent
  };
}
