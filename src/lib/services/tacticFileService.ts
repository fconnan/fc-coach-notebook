import { importPage, isDirty, DEFAULT_PAGE, showTacticBrowser, activeDirectoryHandle, commitToActiveFrame, currentPage } from '$lib/stores/workspace';
import type { Page } from '$lib/stores/workspace';
import { get } from 'svelte/store';

// --- IndexedDB Helpers to store FileSystemHandles ---
const DB_NAME = 'FCTacticsDB';
const STORE_NAME = 'handles';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject('IndexedDB not supported');
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setStoredHandle(key: string, handle: FileSystemHandle) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, key);
  } catch (e) {
    console.error('Failed to store handle', e);
  }
}

async function getStoredHandle(key: string): Promise<FileSystemHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}
// ---------------------------------------------------

// Internal handle tracker synced with the global store
let _activeDirHandle: FileSystemDirectoryHandle | null = null;
activeDirectoryHandle.subscribe(h => _activeDirHandle = h);

/**
 * Saves a tactic into a directory as two files: {name}.json and {name}.md
 */
export async function saveTactic(page: Page, forceNewDir = false) {
  try {
    // Ensure the live canvas is persisted into the active animation frame
    commitToActiveFrame();
    page = get(currentPage) || page;
    let dirHandle = _activeDirHandle;
    
    if (!dirHandle || forceNewDir) {
      dirHandle = await (window as any).showDirectoryPicker();
      activeDirectoryHandle.set(dirHandle);
      await setStoredHandle('last_dir', dirHandle as any);
    }

    // Verify permission if it's a reconnected handle
    if (await (dirHandle as any).queryPermission({ mode: 'readwrite' }) !== 'granted') {
        if (await (dirHandle as any).requestPermission({ mode: 'readwrite' }) !== 'granted') {
            throw new Error('Permission denied');
        }
    }

    const baseName = (page.name || 'Tactic').replace(/[/\\?%*:|"<>]/g, '-');
    
    // 1. Serialize and save JSON (excluding markdown content for the JSON file)
    const jsonContent = { ...page };
    delete (jsonContent as any).markdownContent;
    
    const jsonHandle = await (dirHandle as any).getFileHandle(`${baseName}.json`, { create: true });
    const jsonWritable = await jsonHandle.createWritable();
    await jsonWritable.write(JSON.stringify(jsonContent, null, 2));
    await jsonWritable.close();
    
    // 2. Save Markdown content
    const mdHandle = await (dirHandle as any).getFileHandle(`${baseName}.md`, { create: true });
    const mdWritable = await mdHandle.createWritable();
    await mdWritable.write(page.markdownContent || '');
    await mdWritable.close();
    
    isDirty.set(false);
    return true;
  } catch (err) {
    if ((err as any).name === 'AbortError') return false;
    console.error('Save error:', err);
    alert('Erreur lors de la sauvegarde du fichier.');
    return false;
  }
}

export async function openDirectory() {
  try {
    const dirHandle = await (window as any).showDirectoryPicker();
    activeDirectoryHandle.set(dirHandle);
    await setStoredHandle('last_dir', dirHandle);
    return dirHandle;
  } catch (err) {
    if ((err as any).name === 'AbortError') return null;
    console.error('Directory open error:', err);
    return null;
  }
}

export async function loadTactic() {
    // This now just opens the directory picker and returns the handle
    return await openDirectory();
}

/**
 * Common logic to perform a load from a given directory handle.
 */
async function performLoadFromHandle(dirHandle: any, targetBaseName?: string) {
  let loadedData: Partial<Page> = {};
  let foundJson = false;
  let baseName = targetBaseName || '';
  
  if (!targetBaseName) {
      // 1. Find the first JSON file if no target specified
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          const file = await (entry as FileSystemFileHandle).getFile();
          const text = await file.text();
          try {
            const json = JSON.parse(text);
            loadedData = { ...json };
            foundJson = true;
            baseName = entry.name.replace('.json', '');
            break;
          } catch (e) {
            console.error('Invalid JSON file:', entry.name);
          }
        }
      }
  } else {
      // Load specific file
      try {
          const jsonHandle = await dirHandle.getFileHandle(`${targetBaseName}.json`);
          const file = await jsonHandle.getFile();
          const text = await file.text();
          loadedData = JSON.parse(text);
          foundJson = true;
      } catch (e) {
          console.warn(`JSON for ${targetBaseName} not found, creating from MD only?`);
          loadedData = { name: targetBaseName };
          foundJson = true; // Still "found" the tactic identity
      }
  }
  
  if (foundJson && baseName) {
    try {
      const mdHandle = await dirHandle.getFileHandle(`${baseName}.md`);
      const mdFile = await mdHandle.getFile();
      loadedData.markdownContent = await mdFile.text();
    } catch (e) {
      if (!targetBaseName) {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            const mdFile = await (entry as FileSystemFileHandle).getFile();
            loadedData.markdownContent = await mdFile.text();
            break;
          }
        }
      }
    }
    importPage(loadedData);
    isDirty.set(false);
    return true;
  }
  return false;
}

