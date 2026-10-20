import { json } from '@sveltejs/kit';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';

const root = path.resolve('data');
const file = path.join(root, 'index.json');

async function readIndex(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return { type: 'fc-tactics-workspace', name: '' };
  }
}

const FORBIDDEN_DIR = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED_DIR = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

function directoryIssue(raw: string, kind: 'répertoire' | 'fichier'): string | null {
  const name = raw.trim();
  if (!name) return kind === 'fichier' ? 'Indique un nom de fichier.' : 'Indique un nom de répertoire.';
  if (name === '.' || name === '..' || FORBIDDEN_DIR.test(name) || /[. ]$/.test(name) || RESERVED_DIR.test(name)) {
    return `Ce nom ne peut pas être un ${kind}. Évite \\ / : * ? " < > | et les espaces ou points en fin de nom.`;
  }
  return null;
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readCategories(): Promise<Array<{ id: string; name: string }>> {
  try {
    const entries = await readdir(path.join(root, 'categories'), { withFileTypes: true });
    const categories = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const info = JSON.parse(await readFile(path.join(root, 'categories', entry.name, 'index.json'), 'utf8')) as { type?: string; name?: string };
        if (info.type && info.type !== 'fc-tactics-category') continue;
        const name = info.name?.trim() ? info.name : entry.name;
        categories.push({ id: entry.name, name });
      } catch { /* sans index.json, ce n'est pas une catégorie */ }
    }
    categories.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return categories;
  } catch {
    return [];
  }
}

async function readStyles(): Promise<Array<Record<string, unknown>>> {
  try {
    const entries = await readdir(path.join(root, 'styles'), { withFileTypes: true });
    const styles = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try {
        const style = JSON.parse(await readFile(path.join(root, 'styles', entry.name), 'utf8')) as { id?: string; name?: string };
        if (!style.id) continue;
        styles.push(style);
      } catch { /* fichier illisible */ }
    }
    styles.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'fr'));
    return styles;
  } catch {
    return [];
  }
}

async function readSeances(id: string): Promise<Array<{ file: string; name: string; sheet: string }>> {
  if (directoryIssue(id, 'répertoire')) return [];
  try {
    const dir = path.join(root, 'categories', id, 'seances');
    const entries = await readdir(dir, { withFileTypes: true });
    const seances = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const data = JSON.parse(await readFile(path.join(dir, entry.name, 'index.json'), 'utf8')) as { type?: string; name?: string; sheet?: string };
        if (data.type !== 'fc-tactics-seance') continue;
        seances.push({ file: entry.name, name: data.name?.trim() || entry.name, sheet: data.sheet || 'S1' });
      } catch { /* sans index.json typé, ce n'est pas une séance */ }
    }
    seances.sort((a, b) => a.sheet.localeCompare(b.sheet, 'fr', { numeric: true }) || a.name.localeCompare(b.name, 'fr'));
    return seances;
  } catch {
    return [];
  }
}

