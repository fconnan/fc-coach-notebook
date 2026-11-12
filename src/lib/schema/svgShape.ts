/** Tracés SVG simples. Les noms et les attributs sont ceux de SVG. Pas de defs, pas de marker. */

import { fitMode } from './fit';

const GEOM: Record<string, string[]> = {
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  path: ['d']
};

const PAINT = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-miterlimit',
  'opacity', 'transform'
];

export type InkBox = { minX: number; minY: number; maxX: number; maxY: number };

export function isSvgTag(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(GEOM, type);
}

export function svgTags(): string[] {
  return Object.keys(GEOM);
}

export function svgPaint(): string[] {
  return PAINT;
}

export function svgGeom(tag: string): string[] {
  return GEOM[tag] ? [...GEOM[tag]] : [];
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const n = Math.round(value * 1000) / 1000;
  return String(Object.is(n, -0) ? 0 : n);
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function paintValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return fmt(value);
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > 240) return null;
  if (/[<>"'`]|url\s*\(|marker|script|expression/i.test(text)) return null;
  if (!/^[#%(),.\w\s/+-]+$/.test(text)) return null;
  if (text === 'transform') return null;
  return text;
}

function safeTransform(value: string): boolean {
  const calls = value.trim().match(/(?:translate|scale|rotate|skewX|skewY|matrix)\(\s*[-\d.,\s]+\s*\)/g);
  if (!calls?.length) return false;
  return calls.join('').replace(/\s+/g, '') === value.trim().replace(/\s+/g, '');
}

function pointsOf(value: unknown): [number, number][] | null {
  if (typeof value === 'string') {
    if (/[^0-9eE,.\s+-]/.test(value)) return null;
    const nums = value.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)?.map(Number) || [];
    if (nums.length < 2 || nums.length % 2 !== 0 || nums.some(n => !Number.isFinite(n))) return null;
    const spots: [number, number][] = [];
    for (let i = 0; i < nums.length; i += 2) spots.push([nums[i], nums[i + 1]]);
    return spots;
  }
  if (!Array.isArray(value) || !value.length) return null;
  const spots: [number, number][] = [];
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 2) {
      const x = num(item[0]);
      const y = num(item[1]);
      if (x == null || y == null) return null;
      spots.push([x, y]);
    } else if (item && typeof item === 'object') {
      const spot = item as { x?: unknown; y?: unknown };
      const x = num(spot.x);
      const y = num(spot.y);
      if (x == null || y == null) return null;
      spots.push([x, y]);
    } else {
      return null;
    }
  }
  return spots;
}

function pathSpots(d: string): [number, number][] | null {
  if (!d.trim() || /[^MmLlHhVvCcSsQqTtAaZz0-9eE,.\s+-]/.test(d)) return null;
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  if (!tokens) return null;
  const count: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  const spots: [number, number][] = [];
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const take = (n: number): number[] | null => {
    if (i + n > tokens.length) return null;
    const args: number[] = [];
    for (let k = 0; k < n; k += 1) {
      const value = Number(tokens[i + k]);
      if (!Number.isFinite(value)) return null;
      args.push(value);
    }
    i += n;
    return args;
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i];
      i += 1;
    } else if (!cmd) {
      return null;
    }
    const kind = cmd.toLowerCase();
    const n = count[kind];
    if (n === undefined) return null;
    if (kind === 'z') {
      cx = sx;
      cy = sy;
      spots.push([cx, cy]);
      cmd = '';
      continue;
    }
    const args = take(n);
    if (!args) return null;
    const rel = cmd === kind;
    const startX = cx;
    const startY = cy;
    const abs = (x: number, y: number): [number, number] => rel ? [startX + x, startY + y] : [x, y];
    const land = (x: number, y: number) => {
      const spot = abs(x, y);
      cx = spot[0];
      cy = spot[1];
      spots.push(spot);
    };
    if (kind === 'm' || kind === 'l' || kind === 't') {
      land(args[0], args[1]);
      if (kind === 'm') {
        sx = cx;
        sy = cy;
        cmd = rel ? 'l' : 'L';
      }
    } else if (kind === 'h') {
      cx = rel ? startX + args[0] : args[0];
      spots.push([cx, cy]);
    } else if (kind === 'v') {
      cy = rel ? startY + args[0] : args[0];
      spots.push([cx, cy]);
    } else if (kind === 'c') {
      spots.push(abs(args[0], args[1]), abs(args[2], args[3]));
      land(args[4], args[5]);
    } else if (kind === 's' || kind === 'q') {
      spots.push(abs(args[0], args[1]));
      land(args[2], args[3]);
    } else if (kind === 'a') {
      const rx = Math.abs(args[0]);
      const ry = Math.abs(args[1]);
      land(args[5], args[6]);
      spots.push([cx - rx, cy - ry], [cx + rx, cy + ry]);
    }
  }
  return spots.length ? spots : null;
}

