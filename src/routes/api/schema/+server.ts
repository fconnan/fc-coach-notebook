import { json } from '@sveltejs/kit';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import type { RequestHandler } from './$types';
import { SCHEMA_TYPE, type LibraryEntry, type SchemaDoc } from '$lib/schema/types';
import { buildScene, libraryFor, renderSvg } from '$lib/schema/scene';
import { isUuidFolder } from '$lib/workspace/exerciseFile';

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

function drawingFromSvg(file: string, source: string): { type?: string; name: string; svg: string; pitch?: { width: number; length: number; margin: number } } | null {
  const name = path.basename(file, path.extname(file));
  const opened = /<svg\b([^>]*)>/i.exec(source);
  const svg = source
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
  if (!name || !svg) return null;
  const doc: { name: string; svg: string; viewBox?: string; pitch?: { width: number; length: number; margin: number } } = { name, svg };
  const rel = file.replaceAll('\\', '/');
  const box = opened && /viewBox\s*=\s*"([^"]+)"/i.exec(opened[1]);
  if (box) doc.viewBox = box[1];
  if (rel.includes('/pitches/') && box) {
    const [x, y, w, h] = box[1].trim().split(/[\s,]+/).map(Number);
    const margin = Math.max(x < 0 ? -x : 0, y < 0 ? -y : 0);
    if ([x, y, w, h].every(Number.isFinite)) doc.pitch = { width: w - margin * 2, length: h - margin * 2, margin };
  }
  return doc;
}

async function walk(dir: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(next, out);
    else if (entry.isFile() && (/\.ya?ml$/i.test(entry.name) || /\.svg$/i.test(entry.name))) out.push(next);
  }
}

function stemKey(file: string): string {
  return file.replace(/\.(ya?ml|svg)$/i, '').toLowerCase();
}

async function readLibrary(skip = '') {
  const files: string[] = [];
  try { await walk(path.join(root, 'studio', 'library'), files); } catch { /* bibliothèque absente */ }
  const yamlStems = new Set(files.filter(file => /\.ya?ml$/i.test(file)).map(stemKey));
  const library = [];
  for (const file of files) {
    if (file === skip) continue;
    const svg = /\.svg$/i.test(file);
    if (svg && yamlStems.has(stemKey(file))) continue;
    try {
      const source = await readFile(file, 'utf8');
      const doc = svg
        ? drawingFromSvg(file, source)
        : parse(source) as SchemaDoc;
      if (!doc?.name || (doc.type && doc.type !== SCHEMA_TYPE)) continue;
      if (!svg && doc.type !== SCHEMA_TYPE) continue;
      if (!svg) {
        const preview = files.find(item => /\.svg$/i.test(item) && stemKey(item) === stemKey(file));
        if (preview) doc.preview = (await readFile(preview, 'utf8')).replace(/<\?xml[\s\S]*?\?>/g, '').trim();
      }
      const rel = path.relative(root, file).replaceAll('\\', '/');
      library.push({
        name: doc.name,
        file: rel,
        dir: path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel),
        doc
      });
    } catch { /* yaml illisible */ }
  }
  return library;
}

export const GET: RequestHandler = async ({ url }) => {
  const part = url.searchParams.get('part') || 'all';
  if (part === 'library') return json({ library: await readLibrary() });
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

async function writeSchemaSvg(dir: string, source: string): Promise<string> {
  const svgPath = path.join(dir, 'schema.svg');
  try {
    const doc = parse(source) as SchemaDoc;
    if (!doc || typeof doc !== 'object') throw new Error('YAML illisible');
    const rel = path.relative(root, dir).replaceAll('\\', '/');
    const names = libraryFor(rel, await readLibrary(path.join(dir, 'schema.yaml')) as LibraryEntry[], `${rel}/schema.yaml`);
    await writeFile(svgPath, renderSvg(buildScene(doc, names, 0, 0)) + '\n', 'utf8');
    return '';
  } catch (err) {
    await rm(svgPath, { force: true });
    return `SVG non généré : ${err instanceof Error ? err.message : String(err)}`;
  }
}

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json() as { at?: string; id?: string; source?: string; markdown?: string };
  const dir = await resolveDir(String(body.at || ''), String(body.id || ''));
  if (!dir) return json({ error: 'Chemin invalide.' }, { status: 400 });
  if (typeof body.markdown === 'string') await writeFile(path.join(dir, 'content.md'), body.markdown, 'utf8');
  let warning = '';
  if (typeof body.source === 'string') {
    await writeFile(path.join(dir, 'schema.yaml'), body.source, 'utf8');
    warning = await writeSchemaSvg(dir, body.source);
  }
  return json({ ok: true, warning });
};
