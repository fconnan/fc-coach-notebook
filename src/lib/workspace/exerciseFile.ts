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

export function exerciseFolder(name: string): string {
  const slug = (name.trim() || 'exercice')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'exercice';
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
  return { index, document };
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
