import { json, error } from '@sveltejs/kit';
import { isProvider, TOKEN_COOKIE, type ProviderId } from '$lib/server/oauth';
import * as cloud from '$lib/server/cloud';
import type { RequestHandler } from './$types';

function requireToken(cookies: any, provider: ProviderId): string {
  const token = cookies.get(TOKEN_COOKIE(provider));
  if (!token) error(401, 'Non connecté');
  return token;
}

export const GET: RequestHandler = async ({ params, url, cookies }) => {
  const provider = params.provider;
  if (!isProvider(provider)) error(404, 'Fournisseur inconnu');
  const token = requireToken(cookies, provider);
  const action = url.searchParams.get('action') ?? 'list';
  const q = url.searchParams;

  try {
    if (provider === 'google') {
      if (action === 'load') return json({ content: await cloud.driveLoad(token, q.get('id') ?? '') });
      return json({ items: await cloud.driveList(token) });
    }
    if (provider === 'github') {
      if (action === 'repos') return json({ repos: await cloud.githubRepos(token) });
      if (action === 'load') return json({ content: await cloud.githubLoad(token, q.get('repo') ?? '', q.get('path') ?? '', q.get('branch') ?? '') });
      return json({ items: await cloud.githubList(token, q.get('repo') ?? '', q.get('branch') ?? '', q.get('path') ?? '') });
    }
    // gitlab
    if (action === 'projects') return json({ projects: await cloud.gitlabProjects(token) });
    if (action === 'load') return json({ content: await cloud.gitlabLoad(token, q.get('projectId') ?? '', q.get('path') ?? '', q.get('branch') ?? 'main') });
    return json({ items: await cloud.gitlabList(token, q.get('projectId') ?? '', q.get('branch') ?? 'main', q.get('path') ?? '') });
  } catch (e: any) {
    error(502, e?.message ?? 'Erreur cloud');
  }
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const provider = params.provider;
  if (!isProvider(provider)) error(404, 'Fournisseur inconnu');
  const token = requireToken(cookies, provider);
  const body = await request.json();
  const { name, content, fileId, repo, branch, path, projectId } = body ?? {};

  if (!name || typeof content !== 'string') error(400, 'Paramètres manquants');

  try {
    if (provider === 'google') {
      return json({ ref: await cloud.driveSave(token, name, content, fileId || undefined) });
    }
    if (provider === 'github') {
      if (!repo) error(400, 'Dépôt non sélectionné');
      return json({ ref: await cloud.githubSave(token, repo, branch ?? '', path ?? '', name, content) });
    }
    if (!projectId) error(400, 'Projet non sélectionné');
    return json({ ref: await cloud.gitlabSave(token, projectId, branch ?? 'main', path ?? '', name, content) });
  } catch (e: any) {
    error(502, e?.message ?? 'Erreur cloud');
  }
};
