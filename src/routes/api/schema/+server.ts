import { json } from '@sveltejs/kit';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { loadLibrary, svgOwnerProps } from '$lib/schema/library';
import { elementScene, libraryFor } from '$lib/schema/scene';
import type { LibraryEntry } from '$lib/schema/types';
import { isUuidFolder, markdownTitle } from '$lib/workspace/exerciseFile';
import { renameToTitle } from '$lib/workspace/renameFolder';

const root = path.resolve('data');

function inside(target: string): string | null {
  const abs = path.resolve(root, target);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return abs;
}

async function isDir(target: string): Promise<boolean> {
  try { return (await stat(target)).isDirectory(); }
  catch { return false; }
}

async function findExerciseDir(id: string): Promise<string | null> {
  if (!id) return null;
  const files: string[] = [];
  async function walk(dir: string) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (entry.name === 'index.json') files.push(next);
    }
  }
  await walk(root);
  const matches: string[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(await readFile(file, 'utf8')) as { type?: string; id?: string };
      if (data.type === 'fccn-exercise:0' && data.id === id) matches.push(path.dirname(file));
    } catch { /* index illisible */ }
  }
  const numbered = matches.find(dir => !isUuidFolder(path.basename(dir)));
  return numbered || matches[0] || null;
}

async function resolveDir(at: string, id: string): Promise<string | null> {
  const direct = inside(at);
  if (direct && await isDir(direct)) return direct;
  return findExerciseDir(id);
}

async function readLibrary(skip = ''): Promise<LibraryEntry[]> {
  const library = await loadLibrary(root, skip);
  const names = libraryFor('', library);
  for (const entry of library) {
    try { entry.doc.preview = elementScene(entry.doc, names); }
    catch { /* aperçu impossible */ }
  }
  return library;
}

export const GET: RequestHandler = async ({ url }) => {
  const part = url.searchParams.get('part') || 'all';
  if (part === 'library') return json({ library: await readLibrary() });
  if (part === 'svg-meta') return json(await svgOwnerProps(root, url.searchParams.get('file') || ''));
  const at = url.searchParams.get('at') || '';
  const dir = await resolveDir(at, url.searchParams.get('id') || '');
  if (!dir) return json({ error: 'Chemin invalide.' }, { status: 400 });
  const schemaPath = path.join(dir, 'schema.yaml');
  let source = '';
  let markdown = '';
  try { source = await readFile(schemaPath, 'utf8'); } catch { source = ''; }
  try { markdown = await readFile(path.join(dir, 'content.md'), 'utf8'); } catch { markdown = ''; }
  if (part === 'source') return json({ source });
  return json({ source, markdown, library: await readLibrary(schemaPath) });
};

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json() as { at?: string; id?: string; source?: string; markdown?: string };
  const dir = await resolveDir(String(body.at || ''), String(body.id || ''));
  if (!dir) return json({ error: 'Chemin invalide.' }, { status: 400 });
  let current = dir;
  if (typeof body.markdown === 'string') await writeFile(path.join(current, 'content.md'), body.markdown, 'utf8');
  if (typeof body.source === 'string') await writeFile(path.join(current, 'schema.yaml'), body.source, 'utf8');
  if (typeof body.markdown === 'string') current = await renameToTitle(current, markdownTitle(body.markdown));
  return json({ ok: true, path: path.relative(root, current).replaceAll('\\', '/') });
};
