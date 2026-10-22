import { json } from '@sveltejs/kit';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';

const root = path.resolve('data');
const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif'
};
const LIMIT = 2 * 1024 * 1024;

async function findPortrait(): Promise<{ file: string; type: string } | null> {
  for (const [ext, type] of Object.entries(TYPES)) {
    const file = path.join(root, `portrait.${ext}`);
    try {
      await readFile(file);
      return { file, type };
    } catch { /* autre extension */ }
  }
  return null;
}

export const GET: RequestHandler = async () => {
  const found = await findPortrait();
  if (!found) return new Response(null, { status: 404 });
  const bytes = await readFile(found.file);
  return new Response(bytes, { headers: { 'content-type': found.type, 'cache-control': 'no-store' } });
};

export const PUT: RequestHandler = async ({ request }) => {
  const type = request.headers.get('content-type') || '';
  const ext = type.includes('png') ? 'png'
    : type.includes('webp') ? 'webp'
    : type.includes('gif') ? 'gif'
    : type.includes('jpeg') || type.includes('jpg') ? 'jpg'
    : '';
  if (!ext) return json({ error: 'Choisis une image.' }, { status: 400 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length) return json({ error: 'Image vide.' }, { status: 400 });
  if (bytes.length > LIMIT) return json({ error: 'Image trop lourde.' }, { status: 400 });
  for (const old of Object.keys(TYPES)) {
    if (old !== ext) await rm(path.join(root, `portrait.${old}`), { force: true });
  }
  await writeFile(path.join(root, `portrait.${ext}`), bytes);
  return json({ ok: true });
};