function boxOf(spots: [number, number][], pad = 0): InkBox | null {
  if (!spots.length) return null;
  const xs = spots.map(spot => spot[0]);
  const ys = spots.map(spot => spot[1]);
  return {
    minX: Math.min(...xs) - pad,
    minY: Math.min(...ys) - pad,
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad
  };
}

function localBox(tag: string, attrs: Record<string, string>): InkBox | null {
  const n = (name: string, fallback = 0) => {
    const value = Number(attrs[name]);
    return Number.isFinite(value) ? value : fallback;
  };
  if (tag === 'circle') {
    const r = n('r');
    if (!(r > 0)) return null;
    return boxOf([[n('cx') - r, n('cy') - r], [n('cx') + r, n('cy') + r]]);
  }
  if (tag === 'ellipse') {
    const rx = n('rx');
    const ry = n('ry');
    if (!(rx > 0) || !(ry > 0)) return null;
    return boxOf([[n('cx') - rx, n('cy') - ry], [n('cx') + rx, n('cy') + ry]]);
  }
  if (tag === 'rect') {
    const w = n('width');
    const h = n('height');
    if (!(w > 0) || !(h > 0)) return null;
    return boxOf([[n('x'), n('y')], [n('x') + w, n('y') + h]]);
  }
  if (tag === 'line') return boxOf([[n('x1'), n('y1')], [n('x2'), n('y2')]]);
  if (tag === 'path') return boxOf(pathSpots(attrs.d || '') || []);
  return boxOf(pointsOf(attrs.points || '') || []);
}

/** Élément SVG, coordonnées d’abord locales, puis passées dans le repère du parent. */
export function drawSvg(
  tag: string,
  raw: unknown,
  map: (x: number, y: number) => [number, number],
  pick = ''
): { markup: string; box: InkBox } | null {
  if (!isSvgTag(tag) || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (!GEOM[tag].some(name => source[name] !== undefined)) return null;
  const attrs: Record<string, string> = {};
  for (const name of GEOM[tag]) {
    const value = source[name];
    if (value === undefined) continue;
    if (name === 'points') {
      const spots = pointsOf(value);
      if (!spots) return null;
      attrs.points = spots.map(spot => `${fmt(spot[0])},${fmt(spot[1])}`).join(' ');
    } else if (name === 'd') {
      if (typeof value !== 'string' || !pathSpots(value)) return null;
      attrs.d = value.trim();
    } else {
      const n = num(value);
      if (n == null) return null;
      attrs[name] = fmt(n);
    }
  }
  const local = localBox(tag, attrs);
  if (!local) return null;
  let pad = 0;
  for (const name of PAINT) {
    if (source[name] === undefined) continue;
    if (name === 'transform') {
      if (typeof source[name] !== 'string' || !safeTransform(source[name])) return null;
      attrs.transform = source[name].trim().replace(/\s+/g, ' ');
      continue;
    }
    const text = paintValue(source[name]);
    if (text == null) return null;
    attrs[name] = text;
    if (name === 'stroke-width') pad = Math.max(pad, Number(text) / 2 || 0);
  }
  const mode = tag === 'circle' ? 'ratio' : fitMode(source.fit);
  const fit = mode === 'none' ? '' : ` data-fit="${mode}"`;
  const picked = pick ? ` data-pick="${esc(pick)}" data-kind="svg"${fit}` : '';
  const body = `<${tag}${picked} ${Object.entries(attrs).map(([name, value]) => `${name}="${esc(value)}"`).join(' ')}/>`;
  const origin = map(0, 0);
  const ex = map(1, 0);
  const ey = map(0, 1);
  const identity = origin[0] === 0 && origin[1] === 0 && ex[0] === 1 && ex[1] === 0 && ey[0] === 0 && ey[1] === 1;
  const markup = identity
    ? body
    : `<g transform="matrix(${fmt(ex[0] - origin[0])} ${fmt(ex[1] - origin[1])} ${fmt(ey[0] - origin[0])} ${fmt(ey[1] - origin[1])} ${fmt(origin[0])} ${fmt(origin[1])})">${body}</g>`;
  const corners: [number, number][] = [
    [local.minX, local.minY],
    [local.maxX, local.minY],
    [local.minX, local.maxY],
    [local.maxX, local.maxY]
  ].map(([x, y]) => map(x, y));
  const scale = Math.max(
    Math.hypot(ex[0] - origin[0], ex[1] - origin[1]),
    Math.hypot(ey[0] - origin[0], ey[1] - origin[1])
  );
  const box = boxOf(corners, pad * (scale || 1));
  return box ? { markup, box } : null;
}
