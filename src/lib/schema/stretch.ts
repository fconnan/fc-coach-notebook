import { mapPath } from './svgGeometry';
import type { StretchSpec, SvgAsset } from './types';

/** Une bande le long d’un axe, en coordonnées du SVG source. */
export interface Band {
  from: number;
  to: number;
  mode: 'fixed' | 'stretch' | 'repeat';
  /** Pas nominal d’un motif, en unités source. */
  step: number;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PlacedBand extends Band {
  targetFrom: number;
  targetTo: number;
  copies: number;
  /** Pas réel, ajusté pour que les copies tombent juste. */
  adjusted: number;
}

export interface AxisLayout {
  /** La cible est trop petite : l’appelant repasse en échelle uniforme. */
  uniform: boolean;
  map: (value: number) => number;
  repeat: PlacedBand | null;
}

const EPS = 1e-6;

export function viewBoxOf(value: string): ViewBox | null {
  const [x, y, w, h] = value.trim().split(/[\s,]+/).map(Number);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/** `fixed -1.75 repeat(0.5) 1.75 fixed`, borné par le viewBox. */
export function parseStretch(text: string, start: number, end: number): Band[] | null {
  const tokens = text.trim().match(/[a-z]+(?:\([^)]*\))?|-?\d+(?:\.\d+)?/gi);
  if (!tokens?.length || end <= start) return null;
  const bands: Band[] = [];
  let cursor = start;
  let mode: Band['mode'] | null = null;
  let step = 0;
  for (const token of tokens) {
    const kind = /^([a-z]+)(?:\(([^)]*)\))?$/i.exec(token);
    if (kind) {
      const name = kind[1].toLowerCase();
      if (name !== 'fixed' && name !== 'stretch' && name !== 'repeat') return null;
      if (mode) bands.push({ from: cursor, to: end, mode, step });
      mode = name;
      step = name === 'repeat' ? Number(kind[2]) : 0;
      if (name === 'repeat' && !(step > 0)) return null;
      continue;
    }
    const cut = Number(token);
    if (!mode || !Number.isFinite(cut) || cut <= cursor || cut >= end) return null;
    bands.push({ from: cursor, to: cut, mode, step });
    cursor = cut;
    mode = null;
    step = 0;
  }
  if (!mode) return null;
  bands.push({ from: cursor, to: end, mode, step });
  return bands.length ? bands : null;
}

function targetOrigin(start: number, end: number, target: number): number {
  const span = end - start;
  return span ? -((0 - start) / span) * target : start;
}

/** Répartit la longueur cible. Les fixes gardent la leur, le reste va aux bandes souples, au prorata. */
export function layoutAxis(spec: string | undefined, start: number, end: number, target: number): AxisLayout {
  const identity = (value: number) => value;
  const fail = { uniform: true, map: identity, repeat: null };
  const source = end - start;
  if (!(source > 0) || !(target > 0)) return fail;
  const bands = spec ? parseStretch(spec, start, end) : [{ from: start, to: end, mode: 'stretch' as const, step: 0 }];
  if (!bands) return fail;
  const fixed = bands.filter(band => band.mode === 'fixed').reduce((sum, band) => sum + (band.to - band.from), 0);
  const flex = bands.filter(band => band.mode !== 'fixed');
  const flexSource = flex.reduce((sum, band) => sum + (band.to - band.from), 0);
  const minimum = fixed + flex.filter(band => band.mode === 'repeat').reduce((sum, band) => sum + band.step, 0);
  if (target < minimum - EPS) return fail;
  if (!flex.length && Math.abs(target - source) > EPS) return fail;
  const remaining = target - fixed;
  let dst = targetOrigin(start, end, target);
  let repeat: PlacedBand | null = null;
  const placed: PlacedBand[] = bands.map(band => {
    const length = band.to - band.from;
    let targetLen = band.mode === 'fixed' || flexSource === 0 ? length : remaining * (length / flexSource);
    let copies = 1;
    let adjusted = band.step;
    if (band.mode === 'repeat') {
      copies = Math.max(1, Math.round(targetLen / band.step));
      adjusted = targetLen / copies;
    }
    const next: PlacedBand = { ...band, targetFrom: dst, targetTo: dst + targetLen, copies, adjusted };
    dst += targetLen;
    if (band.mode === 'repeat' && !repeat) repeat = next;
    return next;
  });
  const map = (value: number) => {
    const band = placed.find(item => value <= item.to + EPS) || placed[placed.length - 1];
    const span = band.to - band.from;
    const u = span ? (value - band.from) / span : 0;
    return band.targetFrom + u * (band.targetTo - band.targetFrom);
  };
  return { uniform: false, map, repeat };
}

