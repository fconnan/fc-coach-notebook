import { parseShare } from './size';
import type { SizeSpec, StretchSpec } from './types';

function quoted(source: string, name: string): string {
  const found = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(source);
  return found?.[1] || '';
}

/** Contenu d’un fichier SVG, sans la balise racine. */
export function readSvg(source: string): { markup: string; viewBox: string; stretch?: StretchSpec; size?: SizeSpec } {
  const opened = /<svg\b([^>]*)>/i.exec(source);
  const markup = source
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
  const attrs = opened?.[1] || '';
  const viewBox = quoted(attrs, 'viewBox');
  const x = quoted(attrs, 'data-stretch-x');
  const y = quoted(attrs, 'data-stretch-y');
  const stretch = x || y ? { x: x || undefined, y: y || undefined } : undefined;
  const realW = Number(quoted(attrs, 'data-real-w') || NaN);
  const realH = Number(quoted(attrs, 'data-real-h') || NaN);
  const minText = quoted(attrs, 'data-min-size');
  const min = minText ? parseShare(minText) : undefined;
  const size = Number.isFinite(realW) || Number.isFinite(realH) || min !== undefined
    ? {
      realW: Number.isFinite(realW) ? realW : undefined,
      realH: Number.isFinite(realH) ? realH : undefined,
      min
    }
    : undefined;
  return { markup, viewBox, stretch, size };
}

/** Largeur, longueur et marge déduites d’un viewBox de terrain. */
export function pitchBox(viewBox: string): { width: number; length: number; margin: number } | null {
  const [x, y, w, h] = viewBox.trim().split(/[\s,]+/).map(Number);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  const margin = Math.max(x < 0 ? -x : 0, y < 0 ? -y : 0);
  return { width: w - margin * 2, length: h - margin * 2, margin };
}
