import { parse, parseDocument } from 'yaml';
import { isBallId, isPlayerId } from './scene';
import { formatSchema } from './format';
import type { LibraryEntry, SchemaDoc } from './types';

export function inFolder(entries: LibraryEntry[], dir: string): LibraryEntry[] {
  const prefix = dir.replace(/\/$/, '');
  return entries
    .filter(entry => entry.dir === prefix || entry.dir.startsWith(`${prefix}/`))
    .filter(entry => /\.(ya?ml|svg)$/i.test(entry.file))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Éléments dont le fichier est directement dans ce dossier. */
export function folderEntries(entries: LibraryEntry[], dir: string): LibraryEntry[] {
  const prefix = dir.replace(/\/$/, '');
  return entries
    .filter(entry => entry.dir === prefix && /\.(ya?ml|svg)$/i.test(entry.file))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Premier segment de chemin sous le dossier. */
export function childFolders(entries: LibraryEntry[], dir: string): string[] {
  const prefix = dir.replace(/\/$/, '');
  const names = new Set<string>();
  for (const entry of entries) {
    if (!entry.dir.startsWith(`${prefix}/`)) continue;
    const rest = entry.dir.slice(prefix.length + 1);
    const next = rest.split('/')[0];
    if (next) names.add(next);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
}

export function pitchOfSource(source: string): string {
  try {
    const doc = parse(source) as SchemaDoc;
    const name = typeof doc?.pitch === 'string' || typeof doc?.pitch === 'number'
      ? String(doc.pitch)
      : doc?.pitch?.name !== undefined ? String(doc.pitch.name) : '';
    if (!name) return '';
    return name.includes('.') ? name : `pitch.${name}`;
  } catch {
    return '';
  }
}

function rewrite(source: string, change: (doc: ReturnType<typeof parseDocument>) => void): string {
  const doc = parseDocument(source);
  if (doc.errors.length) throw new Error('YAML illisible');
  change(doc);
  let next = doc.toString({ collectionStyle: 'any', lineWidth: 0 });
  if (!next.endsWith('\n')) next += '\n';
  return formatSchema(next);
}

function ensureList(doc: ReturnType<typeof parseDocument>, key: string) {
  if (!doc.has(key)) doc.set(key, []);
}

function composition(entry: LibraryEntry): boolean {
  const doc = entry.doc;
  if (entry.type === 'pitch' || isPlayerId(entry.id) || isBallId(entry.id)) return false;
  if (entry.type === 'formation' || entry.type === 'zone' || entry.type === 'shape') return true;
  return Boolean(doc.object?.length || doc.shape?.length || doc.formation?.length || doc.zone?.length || doc.outline);
}

function pitchCenter(source: string, library: LibraryEntry[]): { x: number; y: number } {
  let doc: SchemaDoc = {};
  try { doc = parse(source) as SchemaDoc; } catch { /* centre par défaut */ }
  const raw = typeof doc.pitch === 'string' ? doc.pitch : doc.pitch?.name !== undefined ? String(doc.pitch.name) : '';
  const id = raw.includes('.') || !raw ? raw : `pitch.${raw}`;
  const known = library.find(entry => entry.id === id)?.doc;
  const width = known?.width || (typeof doc.pitch === 'object' ? Number(doc.pitch?.width) || 0 : 0) || 68;
  const length = known?.length || (typeof doc.pitch === 'object' ? Number(doc.pitch?.length) || 0 : 0) || 52.5;
  const count = (doc.object?.length || 0) + (doc.shape?.length || 0) + (doc.formation?.length || 0);
  const shift = ((count % 4) - 1.5) * 3;
  return {
    x: Math.round((width / 2 + shift) * 100) / 100,
    y: Math.round((length / 2) * 100) / 100
  };
}

function nextPlayer(source: string): number {
  let doc: SchemaDoc = {};
  try { doc = parse(source) as SchemaDoc; } catch { /* 1 */ }
  const used = new Set<number>();
  const visit = (items: SchemaDoc['object']) => {
    for (const item of items || []) {
      const player = item.player;
      const name = typeof player === 'object' && player ? player.name : player;
      const number = typeof name === 'number' ? name : Number(name);
      if (Number.isInteger(number)) used.add(number);
    }
  };
  const walk = (node: { object?: SchemaDoc['object']; zone?: SchemaDoc['zone']; formation?: SchemaDoc['formation']; shape?: SchemaDoc['shape'] } | undefined) => {
    if (!node) return;
    visit(node.object);
    for (const list of [node.zone, node.formation, node.shape]) {
      for (const item of list || []) {
        const value = Object.values(item)[0];
        if (value && typeof value === 'object') walk(value);
      }
    }
  };
  walk(doc);
  let number = 1;
  while (used.has(number)) number += 1;
  return number;
}

/** Insère l’élément choisi : terrain à la racine, aire dans son genre, objet au centre. */
export function insertElement(source: string, entry: LibraryEntry, library: LibraryEntry[]): string {
  if (entry.type === 'pitch') {
    return rewrite(source, doc => {
      doc.set('pitch', entry.name);
    });
  }
  const genre = entry.type === 'formation' || entry.type === 'zone' || entry.type === 'shape' ? entry.type : 'object';
  if (composition(entry)) {
    return rewrite(source, doc => {
      ensureList(doc, genre);
      doc.addIn([genre], { [entry.name]: {} });
    });
  }
  const at = pitchCenter(source, library);
  if (isPlayerId(entry.id)) {
    const name = nextPlayer(source);
    return rewrite(source, doc => {
      ensureList(doc, 'object');
      doc.addIn(['object'], { player: { name, team: 'blue', x: at.x, y: at.y } });
    });
  }
  const args: Record<string, unknown> = { x: at.x, y: at.y };
  return rewrite(source, doc => {
    ensureList(doc, 'object');
    doc.addIn(['object'], { [entry.name]: args });
  });
}

export function libraryIcon(entry: LibraryEntry): string {
  return (entry.doc.preview || '').replace(/<\?xml[\s\S]*?\?>/g, '').trim();
}
