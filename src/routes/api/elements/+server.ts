import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';

const root = path.resolve('data');

function elementFile(file: string): string | null {
  const parts = file.split('/').filter(Boolean);
  if (parts[0] !== 'elements' || parts.length < 2) return null;
  if (parts.some(part => part === '.' || part === '..')) return null;
  if (!/\.(ya?ml|svg)$/i.test(parts[parts.length - 1] || '')) return null;
  const abs = path.resolve(root, ...parts);
  const home = path.resolve(root, 'elements');
  if (abs !== home && !abs.startsWith(home + path.sep)) return null;
  return abs;
}

export const GET: RequestHandler = async ({ url, fetch }) => {
  const file = elementFile(url.searchParams.get('file') || '');
  if (!file) return json({ error: 'Chemin invalide.' }, { status: 400 });
  let source = '';
  try { source = await readFile(file, 'utf8'); }
  catch { return json({ error: 'Fichier introuvable.' }, { status: 404 }); }
  const library = await fetch('/api/schema?part=library').then(async response => {
    const body = await response.json() as { library?: unknown };
    return body.library || [];
  });
  return json({ source, library });
};

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json() as { file?: string; source?: string };
  const file = elementFile(String(body.file || ''));
  if (!file) return json({ error: 'Chemin invalide.' }, { status: 400 });
  if (typeof body.source !== 'string') return json({ error: 'Contenu manquant.' }, { status: 400 });
  await writeFile(file, body.source, 'utf8');
  return json({ ok: true });
};
