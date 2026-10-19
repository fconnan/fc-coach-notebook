import { error } from '@sveltejs/kit';
import { isProvider, exchangeCode, TOKEN_COOKIE, STATE_COOKIE } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

function resultPage(origin: string, ok: boolean, message: string): Response {
  const payload = JSON.stringify({ type: 'fctactics-oauth', ok, message });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Connexion…</title></head>
<body style="font-family:system-ui;background:#eef0f4;color:#1f2329;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
  <p>${ok ? '✅ Connecté. Vous pouvez fermer cette fenêtre.' : '❌ ' + message}</p>
</div>
<script>
  try { if (window.opener) window.opener.postMessage(${payload}, ${JSON.stringify(origin)}); } catch (e) {}
  setTimeout(function(){ window.close(); }, ${ok ? 400 : 4000});
</script>
</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export const GET: RequestHandler = async ({ params, url, cookies }) => {
  const provider = params.provider;
  if (!isProvider(provider)) error(404, 'Fournisseur inconnu');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = cookies.get(STATE_COOKIE(provider));
  cookies.delete(STATE_COOKIE(provider), { path: '/' });

  const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (oauthError) return resultPage(url.origin, false, oauthError);
  if (!code || !state || state !== expected) {
    return resultPage(url.origin, false, 'État OAuth invalide. Réessayez.');
  }

  try {
    const token = await exchangeCode(provider, url.origin, code);
    cookies.set(TOKEN_COOKIE(provider), token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 30
    });
    return resultPage(url.origin, true, 'Connecté');
  } catch (e: any) {
    return resultPage(url.origin, false, e?.message ?? 'Échec de la connexion.');
  }
};
