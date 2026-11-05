import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type EditorGate = {
  dirty: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
};

const gates: EditorGate[] = [];
let leaveGranted = false;
let denyUntil = 0;
let pending: ((choice: 'save' | 'discard' | 'stay') => void) | null = null;
let inflight: Promise<boolean> | null = null;
let savingChoice = false;

export const unsavedAsk = writable(false);
export const unsavedSaving = writable(false);

export function registerEditorGate(gate: EditorGate): () => void {
  gates.push(gate);
  return () => {
    const index = gates.indexOf(gate);
    if (index >= 0) gates.splice(index, 1);
  };
}

function askChoice(): Promise<'save' | 'discard' | 'stay'> {
  unsavedAsk.set(true);
  return new Promise(resolve => {
    pending = resolve;
  });
}

export function chooseUnsaved(choice: 'save' | 'discard' | 'stay') {
  const resolve = pending;
  pending = null;
  unsavedAsk.set(false);
  resolve?.(choice);
}

/** true si les éditeurs ouverts, ou celui indiqué, peuvent être quittés. */
export function confirmLeaveEditors(scope?: EditorGate): Promise<boolean> {
  if (savingChoice || leaveGranted) return Promise.resolve(true);
  if (Date.now() < denyUntil) return Promise.resolve(false);
  if (inflight) return inflight;
  const dirty = (scope ? [scope] : gates).filter(gate => gates.includes(gate) && gate.dirty());
  if (!dirty.length) return Promise.resolve(true);
  inflight = (async () => {
    const choice = await askChoice();
    if (choice !== 'save' && choice !== 'discard') {
      denyUntil = Date.now() + 1000;
      return false;
    }
    if (choice === 'save') {
      unsavedSaving.set(true);
      savingChoice = true;
      try {
        for (const gate of dirty) {
          if (!gate.dirty()) continue;
          if (!(await gate.save())) {
            denyUntil = Date.now() + 1000;
            return false;
          }
        }
      } finally {
        savingChoice = false;
        unsavedSaving.set(false);
      }
    } else {
      for (const gate of dirty) gate.discard();
    }
    leaveGranted = true;
    setTimeout(() => { leaveGranted = false; }, 0);
    return true;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

if (browser) {
  window.addEventListener('beforeunload', event => {
    if (!gates.some(gate => gate.dirty())) return;
    event.preventDefault();
    event.returnValue = '';
  });
}
