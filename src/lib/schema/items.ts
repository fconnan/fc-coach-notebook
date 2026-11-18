import type { ItemSpec } from './types';

export const GENRES = ['zone', 'formation', 'shape', 'object'] as const;
export type Genre = typeof GENRES[number];
export const WRAPPERS = ['zone', 'formation', 'shape'] as const;
export type Wrapper = typeof WRAPPERS[number];

const TEST_KEY = /^[\w-]+=[\w.-]+$/;

export interface GenreHit {
  genre: Genre;
  item: ItemSpec;
  index: number;
  /** Chemin YAML de l’appel, par exemple `items/3/zone/rect`. */
  ref: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isWrapperKey(key: string): key is Wrapper {
  return (WRAPPERS as readonly string[]).includes(key);
}

/** `- zone: { rect: … }` : le genre enveloppe un seul appel. */
export function unwrap(item: ItemSpec | undefined): { genre: Wrapper; item: ItemSpec } | null {
  if (!isRecord(item)) return null;
  const keys = Object.keys(item);
  if (keys.length !== 1 || !isWrapperKey(keys[0])) return null;
  const value = item[keys[0]];
  if (!isRecord(value) || Array.isArray(value)) return null;
  const inner = Object.keys(value);
  if (inner.length !== 1 || TEST_KEY.test(inner[0])) return null;
  return { genre: keys[0], item: value as ItemSpec };
}

/** Appels de `items`, plus les listes `zone`, `formation` et `shape` encore nichées dans un appel. */
export function genreHits(
  node: { items?: ItemSpec[]; zone?: ItemSpec[]; formation?: ItemSpec[]; shape?: ItemSpec[] } | null | undefined,
  base = ''
): GenreHit[] {
  const out: GenreHit[] = [];
  const prefix = base && !base.endsWith('/') ? `${base}/` : base;
  (node?.items || []).forEach((item, index) => {
    if (!isRecord(item)) return;
    const wrapped = unwrap(item);
    if (wrapped) {
      const type = Object.keys(wrapped.item)[0] || '';
      out.push({
        genre: wrapped.genre,
        item: wrapped.item,
        index,
        ref: `${prefix}items/${index}/${wrapped.genre}/${type}`
      });
      return;
    }
    const type = Object.keys(item)[0] || '';
    out.push({ genre: 'object', item, index, ref: `${prefix}items/${index}/${type}` });
  });
  for (const genre of ['zone', 'formation', 'shape'] as const) {
    (node?.[genre] || []).forEach((item, index) => {
      if (!isRecord(item)) return;
      const type = Object.keys(item)[0] || '';
      out.push({ genre, item, index, ref: `${prefix}${genre}/${index}/${type}` });
    });
  }
  return out;
}

export function hitsByGenre(
  node: Parameters<typeof genreHits>[0],
  base = ''
): Record<Genre, GenreHit[]> {
  const grouped: Record<Genre, GenreHit[]> = { zone: [], formation: [], shape: [], object: [] };
  for (const hit of genreHits(node, base)) grouped[hit.genre].push(hit);
  return grouped;
}

/** Entrées de `items` qui ne sont pas une zone, une formation ou une forme enveloppée. */
export function plainItems(items: ItemSpec[] | undefined): ItemSpec[] {
  return (items || []).filter(item => !unwrap(item));
}
