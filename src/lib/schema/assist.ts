import { parse, parseDocument } from 'yaml';
import { formatSchema } from './format';
import type { LibraryEntry, SchemaDoc } from './types';

export function ofKind(entries: LibraryEntry[], kind: string): LibraryEntry[] {
  return entries
    .filter(entry => entry.dir.split('/').includes(kind))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function templateOf(source: string): string {
  try {
    const doc = parse(source) as SchemaDoc;
    return doc?.pitch?.template || '';
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

export function choosePitch(source: string, template: string): string {
  return rewrite(source, doc => {
    doc.setIn(['pitch', 'template'], template);
  });
}

function pitchCenter(source: string, library: LibraryEntry[]): { x: number; y: number } {
  let doc: SchemaDoc = {};
  try { doc = parse(source) as SchemaDoc; } catch { /* centre par défaut */ }
  const template = doc.pitch?.template || '';
  const known = library.find(entry => entry.name === template)?.doc.pitch;
  const width = known?.width || doc.pitch?.width || 68;
  const length = known?.length || doc.pitch?.length || 52.5;
  const count = doc.items?.length || 0;
  const shift = ((count % 4) - 1.5) * 3;
  return {
    x: Math.round((width / 2 + shift) * 100) / 100,
    y: Math.round((length / 2) * 100) / 100
  };
}

export function addObject(source: string, name: string, library: LibraryEntry[]): string {
  const at = pitchCenter(source, library);
  return rewrite(source, doc => {
    ensureList(doc, 'items');
    doc.addIn(['items'], { object: name, x: at.x, y: at.y });
  });
}

export function addShape(source: string, name: string): string {
  return rewrite(source, doc => {
    ensureList(doc, 'items');
    doc.addIn(['items'], { shape: name, team: 'blue' });
  });
}

function storedPreview(doc: SchemaDoc): string {
  return (doc.preview || '').replace(/<\?xml[\s\S]*?\?>/g, '').trim();
}

export function libraryIcon(entry: LibraryEntry, kind: string): string {
  const preview = storedPreview(entry.doc);
  if (preview && (kind === 'shapes' || kind === 'pitches')) return preview;
  if (kind === 'shapes') return shapeIcon(entry.doc);
  if (kind === 'pitches') return pitchIcon(entry.doc);
  if (entry.doc.svg) return objectIcon(entry.doc);
  return animationIcon();
}

function shapeIcon(doc: SchemaDoc): string {
  const dots = (doc.players || []).flatMap(player => {
    const at = Array.isArray(player.at) ? player.at : null;
    const x = at ? at[0] : player.x;
    const y = at ? at[1] : player.y;
    if (typeof x !== 'number' || typeof y !== 'number') return [];
    return [`<circle cx="${x}" cy="${y}" r="0.035" fill="#93c5fd"/>`];
  }).join('');
  return `<svg viewBox="-0.04 -0.04 1.08 1.08" xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" fill="#166534"/>${dots}</svg>`;
}

function pitchIcon(doc: SchemaDoc): string {
  const width = doc.pitch?.width || 68;
  const length = doc.pitch?.length || 105;
  const margin = doc.pitch?.margin || 0;
  const viewBox = doc.viewBox || `${-margin} ${-margin} ${width + margin * 2} ${length + margin * 2}`;
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg"><rect x="${-margin}" y="${-margin}" width="${width + margin * 2}" height="${length + margin * 2}" fill="#166534"/>${doc.svg || ''}</svg>`;
}

function objectIcon(doc: SchemaDoc): string {
  const viewBox = doc.viewBox || '-1 -1 2 2';
  const [x, y, w, h] = viewBox.trim().split(/[\s,]+/).map(Number);
  const bg = [x, y, w, h].every(Number.isFinite)
    ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#166534"/>`
    : '';
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${bg}${doc.svg || ''}</svg>`;
}

function animationIcon(): string {
  return `<svg viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="16" fill="#166534"/><path d="M5 12 L12 4 L19 12" fill="none" stroke="#fff" stroke-width="1.4"/></svg>`;
}

export function addAnimation(source: string, entry: LibraryEntry): string {
  const phases = entry.doc.phases?.length
    ? entry.doc.phases
    : [{ name: entry.name, duration: 4, moves: [] }];
  return rewrite(source, doc => {
    ensureList(doc, 'phases');
    for (const phase of phases) doc.addIn(['phases'], phase);
  });
}