function fmt(value: number): string {
  const n = Math.round(value * 10000) / 10000;
  return String(Object.is(n, -0) ? 0 : n);
}

function attrsOf(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

function attrText(attrs: Record<string, string>): string {
  return Object.entries(attrs).map(([name, value]) => ` ${name}="${value}"`).join('');
}

function read(attrs: Record<string, string>, name: string, fallback = 0): number {
  const value = Number(attrs[name]);
  return Number.isFinite(value) ? value : fallback;
}

function rewriteTag(name: string, attrs: Record<string, string>, mapX: (value: number) => number, mapY: (value: number) => number): Record<string, string> {
  const next = { ...attrs };
  const put = (key: string, value: number) => { next[key] = fmt(value); };
  if (name === 'line') {
    put('x1', mapX(read(attrs, 'x1')));
    put('y1', mapY(read(attrs, 'y1')));
    put('x2', mapX(read(attrs, 'x2')));
    put('y2', mapY(read(attrs, 'y2')));
  } else if (name === 'rect') {
    const x = read(attrs, 'x');
    const y = read(attrs, 'y');
    const right = mapX(x + read(attrs, 'width'));
    const bottom = mapY(y + read(attrs, 'height'));
    const left = mapX(x);
    const top = mapY(y);
    put('x', Math.min(left, right));
    put('y', Math.min(top, bottom));
    put('width', Math.abs(right - left));
    put('height', Math.abs(bottom - top));
  } else if (name === 'circle' || name === 'ellipse') {
    put('cx', mapX(read(attrs, 'cx')));
    put('cy', mapY(read(attrs, 'cy')));
  } else if (name === 'polygon' || name === 'polyline') {
    const values = (attrs.points || '').trim().split(/[\s,]+/).map(Number);
    const points: string[] = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      if (!Number.isFinite(values[i]) || !Number.isFinite(values[i + 1])) continue;
      points.push(`${fmt(mapX(values[i]))},${fmt(mapY(values[i + 1]))}`);
    }
    next.points = points.join(' ');
  } else if (name === 'path' && attrs.d) {
    next.d = mapPath(attrs.d, mapX, mapY);
  } else if (name === 'text' || name === 'tspan') {
    if (attrs.x !== undefined) put('x', mapX(read(attrs, 'x')));
    if (attrs.y !== undefined) put('y', mapY(read(attrs, 'y')));
  }
  return next;
}

const GEOMETRY = /<(line|rect|circle|ellipse|polygon|polyline|path|text|tspan)\b([^>]*?)(\/?)>/gi;

function rewriteMarkup(markup: string, mapX: (value: number) => number, mapY: (value: number) => number): string {
  const parts = markup.split(/(<defs\b[^>]*>[\s\S]*?<\/defs>)/gi);
  return parts.map(part => {
    if (/^<defs\b/i.test(part)) return part;
    return part.replace(GEOMETRY, (_all, name: string, body: string, slash: string) => {
      const next = rewriteTag(name.toLowerCase(), attrsOf(body), mapX, mapY);
      return `<${name}${attrText(next)}${slash ? ' /' : ''}>`;
    });
  }).join('');
}

interface Piece {
  repeat: 'x' | 'y' | null;
  open: string;
  inner: string;
}

