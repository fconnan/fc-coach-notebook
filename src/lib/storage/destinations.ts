import { writable } from 'svelte/store';

// Non-secret "where to save" preferences. Tokens live server-side in httpOnly cookies.
export interface Destinations {
  github: { repo: string; branch: string; path: string };
  gitlab: { projectId: string; branch: string; path: string };
}

const DEFAULTS: Destinations = {
  github: { repo: '', branch: '', path: 'tactiques' },
  gitlab: { projectId: '', branch: 'main', path: 'tactiques' }
};

const KEY = 'fctactics_destinations';

function load(): Destinations {
  if (typeof localStorage === 'undefined') return structuredClone(DEFAULTS);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const p = JSON.parse(raw);
    return {
      github: { ...DEFAULTS.github, ...p.github },
      gitlab: { ...DEFAULTS.gitlab, ...p.gitlab }
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const destinations = writable<Destinations>(load());

destinations.subscribe(v => {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
  }
});
