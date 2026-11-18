import { derived, writable } from 'svelte/store';
import type { ParamChoice, ParamSession } from './parameters';

const KEY = 'fccn-settings';
const LEGACY = 'fccn-view-params';

export interface AppSettings {
  params: ParamSession;
  hidden: string[];
}

export interface OfferEntry {
  id: string;
  name: string;
  icon: string;
}

export interface OfferGroup {
  folder: string;
  entries: OfferEntry[];
}

const EMPTY: AppSettings = { params: {}, hidden: [] };

/** Document de réglages. `null` si la forme n’est pas la sienne. */
export function readSettings(value: unknown): AppSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => key !== 'params' && key !== 'hidden')) return null;
  const params: ParamSession = {};
  if (raw.params !== undefined) {
    if (!raw.params || typeof raw.params !== 'object' || Array.isArray(raw.params)) return null;
    for (const [element, bag] of Object.entries(raw.params)) {
      if (!/^[\w.-]+$/.test(element)) return null;
      if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return null;
      const next: Record<string, string> = {};
      for (const [key, item] of Object.entries(bag)) {
        if (!/^[\w-]+$/.test(key) || typeof item !== 'string' || !item || !/^[\w.-]+$/.test(item)) return null;
        next[key] = item;
      }
      if (Object.keys(next).length) params[element] = next;
    }
  }
  const hidden: string[] = [];
  if (raw.hidden !== undefined) {
    if (!Array.isArray(raw.hidden)) return null;
    for (const id of raw.hidden) {
      if (typeof id !== 'string' || !/^[\w.-]+$/.test(id)) return null;
      if (!hidden.includes(id)) hidden.push(id);
    }
  }
  return { params, hidden };
}

function readLegacy(value: unknown): ParamSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const params: ParamSession = {};
  for (const [element, bag] of Object.entries(value)) {
    if (!/^[\w.-]+$/.test(element) || !bag || typeof bag !== 'object' || Array.isArray(bag)) continue;
    const next: Record<string, string> = {};
    for (const [key, item] of Object.entries(bag)) {
      if (/^[\w-]+$/.test(key) && typeof item === 'string' && item && /^[\w.-]+$/.test(item)) next[key] = item;
    }
    if (Object.keys(next).length) params[element] = next;
  }
  return params;
}

function loadSettings(): AppSettings {
  if (typeof sessionStorage === 'undefined') return { ...EMPTY, hidden: [] };
  try {
    const raw = sessionStorage.getItem(KEY);
    const current = raw ? readSettings(JSON.parse(raw)) : { params: {}, hidden: [] as string[] };
    if (!current) return { params: {}, hidden: [] };
    if (!Object.keys(current.params).length && !current.hidden.length) {
      const legacy = readLegacy(JSON.parse(sessionStorage.getItem(LEGACY) || 'null'));
      if (Object.keys(legacy).length) {
        sessionStorage.removeItem(LEGACY);
        return { params: legacy, hidden: [] };
      }
    }
    return current;
  } catch {
    return { params: {}, hidden: [] };
  }
}

/** Entrées encore proposées : celles dont l’identifiant n’est pas dans `hidden`. */
export function keptEntries<T extends { id: string }>(entries: T[], hidden: readonly string[]): T[] {
  const skip = new Set(hidden);
  return entries.filter(entry => !skip.has(entry.id));
}

export const settings = writable<AppSettings>(loadSettings());

/** Paramètres d’affichage. Ils ne modifient pas le fichier du schéma. */
export const viewSession = derived(settings, value => value.params);

/** Vrai pendant l’édition d’un schéma. */
export const settingsOpen = writable(false);

/** Paramètres déclarés par la bibliothèque. */
export const paramCatalog = writable<ParamChoice[]>([]);

/** Éléments proposés par la barre, dossier par dossier. */
export const offerCatalog = writable<OfferGroup[]>([]);

if (typeof sessionStorage !== 'undefined') {
  settings.subscribe(value => {
    try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* quota */ }
  });
}

export function publishSettings(choices: ParamChoice[], offers: OfferGroup[]) {
  settingsOpen.set(true);
  paramCatalog.set(choices);
  offerCatalog.set(offers);
}

export function clearSettings() {
  settingsOpen.set(false);
  paramCatalog.set([]);
  offerCatalog.set([]);
}

export function replaceSettings(next: AppSettings) {
  settings.set({ params: { ...next.params }, hidden: [...next.hidden] });
}

export function setViewStyle(element: string, key: string, value: string) {
  settings.update(current => {
    const params = { ...current.params, [element]: { ...current.params[element] } };
    if (value) params[element][key] = value;
    else delete params[element][key];
    if (!Object.keys(params[element] || {}).length) delete params[element];
    return { ...current, params };
  });
}

export function setHidden(id: string, hide: boolean) {
  settings.update(current => {
    const hidden = current.hidden.filter(item => item !== id);
    if (hide && !hidden.includes(id)) hidden.push(id);
    return { ...current, hidden };
  });
}
