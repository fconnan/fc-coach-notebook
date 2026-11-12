import { realExtent } from '$lib/schema/size';

/** Centre du monde, en mètres, et pixels par mètre. */
export type Camera = { worldX: number; worldY: number; ppm: number };

/**
 * Passage mètres → unités du SVG.
 * `svg = origin + world * scale`. Un scaleY négatif veut dire que les mètres montent.
 */
export type Frame = { originX: number; originY: number; scaleX: number; scaleY: number };

export type Box = { x: number; y: number; width: number; height: number };

export function parseBox(value: string): { x: number; y: number; w: number; h: number } | null {
  const [x, y, w, h] = value.trim().split(/[\s,]+/).map(Number);
  if (![x, y, w, h].every(Number.isFinite) || !(w > 0) || !(h > 0)) return null;
  return { x, y, w, h };
}

/** Terrain du schéma : les mètres montent, l’origine est le coin bas-gauche du pitch. */
export function schemaFrame(root: SVGSVGElement): Frame | null {
  if (!root.hasAttribute('data-left')) return null;
  const left = Number(root.dataset.left || 0);
  const top = Number(root.dataset.top || 0);
  const length = Number(root.dataset.length || 0);
  return { originX: left, originY: top + length, scaleX: 1, scaleY: -1 };
}

