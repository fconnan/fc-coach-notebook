import { get, writable } from 'svelte/store';
import {
  currentPage,
  importPage,
  commitToActiveFrame,
  isDirty,
  tacticName,
  showSaveDialog
} from '$lib/stores/workspace';
import {
  saveDeviceNew,
  saveDeviceExisting,
  openDevice,
  downloadFile,
  supportsFS
} from './device';
import {
  cloudSave,
  cloudLoad,
  type CloudProvider,
  type CloudItem
} from './cloudClient';

export type Provider = 'device' | 'download' | CloudProvider;

export type SaveRef =
  | { provider: 'device'; name: string; handle: any }
  | { provider: 'google'; name: string; id?: string }
  | { provider: 'github'; name: string }
  | { provider: 'gitlab'; name: string };

/** Where the current tactic is currently persisted (drives Ctrl+S overwrite). */
export const currentRef = writable<SaveRef | null>(null);

function sanitize(name: string): string {
  return (name || 'Sans titre').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Sans titre';
}

/** Builds the single-file JSON payload (markdown is embedded in the page). */
export function serialize(name: string): string {
  commitToActiveFrame();
  const page = get(currentPage);
  const payload = { ...page, name };
  return JSON.stringify(payload, null, 2);
}

function applyLoaded(content: string, name: string, ref: SaveRef | null) {
  const data = JSON.parse(content);
  data.name = name;
  importPage(data);
  tacticName.set(name);
  currentRef.set(ref);
  isDirty.set(false);
}

// ---------------------------------------------------------------
// Save
// ---------------------------------------------------------------

export async function saveTo(provider: Provider, rawName: string): Promise<boolean> {
  const name = sanitize(rawName);
  const content = serialize(name);

  try {
    switch (provider) {
      case 'device': {
        const handle = await saveDeviceNew(name, content);
        if (handle) currentRef.set({ provider: 'device', name, handle });
        break;
      }
      case 'download':
        downloadFile(`${name}.json`, content);
        break;
      case 'google': {
        const ref = await cloudSave('google', name, content);
        currentRef.set({ provider: 'google', name, id: ref.id });
        break;
      }
      case 'github':
        await cloudSave('github', name, content);
        currentRef.set({ provider: 'github', name });
        break;
      case 'gitlab':
        await cloudSave('gitlab', name, content);
        currentRef.set({ provider: 'gitlab', name });
        break;
    }
    tacticName.set(name);
    isDirty.set(false);
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError') return false;
    console.error('Save error', err);
    alert(`Échec de l'enregistrement : ${err?.message ?? err}`);
    return false;
  }
}

/** Re-saves to the existing destination, or opens the save dialog if none. */
export async function quickSave(): Promise<boolean> {
  const ref = get(currentRef);
  if (!ref) {
    showSaveDialog.set(true);
    return false;
  }
  const name = ref.name;
  const content = serialize(name);
  try {
    switch (ref.provider) {
      case 'device':
        if (ref.handle) await saveDeviceExisting(ref.handle, content);
        else downloadFile(`${name}.json`, content);
        break;
      case 'google':
        await cloudSave('google', name, content, ref.id);
        break;
      case 'github':
        await cloudSave('github', name, content);
        break;
      case 'gitlab':
        await cloudSave('gitlab', name, content);
        break;
    }
    isDirty.set(false);
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError') return false;
    console.error('Save error', err);
    alert(`Échec de l'enregistrement : ${err?.message ?? err}`);
    return false;
  }
}

// ---------------------------------------------------------------
// Open
// ---------------------------------------------------------------

export async function openFromDevice(): Promise<boolean> {
  try {
    const res = await openDevice();
    if (!res) return false;
    applyLoaded(res.content, res.name, res.handle ? { provider: 'device', name: res.name, handle: res.handle } : null);
    return true;
  } catch (err: any) {
    if (err?.name === 'AbortError') return false;
    alert(`Échec de l'ouverture : ${err?.message ?? err}`);
    return false;
  }
}

export async function openCloud(provider: CloudProvider, item: CloudItem): Promise<boolean> {
  try {
    const content = await cloudLoad(provider, item);
    const ref: SaveRef =
      provider === 'google'
        ? { provider: 'google', name: item.name, id: item.id }
        : provider === 'github'
          ? { provider: 'github', name: item.name }
          : { provider: 'gitlab', name: item.name };
    applyLoaded(content, item.name, ref);
    return true;
  } catch (err: any) {
    alert(`Échec de l'ouverture : ${err?.message ?? err}`);
    return false;
  }
}

export { supportsFS };