async function readSeance(categoryId: string, seanceId: string) {
  if (directoryIssue(categoryId, 'répertoire') || directoryIssue(seanceId, 'répertoire')) return null;
  const dir = path.join(root, 'categories', categoryId, 'seances', seanceId);
  try {
    const info = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8')) as Record<string, unknown>;
    if (info.type !== 'fc-tactics-seance') return null;
    const exercises = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const page = JSON.parse(await readFile(path.join(dir, entry.name, 'index.json'), 'utf8')) as { type?: string };
        if (page.type !== 'fc-tactics-exercise') continue;
        exercises.push({ ...page, id: entry.name });
      } catch { /* exercice illisible */ }
    }
    exercises.sort((a, b) => String(a.id).localeCompare(String(b.id), 'fr', { numeric: true }));
    return { ...info, id: seanceId, exercises };
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async ({ url }) => {
  const category = url.searchParams.get('category');
  const seance = url.searchParams.get('seance');
  if (category && seance) return json({ seance: await readSeance(category, seance) });
  if (category) return json({ seances: await readSeances(category) });
  const index = await readIndex();
  delete index.folder;
  return json({
    ...index,
    folder: path.basename(root),
    categories: await readCategories(),
    styles: await readStyles()
  });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json() as {
    type?: string;
    id?: string;
    name?: string;
    category?: string;
    sheet?: string;
    date?: string;
    phase?: string;
    principle?: string;
    means?: string;
    update?: boolean;
    style?: Record<string, unknown>;
    exercises?: Array<Record<string, unknown>>;
  };
  if (body.type === 'category') {
    const id = String(body.id || '').trim();
    const issue = directoryIssue(id, 'répertoire');
    if (issue) return json({ error: issue }, { status: 400 });
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'Indique un nom.' }, { status: 400 });
    const dir = path.join(root, 'categories', id);
    if (await exists(dir)) return json({ error: 'Ce répertoire existe déjà.' }, { status: 409 });
    await mkdir(path.join(dir, 'seances'), { recursive: true });
    await writeFile(path.join(dir, 'index.json'), JSON.stringify({ type: 'fc-tactics-category', name }, null, 2) + '\n');
    const template = path.join(root, 'classeur-fff-ligue-bretagne.ods');
    if (await exists(template)) await writeFile(path.join(dir, 'classeur-fff-ligue-bretagne.ods'), await readFile(template));
    return json({ id, name });
  }
  if (body.type === 'seance') {
    const category = String(body.category || '').trim();
    const id = String(body.id || '').trim();
    const categoryIssue = directoryIssue(category, 'répertoire');
    const issue = directoryIssue(id, 'répertoire');
    if (categoryIssue || issue) return json({ error: categoryIssue || issue }, { status: 400 });
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'Indique un nom.' }, { status: 400 });
    const dir = path.join(root, 'categories', category, 'seances', id);
    if (await exists(dir)) return json({ error: 'Ce répertoire existe déjà.' }, { status: 409 });
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.json'), JSON.stringify({
      type: 'fc-tactics-seance',
      name,
      sheet: String(body.sheet || 'S1'),
      date: '',
      phase: '',
      principle: '',
      means: ''
    }, null, 2) + '\n');
    return json({ id, name });
  }
  if (body.type === 'save-seance') {
    const category = String(body.category || '').trim();
    const id = String(body.id || '').trim();
    if (directoryIssue(category, 'répertoire') || directoryIssue(id, 'répertoire')) {
      return json({ error: 'Répertoire invalide.' }, { status: 400 });
    }
    const dir = path.join(root, 'categories', category, 'seances', id);
    await mkdir(dir, { recursive: true });
    const header = body;
    await writeFile(path.join(dir, 'index.json'), JSON.stringify({
      type: 'fc-tactics-seance',
      name: String(header.name || id),
      sheet: String(header.sheet || 'S1'),
      date: String(header.date || ''),
      phase: String(header.phase || ''),
      principle: String(header.principle || ''),
      means: String(header.means || '')
    }, null, 2) + '\n');
    const keep = new Set((header.exercises || []).map(page => String(page.id || '')));
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || keep.has(entry.name)) continue;
      try {
        const page = JSON.parse(await readFile(path.join(dir, entry.name, 'index.json'), 'utf8')) as { type?: string };
        if (page.type === 'fc-tactics-exercise') await rm(path.join(dir, entry.name), { recursive: true, force: true });
      } catch { /* dossier déjà absent */ }
    }
    for (const page of header.exercises || []) {
      const exerciseId = String(page.id || '').trim();
      if (directoryIssue(exerciseId, 'répertoire')) continue;
      const exerciseDir = path.join(dir, exerciseId);
      await mkdir(exerciseDir, { recursive: true });
      const fields = { ...page };
      delete fields.type;
      delete fields.id;
      await writeFile(path.join(exerciseDir, 'index.json'), JSON.stringify({ type: 'fc-tactics-exercise', id: exerciseId, ...fields }, null, 2) + '\n');
    }
    return json({ id });
  }
  if (body.type === 'style') {
    const style = body.style || {};
    const id = String(style.id || '').trim();
    const issue = directoryIssue(id, 'fichier');
    if (issue) return json({ error: issue }, { status: 400 });
    const name = String(style.name || '').trim();
    if (!name) return json({ error: 'Indique un nom.' }, { status: 400 });
    const file = path.join(root, 'styles', `${id}.json`);
    if (!body.update && await exists(file)) return json({ error: 'Ce fichier existe déjà.' }, { status: 409 });
    await mkdir(path.join(root, 'styles'), { recursive: true });
    await writeFile(file, JSON.stringify({ ...style, id, name }, null, 2) + '\n');
    return json({ id, name });
  }
  return json({ error: 'Requête inconnue.' }, { status: 400 });
};

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json() as { name?: string };
  const current = await readIndex();
  const next = {
    type: 'fc-tactics-workspace',
    name: String(body.name ?? current.name ?? '')
  };
  await mkdir(root, { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2) + '\n');
  return json({ ...next, folder: path.basename(root), categories: await readCategories() });
};