function attrNum(root: SVGSVGElement, name: string): number | undefined {
  const raw = root.getAttribute(name);
  if (raw == null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Fichier SVG : mètres réels (`data-real-*`), origine au point utilisateur (0, 0), Y vers le haut. */
export function fileFrame(root: SVGSVGElement): Frame | null {
  const box = parseBox(root.getAttribute('data-frame') || root.getAttribute('viewBox') || '');
  if (!box) return null;
  const realW = attrNum(root, 'data-real-w');
  const realH = attrNum(root, 'data-real-h');
  const extent = realExtent(realW !== undefined || realH !== undefined ? { realW, realH } : undefined, box);
  if (!(extent.ux > 0) || !(extent.uy > 0)) return null;
  return { originX: 0, originY: 0, scaleX: 1 / extent.ux, scaleY: -1 / extent.uy };
}

function plain(value: number): number {
  return value === 0 ? 0 : value;
}

export function svgPoint(frame: Frame, worldX: number, worldY: number): { x: number; y: number } {
  return {
    x: plain(frame.originX + worldX * frame.scaleX),
    y: plain(frame.originY + worldY * frame.scaleY)
  };
}

export function worldPoint(frame: Frame, svgX: number, svgY: number): { x: number; y: number } {
  return {
    x: plain((svgX - frame.originX) / frame.scaleX),
    y: plain((svgY - frame.originY) / frame.scaleY)
  };
}

/** viewBox qui montre `camera` dans un objectif de la taille donnée. */
export function viewOf(frame: Frame, camera: Camera, lensW: number, lensH: number): Box {
  const metersW = lensW / camera.ppm;
  const metersH = lensH / camera.ppm;
  const center = svgPoint(frame, camera.worldX, camera.worldY);
  const width = metersW * Math.abs(frame.scaleX);
  const height = metersH * Math.abs(frame.scaleY);
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

export function fitCamera(frame: Frame, box: Box, lensW: number, lensH: number): Camera {
  const world = worldPoint(frame, box.x + box.width / 2, box.y + box.height / 2);
  const metersW = box.width / Math.abs(frame.scaleX);
  const metersH = box.height / Math.abs(frame.scaleY);
  return {
    worldX: world.x,
    worldY: world.y,
    ppm: Math.min(lensW / metersW, lensH / metersH)
  };
}

export function spanCamera(span: number, lensW: number, lensH: number, worldX = 0, worldY = 0): Camera {
  return { worldX, worldY, ppm: Math.min(lensW, lensH) / span };
}

/** Zoom le plus fort qui garde toute l'étendue visible, avec une marge. */
export function fitExtent(
  frame: Frame,
  extent: { minX: number; minY: number; maxX: number; maxY: number },
  lensW: number,
  lensH: number,
  margin = 0.08
): Camera | null {
  if (!(lensW > 0) || !(lensH > 0)) return null;
  if (![extent.minX, extent.minY, extent.maxX, extent.maxY].every(Number.isFinite)) return null;
  const spanX = Math.max(extent.maxX - extent.minX, 0.05);
  const spanY = Math.max(extent.maxY - extent.minY, 0.05);
  const cx = (extent.minX + extent.maxX) / 2;
  const cy = (extent.minY + extent.maxY) / 2;
  const padX = spanX * margin;
  const padY = spanY * margin;
  const minX = cx - spanX / 2 - padX;
  const maxX = cx + spanX / 2 + padX;
  const minY = cy - spanY / 2 - padY;
  const maxY = cy + spanY / 2 + padY;
  const a = svgPoint(frame, minX, maxY);
  const b = svgPoint(frame, maxX, minY);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  if (!(width > 0) || !(height > 0)) return null;
  return fitCamera(frame, { x, y, width, height }, lensW, lensH);
}

type Extent = { minX: number; minY: number; maxX: number; maxY: number };

/** Rectangle plein, ou disque (un cercle, ou l'ellipse inscrite dans un tracé). */
export type Solid =
  | { kind: 'box'; minX: number; minY: number; maxX: number; maxY: number }
  | { kind: 'disk'; cx: number; cy: number; rx: number; ry: number };

function seenView(camera: Camera, lensW: number, lensH: number, pad: number): Extent | null {
  if (!(camera.ppm > 0) || !(lensW > 0) || !(lensH > 0)) return null;
  const width = lensW / camera.ppm;
  const height = lensH / camera.ppm;
  const margin = Math.min(Math.max(pad, 0), width * 0.25, height * 0.25);
  return {
    minX: camera.worldX - width / 2 + margin,
    maxX: camera.worldX + width / 2 - margin,
    minY: camera.worldY - height / 2 + margin,
    maxY: camera.worldY + height / 2 - margin
  };
}

function hits(view: Extent, solid: Solid): boolean {
  if (solid.kind === 'box') {
    return view.minX <= solid.maxX && view.maxX >= solid.minX && view.minY <= solid.maxY && view.maxY >= solid.minY;
  }
  const x = Math.max(view.minX, Math.min(solid.cx, view.maxX));
  const y = Math.max(view.minY, Math.min(solid.cy, view.maxY));
  if (!(solid.rx > 0) || !(solid.ry > 0)) return x === solid.cx && y === solid.cy;
  const dx = (x - solid.cx) / solid.rx;
  const dy = (y - solid.cy) / solid.ry;
  return dx * dx + dy * dy <= 1;
}

export function showsSolid(camera: Camera, lensW: number, lensH: number, solids: Solid[], pad: number): boolean {
  const view = seenView(camera, lensW, lensH, pad);
  if (!view) return false;
  return solids.some(solid => hits(view, solid));
}

/** Avance de `from` vers `toward` et s'arrête dès que plus aucun objet ne resterait visible. */
export function limitPan(from: Camera, toward: Camera, lensW: number, lensH: number, solids: Solid[], pad: number): Camera {
  const to = { worldX: toward.worldX, worldY: toward.worldY, ppm: from.ppm };
  if (!solids.length || !showsSolid(to, lensW, lensH, solids, pad)) {
    if (!solids.length || !showsSolid(from, lensW, lensH, solids, pad)) return from;
  } else {
    return to;
  }
  let low = 0;
  let high = 1;
  for (let step = 0; step < 14; step += 1) {
    const t = (low + high) / 2;
    const mid = {
      worldX: from.worldX + (to.worldX - from.worldX) * t,
      worldY: from.worldY + (to.worldY - from.worldY) * t,
      ppm: from.ppm
    };
    if (showsSolid(mid, lensW, lensH, solids, pad)) low = t;
    else high = t;
  }
  return {
    worldX: from.worldX + (to.worldX - from.worldX) * low,
    worldY: from.worldY + (to.worldY - from.worldY) * low,
    ppm: from.ppm
  };
}

export function lensPoint(frame: Frame, box: Box, lensW: number, lensH: number, worldX: number, worldY: number): { x: number; y: number } {
  const spot = svgPoint(frame, worldX, worldY);
  return {
    x: (spot.x - box.x) / box.width * lensW,
    y: (spot.y - box.y) / box.height * lensH
  };
}

export function worldInLens(frame: Frame, box: Box, lensW: number, lensH: number, x: number, y: number): { x: number; y: number } {
  return worldPoint(frame, box.x + (x / lensW) * box.width, box.y + (y / lensH) * box.height);
}

export function rulerStep(pxPerMeter: number): { step: number; minor: number } {
  const raw = 72 / Math.max(pxPerMeter, 0.001);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  return { step, minor: step / 5 };
}

export function formatMeter(value: number): string {
  const n = Math.round(value * 100) / 100;
  if (Object.is(n, -0) || n === 0) return '0';
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return String(n);
}

export function wheelPixels(
  event: { deltaX: number; deltaY: number; deltaMode: number; shiftKey: boolean },
  lensW: number,
  lensH: number
): { x: number; y: number } {
  let x = event.deltaX;
  let y = event.deltaY;
  if (event.deltaMode === 1) {
    x *= 16;
    y *= 16;
  } else if (event.deltaMode === 2) {
    x *= lensW;
    y *= lensH;
  }
  if (event.shiftKey && x === 0) {
    x = y;
    y = 0;
  }
  return { x, y };
}
