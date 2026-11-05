import type { SizeRules, SizeSpec } from './types';

/** Part du grand côté : `3.5%`, `0`, ou une fraction déjà comprise entre 0 et 1. */
export function parseShare(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0) return undefined;
    if (value === 0) return 0;
    return value > 1 ? value / 100 : value;
  }
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  if (text.endsWith('%')) return parseShare(Number(text.slice(0, -1)));
  return parseShare(Number(text));
}

/**
 * Minimum lisible déjà multiplié par le facteur du schéma.
 * `scale: 0`, un minimum 0, ou l’absence de règle renvoient undefined : la taille réelle.
 */
export function resolveMin(
  sizes: SizeRules | undefined,
  id: string,
  assetMin: number | undefined,
  callMin: unknown
): number | undefined {
  const scale = sizes?.scale ?? 1;
  if (!(scale > 0)) return undefined;
  let min = assetMin;
  const leaf = id.includes('.') ? id.slice(id.indexOf('.') + 1) : id;
  if (sizes && sizes[id] !== undefined) min = parseShare(sizes[id]);
  else if (sizes && leaf !== id && sizes[leaf] !== undefined) min = parseShare(sizes[leaf]);
  if (callMin !== undefined) min = parseShare(callMin);
  if (!(min !== undefined && min > 0)) return undefined;
  return min * scale;
}

/** Agrandissement uniforme pour atteindre le minimum lisible. 1 garde la taille réelle. */
export function glyphFactor(real: number, min: number | undefined, span: number): number {
  if (!(min !== undefined && min > 0) || !(real > 0) || !(span > 0)) return 1;
  return Math.max(1, (min * span) / real);
}

/** Taille réelle du viewBox, en mètres, et mètres par unité de dessin. */
export function realExtent(
  size: SizeSpec | undefined,
  box: { w: number; h: number } | null
): { w: number; h: number; ux: number; uy: number } {
  if (!box || !(box.w > 0) || !(box.h > 0)) return { w: 1, h: 1, ux: 1, uy: 1 };
  const aspect = box.h / box.w;
  const w = size?.realW ?? (size?.realH !== undefined ? size.realH / aspect : box.w);
  const h = size?.realH ?? (size?.realW !== undefined ? size.realW * aspect : box.h);
  return { w, h, ux: w / box.w, uy: h / box.h };
}
