import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export interface Bookmark {
  path: string;
  label: string;
}

const KEY = 'fctactics_bookmarks';

function parse(raw: string): Bookmark[] {
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is Bookmark => Boolean(item) && typeof item.path === 'string' && typeof item.label === 'string');
}

function load(): Bookmark[] {
  if (!browser) return [];
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return parse(saved);
    const legacy = sessionStorage.getItem(KEY);
    if (!legacy) return [];
    localStorage.setItem(KEY, legacy);
    return parse(legacy);
  } catch {
    return [];
  }
}

export const bookmarks = writable<Bookmark[]>(load());

if (browser) {
  bookmarks.subscribe((list) => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota */ }
  });
}

export function addBookmark(bookmark: Bookmark) {
  bookmarks.update(list => list.some(item => item.path === bookmark.path) ? list : [...list, bookmark]);
}

export function removeBookmark(path: string) {
  bookmarks.update(list => list.filter(item => item.path !== path));
}
