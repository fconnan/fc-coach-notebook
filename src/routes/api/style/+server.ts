import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';

const root = path.resolve('data');

/** Feuille nommée par `style` dans data/index.json. Un nom inconnu retombe sur default.css. */
export const GET: RequestHandler = async () => {
  let name = 'default';
  try {
    const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8')) as { style?: unknown };
    if (typeof index.style === 'string' && /^[\w-]+$/.test(index.style)) name = index.style;
  } catch { /* style par défaut */ }
  const asked = path.join(root, 'styles', `${name}.css`);
  const fallback = path.join(root, 'styles', 'default.css');
  let css = '';
  try {
    css = await readFile(asked, 'utf8');
  } catch {
    try { css = await readFile(fallback, 'utf8'); } catch { /* feuille absente */ }
  }
  return new Response(css, {
    headers: {
      'content-type': 'text/css; charset=utf-8',
      'cache-control': 'no-cache'
    }
  });
};
