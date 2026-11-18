import { parse } from 'yaml';
import type { MarkPart, SchemaDoc } from './types';

export const CATEGORIES = ['version', 'settings', 'define', 'parameters', 'defaults', 'items', 'phases'] as const;

export const SETTING_KEYS = [
  'name', 'units', 'outline', 'width', 'length', 'margin', 'origin', 'boundary',
  'fixed', 'fit', 'listed', 'real-w', 'real-h', 'min-size', 'stretch-x', 'stretch-y',
  'upright', 'sizes', 'viewBox', 'trajectory'
] as const;

export const PART_KEYS = ['x', 'y', 'w', 'h', 'radius'] as const;

/** Réglages qu’un appel ou `defaults` peut recouvrir. */
export const ITEM_SETTING_KEYS = ['min-size', 'real-w', 'real-h', 'fit', 'fixed', 'upright', 'stretch-x', 'stretch-y'] as const;

const CATEGORY_LIST = CATEGORIES.join(', ');

export class SchemaLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaLayoutError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function entries(value: unknown, label: string): Array<[string, unknown]> {
  if (value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map(item => {
      if (!isRecord(item)) throw new SchemaLayoutError(`${label} : une entrée, une clé`);
      const keys = Object.keys(item);
      if (keys.length !== 1) throw new SchemaLayoutError(`${label} : une entrée, une clé`);
      return [keys[0], item[keys[0]]] as [string, unknown];
    });
  }
  if (isRecord(value)) return Object.entries(value);
  throw new SchemaLayoutError(`${label} illisible`);
}

function readSettings(value: unknown): Partial<SchemaDoc> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of entries(value, 'settings')) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) {
      throw new SchemaLayoutError(`Clé ${key} inconnue dans settings`);
    }
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      throw new SchemaLayoutError(`Clé ${key} en double dans settings`);
    }
    out[key] = item;
  }
  return out as Partial<SchemaDoc>;
}

function readPart(name: string, value: unknown): MarkPart {
  if (!isRecord(value)) throw new SchemaLayoutError(`define.${name} doit être un groupe de nombres`);
  const part: MarkPart = {};
  for (const [key, item] of Object.entries(value)) {
    if (!(PART_KEYS as readonly string[]).includes(key)) {
      throw new SchemaLayoutError(`Clé ${key} inconnue dans define.${name}`);
    }
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new SchemaLayoutError(`define.${name}.${key} doit être un nombre`);
    }
    part[key as keyof MarkPart] = item;
  }
  return part;
}

function readDefine(value: unknown): Record<string, MarkPart> | undefined {
  const out: Record<string, MarkPart> = {};
  for (const [key, item] of entries(value, 'define')) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      throw new SchemaLayoutError(`Nom ${key} en double dans define`);
    }
    out[key] = readPart(key, item);
  }
  return Object.keys(out).length ? out : undefined;
}

function asList<T>(value: unknown, key: string): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new SchemaLayoutError(`${key} doit être une liste`);
  return value as T[];
}

/** Document aplati : `settings` et `define` deviennent les champs internes. `items` reste tel quel. */
export function normalizeSchema(raw: unknown): SchemaDoc {
  if (!isRecord(raw)) throw new SchemaLayoutError('Document illisible');
  for (const key of Object.keys(raw)) {
    if (!(CATEGORIES as readonly string[]).includes(key)) {
      throw new SchemaLayoutError(`Clé ${key} hors catégorie (${CATEGORY_LIST})`);
    }
  }
  const out: SchemaDoc = {
    ...readSettings(raw.settings),
    version: raw.version === undefined ? undefined : String(raw.version)
  };
  const defined = readDefine(raw.define);
  if (defined) out.define = defined;
  const parameters = asList<NonNullable<SchemaDoc['parameters']>[number]>(raw.parameters, 'parameters');
  const defaults = asList<NonNullable<SchemaDoc['defaults']>[number]>(raw.defaults, 'defaults');
  const items = asList<NonNullable<SchemaDoc['items']>[number]>(raw.items, 'items');
  const phases = asList<NonNullable<SchemaDoc['phases']>[number]>(raw.phases, 'phases');
  if (parameters) out.parameters = parameters;
  if (defaults) out.defaults = defaults;
  if (items) out.items = items;
  if (phases) out.phases = phases;
  return out;
}

export function readSchema(source: string): SchemaDoc {
  return normalizeSchema(parse(source));
}

/**
 * Réglage d’une pose. L’argument de l’appel passe devant `defaults`, du document le plus proche au plus extérieur.
 * Les noms sont essayés dans l’ordre : le premier qui porte la clé l’emporte.
 */
export function instanceSetting(
  key: string,
  args: Record<string, unknown> | undefined,
  docs: Array<Record<string, Record<string, string>>> | undefined,
  names: string[]
): unknown {
  const direct = args?.[key];
  if (direct !== undefined) return direct;
  const frames = docs || [];
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    for (const name of names) {
      const value = frames[i]?.[name]?.[key];
      if (value !== undefined && value !== '') return value;
    }
  }
  return undefined;
}
