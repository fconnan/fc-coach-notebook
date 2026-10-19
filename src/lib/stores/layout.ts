import { writable, type Writable } from 'svelte/store';

function persisted<T>(key: string, initial: T): Writable<T> {
  let value = initial;
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) value = JSON.parse(raw);
    } catch { /* ignore */ }
  }
  const store = writable<T>(value);
  store.subscribe((v) => {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
    }
  });
  return store;
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const LEFT_MIN = 190, LEFT_MAX = 480;
export const NOTES_MIN = 240, NOTES_MAX = 680;
export const RIGHT_MIN = 220, RIGHT_MAX = 480;

// Panel widths (px) and visibility, persisted across reloads.
export const leftWidth = persisted<number>('fctactics_left_w', 250);
export const notesWidth = persisted<number>('fctactics_notes_w', 360);
export const rightWidth = persisted<number>('fctactics_right_w', 290);

export const showLeft = persisted<boolean>('fctactics_show_left', true);
export const showRight = persisted<boolean>('fctactics_show_right', true);
