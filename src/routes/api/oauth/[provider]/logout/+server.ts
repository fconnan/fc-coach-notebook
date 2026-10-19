import { json, error } from '@sveltejs/kit';
import { isProvider, TOKEN_COOKIE } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ params, cookies }) => {
  const provider = params.provider;
  if (!isProvider(provider)) error(404, 'Fournisseur inconnu');
  cookies.delete(TOKEN_COOKIE(provider), { path: '/' });
  return json({ ok: true });
};
