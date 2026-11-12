/** none : pas de poignées. ratio : étirable, proportions gardées. free : étirable et déformable. */
export type FitMode = 'none' | 'ratio' | 'free';

export interface FitBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** `ratio` étire, `free` déforme. Tout le reste, y compris l’absence de valeur, vaut none. */
export function fitMode(value: unknown, fallback: FitMode = 'none'): FitMode {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim().toLowerCase();
  if (text === 'free' || text === 'deform' || text === 'déformable' || text === 'true') return 'free';
  if (text === 'ratio' || text === 'resize' || text === 'étirable' || text === 'etirable') return 'ratio';
  if (text === 'none' || text === 'non' || text === 'false') return 'none';
  return fallback;
}

/**
 * Boîte après un drag de poignée qui garde le ratio de départ.
 * Un coin reste ancré au coin opposé. Un côté reste ancré au côté opposé et le centre de l’autre axe ne bouge pas.
 */
export function ratioBox(start: FitBox, edge: string, world: { x: number; y: number }): FitBox {
  const oldW = Math.max(start.maxX - start.minX, 0.08);
  const oldH = Math.max(start.maxY - start.minY, 0.08);
  const ratio = oldW / oldH;
  const min = 0.08;
  const horizontal = edge.includes('e') || edge.includes('w');
  const vertical = edge.includes('n') || edge.includes('s');
  if (horizontal && vertical) {
    const anchorX = edge.includes('w') ? start.maxX : start.minX;
    const anchorY = edge.includes('s') ? start.maxY : start.minY;
    const signX = edge.includes('w') ? -1 : 1;
    const signY = edge.includes('s') ? -1 : 1;
    const rawW = Math.max(min, (world.x - anchorX) * signX);
    const rawH = Math.max(min, (world.y - anchorY) * signY);
    const scale = Math.max(rawW / oldW, rawH / oldH);
    const width = oldW * scale;
    const height = oldH * scale;
    return {
      minX: edge.includes('w') ? anchorX - width : anchorX,
      maxX: edge.includes('w') ? anchorX : anchorX + width,
      minY: edge.includes('s') ? anchorY - height : anchorY,
      maxY: edge.includes('s') ? anchorY : anchorY + height
    };
  }
  if (horizontal) {
    const minX = edge.includes('w') ? Math.min(start.maxX - min, world.x) : start.minX;
    const maxX = edge.includes('e') ? Math.max(start.minX + min, world.x) : start.maxX;
    const height = Math.max(min, (maxX - minX) / ratio);
    const cy = (start.minY + start.maxY) / 2;
    return { minX, maxX, minY: cy - height / 2, maxY: cy + height / 2 };
  }
  const minY = edge.includes('s') ? Math.min(start.maxY - min, world.y) : start.minY;
  const maxY = edge.includes('n') ? Math.max(start.minY + min, world.y) : start.maxY;
  const width = Math.max(min, (maxY - minY) * ratio);
  const cx = (start.minX + start.maxX) / 2;
  return { minX: cx - width / 2, maxX: cx + width / 2, minY, maxY };
}
