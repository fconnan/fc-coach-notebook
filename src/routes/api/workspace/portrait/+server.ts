import { json } from '@sveltejs/kit';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { COACH_IMAGE, PLAYER_IMAGE, PLAYERS_DIR, SEASONS_DIR } from '$lib/workspace/catalog';

const root = path.resolve('data');
const LIMIT = 2 * 1024 * 1024;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function seasonAbs(id: string): string | null {
  const parts = id.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== SEASONS_DIR) return null;
  if (parts.some(part => part === '.' || part === '..')) return null;
  return path.join(root, ...parts);
}

function targetFile(season: string, player: string): string | null {
  if (!player) return path.join(root, COACH_IMAGE);
  const seasonDir = seasonAbs(season);
  if (!seasonDir || !SLUG.test(player)) return null;
  return path.join(seasonDir, PLAYERS_DIR, player, PLAYER_IMAGE);
}

export const GET: RequestHandler = async ({ url }) => {
  const file = targetFile(url.searchParams.get('season') || '', url.searchParams.get('player') || '');
  if (!file) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(file);
    return new Response(bytes, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' } });
  } catch {
    return new Response(null, { status: 404 });
  }
};

export const PUT: RequestHandler = async ({ request, url }) => {
  const player = url.searchParams.get('player') || '';
  const file = targetFile(url.searchParams.get('season') || '', player);
  if (!file) return json({ error: player ? 'Saison invalide.' : 'Image impossible à enregistrer.' }, { status: 400 });
  const type = request.headers.get('content-type') || '';
  if (!type.includes('jpeg') && !type.includes('jpg')) return json({ error: 'Choisis une image.' }, { status: 400 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length) return json({ error: 'Image vide.' }, { status: 400 });
  if (bytes.length > LIMIT) return json({ error: 'Image trop lourde.' }, { status: 400 });
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return json({ ok: true });
};
