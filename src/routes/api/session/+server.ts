import { json } from '@sveltejs/kit';
import { PROVIDERS, TOKEN_COOKIE, isConfigured } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies }) => {
  const connected: Record<string, boolean> = {};
  const configured: Record<string, boolean> = {};
  for (const p of PROVIDERS) {
    connected[p] = !!cookies.get(TOKEN_COOKIE(p));
    configured[p] = isConfigured(p);
  }
  return json({ connected, configured });
};
