import { env } from '$env/dynamic/private';

export type ProviderId = 'google' | 'github' | 'gitlab';

export const PROVIDERS: ProviderId[] = ['google', 'github', 'gitlab'];

export function isProvider(v: string): v is ProviderId {
  return (PROVIDERS as string[]).includes(v);
}

export function gitlabHost(): string {
  return (env.GITLAB_HOST || 'https://gitlab.com').replace(/\/$/, '');
}

interface ProviderConfig {
  clientId?: string;
  clientSecret?: string;
  scope: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Extra params appended to the authorize URL. */
  authorizeExtra?: Record<string, string>;
}

export function providerConfig(provider: ProviderId): ProviderConfig {
  switch (provider) {
    case 'google':
      return {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: 'https://www.googleapis.com/auth/drive.file openid email',
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        authorizeExtra: { access_type: 'online', prompt: 'select_account', include_granted_scopes: 'true' }
      };
    case 'github':
      return {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        scope: 'repo read:user',
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token'
      };
    case 'gitlab':
      return {
        clientId: env.GITLAB_CLIENT_ID,
        clientSecret: env.GITLAB_CLIENT_SECRET,
        scope: 'api',
        authorizeUrl: `${gitlabHost()}/oauth/authorize`,
        tokenUrl: `${gitlabHost()}/oauth/token`
      };
  }
}

export function redirectUri(origin: string, provider: ProviderId): string {
  const base = (env.OAUTH_REDIRECT_BASE || origin).replace(/\/$/, '');
  return `${base}/api/oauth/${provider}/callback`;
}

export function isConfigured(provider: ProviderId): boolean {
  const c = providerConfig(provider);
  return !!(c.clientId && c.clientSecret);
}

export function buildAuthorizeUrl(provider: ProviderId, origin: string, state: string): string {
  const c = providerConfig(provider);
  const params = new URLSearchParams({
    client_id: c.clientId ?? '',
    redirect_uri: redirectUri(origin, provider),
    response_type: 'code',
    scope: c.scope,
    state,
    ...(c.authorizeExtra ?? {})
  });
  return `${c.authorizeUrl}?${params.toString()}`;
}

/** Exchanges an authorization code for an access token. */
export async function exchangeCode(provider: ProviderId, origin: string, code: string): Promise<string> {
  const c = providerConfig(provider);
  const body = new URLSearchParams({
    client_id: c.clientId ?? '',
    client_secret: c.clientSecret ?? '',
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(origin, provider)
  });
  const res = await fetch(c.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body
  });
  if (!res.ok) throw new Error(`Token exchange failed (${provider}): ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`No access token (${provider}): ${JSON.stringify(data)}`);
  return data.access_token as string;
}

export const TOKEN_COOKIE = (provider: ProviderId) => `cloud_${provider}`;
export const STATE_COOKIE = (provider: ProviderId) => `oauth_state_${provider}`;
