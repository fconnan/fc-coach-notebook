import { applyParams } from './params';

const HEADS = ['filled'];

let serial = 0;

/** Pose le tracé, les couleurs, et des identifiants de marqueur uniques. */
export function paintArrow(markup: string, d: string, values: Record<string, string | undefined>): string {
  const painted = applyParams(markup, values);
  const tracked = painted.replace(/<path\b([^>]*?\bdata-track="1"[^>]*?)\s*\/?>/i, (_full, attrs: string) => {
    const body = /\bd="/.test(attrs) ? attrs.replace(/\bd="[^"]*"/, `d="${d}"`) : `${attrs} d="${d}"`;
    return `<path${body}/>`;
  });
  const id = `arrow${serial++}`;
  let out = tracked;
  for (const name of HEADS) {
    out = out.replaceAll(`id="${name}"`, `id="${id}-${name}"`);
    out = out.replaceAll(`url(#${name})`, `url(#${id}-${name})`);
  }
  return out;
}

/** Boîte des coordonnées d’un tracé, pour cadrer un aperçu. */
export function boundsOf(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const nums = [...d.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map(match => Number(match[0])).filter(Number.isFinite);
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  return { minX, minY, maxX, maxY };
}
