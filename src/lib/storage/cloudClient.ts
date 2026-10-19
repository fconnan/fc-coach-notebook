import { writable, get } from 'svelte/store';
import { destinations } from './destinations';

export type CloudProvider = 'google' | 'github' | 'gitlab';

export interface SessionState {
  connected: Record<CloudProvider, boolean>;
  configured: Record<CloudProvider, boolean>;
}

const EMPTY: SessionState = {
  connected: { google: false, github: false, gitlab: false },
  configured: { google: false, github: false, gitlab: false }
};

export const cloudSession = writable<SessionState>(EMPTY);

export async function refreshSession(): Promise<SessionState> {
  try {
    const res = await fetch('/api/session');
    if (res.ok) {
      const data = await res.json();
      const state: SessionState = { connected: data.connected, configured: data.configured };
      cloudSession.set(state);
      return state;
    }
  } catch { /* offline */ }
  cloudSession.set(EMPTY);
  return EMPTY;
}

/** Opens the provider sign-in popup and resolves once connected (or rejects). */
export function connect(provider: CloudProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = 520, h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      `/api/oauth/${provider}/login`,
      'fctactics_oauth',
      `width=${w},height=${h},left=${left},top=${top}`
    );
    if (!popup) {
      reject(new Error('Popup bloquée par le navigateur.'));
      return;
    }

    let settled = false;
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.type !== 'fctactics-oauth') return;
      settled = true;
      cleanup();
      if (d.ok) { refreshSession().then(() => resolve()); }
      else reject(new Error(d.message || 'Connexion échouée.'));
    }
    function cleanup() {
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
    }
    window.addEventListener('message', onMessage);

    // Fallback: detect popup close without message.
    const timer = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        refreshSession().then(s => {
          if (s.connected[provider]) resolve();
          else reject(new Error('Fenêtre fermée avant la fin de la connexion.'));
        });
      }
    }, 600);
  });
}

export async function disconnect(provider: CloudProvider): Promise<void> {
  await fetch(`/api/oauth/${provider}/logout`, { method: 'POST' });
  await refreshSession();
}

// ---- Listing helpers ----

export async function listRepos(): Promise<string[]> {
  const res = await fetch('/api/cloud/github?action=repos');
  if (!res.ok) throw new Error(await errMsg(res));
  return (await res.json()).repos ?? [];
}

export async function listProjects(): Promise<Array<{ id: number; name: string }>> {
  const res = await fetch('/api/cloud/gitlab?action=projects');
  if (!res.ok) throw new Error(await errMsg(res));
  return (await res.json()).projects ?? [];
}

export interface CloudItem { name: string; id?: string; path?: string; }

export async function cloudList(provider: CloudProvider): Promise<CloudItem[]> {
  const res = await fetch(`/api/cloud/${provider}?${listQuery(provider)}`);
  if (!res.ok) throw new Error(await errMsg(res));
  return (await res.json()).items ?? [];
}

export async function cloudLoad(provider: CloudProvider, item: CloudItem): Promise<string> {
  const params = new URLSearchParams({ action: 'load' });
  const d = get(destinations);
  if (provider === 'google') params.set('id', item.id ?? '');
  if (provider === 'github') { params.set('repo', d.github.repo); params.set('branch', d.github.branch); params.set('path', item.path ?? ''); }
  if (provider === 'gitlab') { params.set('projectId', d.gitlab.projectId); params.set('branch', d.gitlab.branch); params.set('path', item.path ?? ''); }
  const res = await fetch(`/api/cloud/${provider}?${params.toString()}`);
  if (!res.ok) throw new Error(await errMsg(res));
  return (await res.json()).content ?? '';
}

export async function cloudSave(provider: CloudProvider, name: string, content: string, fileId?: string): Promise<{ id?: string; path?: string }> {
  const d = get(destinations);
  const body: any = { name, content, fileId };
  if (provider === 'github') { body.repo = d.github.repo; body.branch = d.github.branch; body.path = d.github.path; }
  if (provider === 'gitlab') { body.projectId = d.gitlab.projectId; body.branch = d.gitlab.branch; body.path = d.gitlab.path; }
  const res = await fetch(`/api/cloud/${provider}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await errMsg(res));
  return (await res.json()).ref ?? {};
}

function listQuery(provider: CloudProvider): string {
  const d = get(destinations);
  const p = new URLSearchParams({ action: 'list' });
  if (provider === 'github') { p.set('repo', d.github.repo); p.set('branch', d.github.branch); p.set('path', d.github.path); }
  if (provider === 'gitlab') { p.set('projectId', d.gitlab.projectId); p.set('branch', d.gitlab.branch); p.set('path', d.gitlab.path); }
  return p.toString();
}

async function errMsg(res: Response): Promise<string> {
  try {
    const d = await res.json();
    return d?.message || `${res.status}`;
  } catch {
    return `${res.status}`;
  }
}

/** Whether a save destination is fully specified for a connected provider. */
export function destinationReady(provider: CloudProvider): boolean {
  if (provider === 'google') return true;
  const d = get(destinations);
  if (provider === 'github') return !!d.github.repo;
  return !!d.gitlab.projectId;
}
