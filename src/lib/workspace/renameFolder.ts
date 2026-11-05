import { cp, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { folderSlug } from './exerciseFile';

const RESERVED_DIR = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Faux si le dossier source est verrouillé : il est alors laissé complet, sans copie. */
async function moveDir(from: string, to: string): Promise<boolean> {
  try {
    await rename(from, to);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') throw err;
  }
  await cp(from, to, { recursive: true });
  try {
    await rm(from, { recursive: true, force: true });
    return true;
  } catch {
    await cp(to, from, { recursive: true, force: false });
    await rm(to, { recursive: true, force: true });
    return false;
  }
}

/** Renomme le dossier parent du content.md d'après le titre. Le dossier actuel reste si la cible est prise ou s'il est verrouillé. */
export async function renameToTitle(dir: string, title: string): Promise<string> {
  const desired = folderSlug(title);
  if (!desired || desired === path.basename(dir) || RESERVED_DIR.test(desired)) return dir;
  const target = path.join(path.dirname(dir), desired);
  try {
    await stat(target);
    return dir;
  } catch { /* le nom est libre */ }
  return (await moveDir(dir, target)) ? target : dir;
}
