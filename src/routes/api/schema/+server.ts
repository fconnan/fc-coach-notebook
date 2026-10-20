import { json } from '@sveltejs/kit';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import type { RequestHandler } from './$types';
import { SCHEMA_TYPE } from '$lib/schema/types';

const root = path.resolve('data');

function inside(target: string): string | null {
  const abs = path.resolve(root, target);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return abs;
}

async function walk(dir: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(next, out);
    else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) out.push(next);
  }
}

export const GET: RequestHandler = async ({ url }) => {
  const at = url.searchParams.get('at') || '';
  const dir = inside(at);
  if (!dir) return json({ error: 'Chemin invalide.' }, { status: 400 });
  const schemaPath = path.join(dir, 'schema.yaml');
  let source = '';
  try { source = await readFile(schemaPath, 'utf8'); } catch { source = ''; }
  const files: string[] = [];
  try { await walk(root, files); } catch { /* data absente */ }
  const library = [];
  for (const file of files) {
    if (file === schemaPath) continue;
    try {
      const doc = parse(await readFile(file, 'utf8')) as { type?: string; name?: string };
      if (doc?.type !== SCHEMA_TYPE || !doc.name) continue;
      const rel = path.relative(root, file).replaceAll('\\', '/');
      library.push({
        name: doc.name,
        file: rel,
        dir: path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel),
        doc
      });
    } catch { /* yaml illisible */ }
  }
  return json({ source, library });
};

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json() as { at?: string; source?: string };
  const dir = inside(String(body.at || ''));
  if (!dir) return json({ error: 'Chemin invalide.' }, { status: 400 });
  await writeFile(path.join(dir, 'schema.yaml'), String(body.source || ''), 'utf8');
  return json({ ok: true });
};
