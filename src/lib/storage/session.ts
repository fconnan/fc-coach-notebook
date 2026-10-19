import { get } from 'svelte/store';
import { currentPage, tacticName, isDirty, importPage, pages } from '$lib/stores/workspace';
import { currentRef, type SaveRef } from './index';
import { idbSet, idbGet } from './idb';

const KEY = 'fctactics_session';
const HANDLE_KEY = 'last_device_handle';

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function refToJSON(ref: SaveRef | null): any {
  if (!ref) return null;
  if (ref.provider === 'device') return { provider: 'device', name: ref.name }; // handle persisted separately in IDB
  return ref;
}

function write() {
  if (typeof localStorage === 'undefined') return;
  try {
    const page = get(currentPage);
    if (!page) return;
    const name = get(tacticName);
    const payload = { name, page: { ...page, name }, ref: refToJSON(get(currentRef)) };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch { /* quota or serialization issue: ignore */ }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(write, 700);
}

/** Begins persisting the working document to localStorage on every change. */
export function startAutosave() {
  if (started || typeof window === 'undefined') return;
  started = true;

  pages.subscribe(schedule);
  tacticName.subscribe(schedule);
  currentRef.subscribe((ref) => {
    if (ref && ref.provider === 'device' && ref.handle) idbSet(HANDLE_KEY, ref.handle);
    schedule();
  });

  // Best-effort flush before the tab closes.
  window.addEventListener('beforeunload', write);
}

/** Restores the last working document (content + name + destination) if any. */
export function restoreSession(): boolean {
  if (typeof localStorage === 'undefined') return false;
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); } catch { return false; }
  if (!raw) return false;

  let data: any;
  try { data = JSON.parse(raw); } catch { return false; }
  if (!data?.page) return false;

  importPage(data.page);
  tacticName.set(data.name || data.page.name || 'Sans titre');

  const ref = data.ref as SaveRef | null;
  if (ref && ref.provider === 'device') {
    // Rehydrate the file handle asynchronously so Ctrl+S keeps targeting the same file.
    idbGet(HANDLE_KEY).then((handle) => {
      currentRef.set(handle ? { provider: 'device', name: ref.name, handle } : null);
    });
  } else {
    currentRef.set(ref ?? null);
  }

  isDirty.set(false);
  return true;
}