/**
 * Lists all tactics (.md files) in the active directory.
 */
export async function listTactics(): Promise<string[]> {
    if (!_activeDirHandle) return [];
    
    // Check permission
    if (await (_activeDirHandle as any).queryPermission({ mode: 'read' }) !== 'granted') {
        return [];
    }

    const tactics: string[] = [];
    for await (const entry of (_activeDirHandle as any).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            tactics.push(entry.name.replace('.md', ''));
        }
    }
    return tactics.sort();
}

/**
 * Loads a specific tactic by its base name.
 */
export async function loadTacticByName(baseName: string) {
    if (!_activeDirHandle) return false;
    const success = await performLoadFromHandle(_activeDirHandle, baseName);
    if (success) {
        localStorage.setItem('last_tactic', baseName);
    }
    return success;
}

/**
 * Checks if a tactic exists in the active directory.
 */
export async function checkTacticExists(baseName: string): Promise<boolean> {
    if (!_activeDirHandle) return false;
    try {
        await _activeDirHandle.getFileHandle(`${baseName}.md`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Creates a new empty tactic in the active directory.
 */
export async function createNewTactic(baseName: string) {
    if (!_activeDirHandle) return false;
    
    // Cleanup name
    const cleanName = baseName.replace(/\.(md|json)$/i, '');
    
    // Default initial data for a new tactic (removing ID to force a fresh one in importPage)
    const initialData: any = {
        ...DEFAULT_PAGE,
        name: cleanName,
        markdownContent: `# ${cleanName}`
    };
    delete initialData.id;
    
    try {
        // Save JSON
        const jsonHandle = await _activeDirHandle!.getFileHandle(`${cleanName}.json`, { create: true });
        const jsonWritable = await jsonHandle.createWritable();
        await jsonWritable.write(JSON.stringify(initialData, null, 2));
        await jsonWritable.close();
        
        // Save MD
        const mdHandle = await _activeDirHandle!.getFileHandle(`${cleanName}.md`, { create: true });
        const mdWritable = await mdHandle.createWritable();
        await mdWritable.write(initialData.markdownContent);
        await mdWritable.close();
        
        importPage(initialData);
        isDirty.set(false);
        return true;
    } catch (e) {
        console.error('Failed to create tactic', e);
        return false;
    }
}

/**
 * Re-reads data from the currently active directory.
 */
export async function reloadDataFromActiveDirectory() {
  if (!_activeDirHandle) return false;
  
  try {
    // Permission check
    if (await (_activeDirHandle as any).queryPermission({ mode: 'readwrite' }) !== 'granted') {
        if (await (_activeDirHandle as any).requestPermission({ mode: 'readwrite' }) !== 'granted') {
            return false;
        }
    }
    return await performLoadFromHandle(_activeDirHandle);
  } catch (e) {
    console.error('Reload error:', e);
    return false;
  }
}

/**
 * Strategy to reconnect to the last directory on startup
 */
export async function tryToReconnectDirectory() {
    const handle = await getStoredHandle('last_dir');
    if (handle) {
        activeDirectoryHandle.set(handle as FileSystemDirectoryHandle);
        
        // Auto-load logic
        const lastTactic = localStorage.getItem('last_tactic');
        if (lastTactic && await checkTacticExists(lastTactic)) {
            await loadTacticByName(lastTactic);
        } else {
            // Folder linked but no active tactic -> Open browser immediately
            showTacticBrowser.set(true);
        }
        return handle;
    }
    return null;
}

export function hasActiveDirectory() {
    return !!get(activeDirectoryHandle);
}

export function getActiveDirName() {
    return get(activeDirectoryHandle)?.name || '';
}


