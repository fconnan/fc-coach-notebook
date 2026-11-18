import { json } from '@sveltejs/kit';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readSettings } from '$lib/schema/viewStyles';
import type { RequestHandler } from './$types';

const file = path.resolve('data', '.settings.json');

export const GET: RequestHandler = async () => {
  try {
    const settings = readSettings(JSON.parse(await readFile(file, 'utf8')));
    if (!settings) return json({ error: 'Réglages illisibles.' }, { status: 400 });
    return json({ settings });
  } catch {
    return json({ error: 'Pas de fichier de réglages.' }, { status: 404 });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  const settings = readSettings(await request.json().catch(() => null));
  if (!settings) return json({ error: 'Réglages invalides.' }, { status: 400 });
  await writeFile(file, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return json({ settings });
};

export const DELETE: RequestHandler = async () => {
  await rm(file, { force: true });
  return json({ ok: true });
};
