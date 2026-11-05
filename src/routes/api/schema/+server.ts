import { json } from '@sveltejs/kit';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import type { RequestHandler } from './$types';
import { dottedId, elementKind, elementScene, libraryFor } from '$lib/schema/scene';
import { readSvg } from '$lib/schema/svg';
import { parseShare } from '$lib/schema/size';
import { SCHEMA_VERSION, type LibraryEntry, type SchemaDoc, type SizeSpec, type StretchSpec, type SvgAsset, type SvgVariant } from '$lib/schema/types';
import { isUuidFolder, markdownTitle } from '$lib/workspace/exerciseFile';
import { renameToTitle } from '$lib/workspace/renameFolder';

const root = path.resolve('data');

/** Le YAML de l’élément l’emporte sur les attributs du SVG, axe par axe. */
function applyStretch(asset: SvgAsset, doc: SchemaDoc): SvgAsset {
  const spec: StretchSpec = {
    x: doc.stretch?.x || asset.stretch?.x,
    y: doc.stretch?.y || asset.stretch?.y
  };
  if (!spec.x && !spec.y) return applySize({ ...asset, stretch: undefined }, doc);
  return applySize({ ...asset, stretch: spec }, doc);
}

/** Le YAML de l’élément l’emporte sur les attributs du SVG. */
function applySize(asset: SvgAsset, doc: SchemaDoc): SvgAsset {
  const fromDoc = doc.size;
  const realW = fromDoc?.real?.w ?? asset.size?.realW;
  const realH = fromDoc?.real?.h ?? asset.size?.realH;
  const min = fromDoc?.min !== undefined ? parseShare(fromDoc.min) : asset.size?.min;
  if (realW === undefined && realH === undefined && min === undefined) return { ...asset, size: undefined };
  const size: SizeSpec = { realW, realH, min };
  return { ...asset, size };
}

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

async function walk(dir: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(next, out);
    else if (entry.isFile() && /\.(ya?ml|svg)$/i.test(entry.name)) out.push(next);
  }
}

async function variantAssets(file: string, variants: SvgVariant[] | undefined, doc: SchemaDoc): Promise<SvgAsset[]> {
  const assets: SvgAsset[] = [];
  const dir = path.dirname(file);
  const home = path.join(root, 'elements');
  for (const variant of variants || []) {
    if (!variant?.path || typeof variant.path !== 'string') continue;
    const abs = path.resolve(dir, variant.path);
    const rel = path.relative(home, abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
    try {
      const parsed = readSvg(await readFile(abs, 'utf8'));
        if (parsed.markup) assets.push(applyStretch({ style: variant.style || '', markup: parsed.markup, viewBox: parsed.viewBox, stretch: parsed.stretch, size: parsed.size }, doc));
    } catch { /* dessin absent */ }
  }
  return assets;
}

async function readLibrary(skip = ''): Promise<LibraryEntry[]> {
  const files: string[] = [];
  try { await walk(path.join(root, 'elements'), files); } catch { /* éléments absents */ }
  const groups = new Map<string, { yaml?: string; svg?: string }>();
  for (const file of files) {
    if (file === skip) continue;
    const id = dottedId(path.basename(file));
    if (!id) continue;
    const group = groups.get(id) || {};
    if (/\.svg$/i.test(file)) { if (!group.svg) group.svg = file; }
    else if (!group.yaml) group.yaml = file;
    groups.set(id, group);
  }
  const library: LibraryEntry[] = [];
  for (const [id, group] of groups) {
    const kind = elementKind(id);
    const leaf = id.slice(kind.length + 1);
    let doc: SchemaDoc = { version: SCHEMA_VERSION, type: kind, id };
    let held = group.svg || '';
    if (group.yaml) {
      try {
        const parsed = parse(await readFile(group.yaml, 'utf8')) as SchemaDoc;
        if (!parsed || parsed.version !== SCHEMA_VERSION) continue;
        doc = parsed;
      } catch { continue; }
      held = group.yaml;
    } else if (!group.svg) continue;
    doc.type = kind;
    doc.id = id;
    const rel = path.relative(root, held).replaceAll('\\', '/');
    const svgs: SvgAsset[] = [];
    if (group.svg) {
      try {
        const parsed = readSvg(await readFile(group.svg, 'utf8'));
        if (parsed.markup) svgs.push(applyStretch({ style: '', markup: parsed.markup, viewBox: parsed.viewBox, stretch: parsed.stretch, size: parsed.size }, doc));
      } catch { /* dessin absent */ }
    }
    if (group.yaml) {
      for (const asset of await variantAssets(group.yaml, doc.svg, doc)) {
        if (svgs.some(item => item.style === asset.style)) continue;
        svgs.push(asset);
      }
    }
    library.push({
      id,
      name: leaf,
      type: kind,
      file: rel,
      dir: path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel),
      doc,
      svgs
    });
  }
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
