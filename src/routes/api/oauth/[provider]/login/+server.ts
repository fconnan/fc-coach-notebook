import { redirect, error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { isProvider, isConfigured, buildAuthorizeUrl, STATE_COOKIE } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url, cookies }) => {
  const provider = params.provider;
  if (!isProvider(provider)) error(404, 'Fournisseur inconnu');
  if (!isConfigured(provider)) error(503, `OAuth non configuré pour ${provider} (variables d'environnement manquantes).`);

  const state = randomUUID();
  cookies.set(STATE_COOKIE(provider), state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 600
  });
  redirect(302, buildAuthorizeUrl(provider, url.origin, state));
};