/** Sépare les groupes data-repeat du reste. Un motif est dessiné dans la première période. */
function splitRepeats(markup: string): Piece[] {
  const pieces: Piece[] = [];
  const re = /<g\b([^>]*)>|<\/g>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markup))) {
    if (match[0].startsWith('</')) continue;
    const repeat = /\bdata-repeat\s*=\s*"([xy])"/i.exec(match[1]);
    if (!repeat) continue;
    let depth = 1;
    const innerStart = match.index + match[0].length;
    const rest = /<g\b[^>]*>|<\/g>/gi;
    rest.lastIndex = innerStart;
    let close = innerStart;
    let nested: RegExpExecArray | null;
    while ((nested = rest.exec(markup))) {
      if (nested[0].startsWith('</')) depth -= 1;
      else depth += 1;
      if (depth === 0) {
        close = nested.index;
        break;
      }
    }
    if (depth !== 0) break;
    if (match.index > cursor) pieces.push({ repeat: null, open: '', inner: markup.slice(cursor, match.index) });
    pieces.push({ repeat: repeat[1].toLowerCase() as 'x' | 'y', open: match[1], inner: markup.slice(innerStart, close) });
    cursor = rest.lastIndex;
    re.lastIndex = cursor;
  }
  if (cursor < markup.length) pieces.push({ repeat: null, open: '', inner: markup.slice(cursor) });
  return pieces;
}

function copyMap(band: PlacedBand, index: number): (value: number) => number {
  return (value: number) => band.targetFrom + ((value - band.from) / band.step + index) * band.adjusted;
}

function uniformMarkup(markup: string, box: ViewBox, w: number, h: number): { markup: string; viewBox: string } {
  const sx = w / box.w;
  const sy = h / box.h;
  const givenX = Math.abs(w - box.w) > EPS;
  const givenY = Math.abs(h - box.h) > EPS;
  const scale = givenX && givenY ? Math.min(sx, sy) : (givenX ? sx : sy);
  const width = box.w * scale;
  const height = box.h * scale;
  const x = targetOrigin(box.x, box.x + box.w, width);
  const y = targetOrigin(box.y, box.y + box.h, height);
  return {
    markup: `<g transform="scale(${fmt(scale)})">${markup}</g>`,
    viewBox: `${fmt(x)} ${fmt(y)} ${fmt(width)} ${fmt(height)}`
  };
}

/**
 * Redimensionne un dessin sans changer les épaisseurs de trait.
 * Sans règle, ou si la cible est plus petite que les bandes fixes plus un motif, échelle uniforme.
 * Un `transform` autre que l’identité dans le contenu étiré n’est pas suivi.
 */
export function stretchSvg(asset: Pick<SvgAsset, 'markup' | 'viewBox' | 'stretch'>, w: number, h: number): { markup: string; viewBox: string } {
  const box = viewBoxOf(asset.viewBox);
  if (!box) return { markup: asset.markup, viewBox: asset.viewBox };
  const spec = asset.stretch;
  if (!spec?.x && !spec?.y) {
    if (Math.abs(w - box.w) < EPS && Math.abs(h - box.h) < EPS) return { markup: asset.markup, viewBox: asset.viewBox };
    return uniformMarkup(asset.markup, box, w, h);
  }
  const x = layoutAxis(spec?.x, box.x, box.x + box.w, w);
  const y = layoutAxis(spec?.y, box.y, box.y + box.h, h);
  if (x.uniform || y.uniform) return uniformMarkup(asset.markup, box, w, h);
  const out = splitRepeats(asset.markup).map(piece => {
    if (!piece.repeat) return rewriteMarkup(piece.inner, x.map, y.map);
    const band = piece.repeat === 'x' ? x.repeat : y.repeat;
    if (!band) return rewriteMarkup(piece.inner, x.map, y.map);
    const copies: string[] = [];
    for (let index = 0; index < band.copies; index += 1) {
      const along = copyMap(band, index);
      const mapX = piece.repeat === 'x' ? along : x.map;
      const mapY = piece.repeat === 'y' ? along : y.map;
      copies.push(`<g${piece.open}>${rewriteMarkup(piece.inner, mapX, mapY)}</g>`);
    }
    return copies.join('');
  }).join('');
  const x0 = x.map(box.x);
  const y0 = y.map(box.y);
  return { markup: out, viewBox: `${fmt(x0)} ${fmt(y0)} ${fmt(w)} ${fmt(h)}` };
}

export function hasStretch(spec: StretchSpec | undefined): boolean {
  return Boolean(spec?.x || spec?.y);
}

/** Boîte du dessin étiré, en repère scène (y vers le haut) : y est le bord bas. */
export function frameOfSize(box: ViewBox, w: number, h: number): ViewBox {
  const x = targetOrigin(box.x, box.x + box.w, w);
  const y = targetOrigin(box.y, box.y + box.h, h);
  return { x, y: -(y + h), w, h };
}
