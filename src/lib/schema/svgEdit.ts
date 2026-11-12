import { moveShapeKnot, shapeKnots } from '$lib/editor/shapeModel';
import { curvePath } from '$lib/trajectory';
import { parsePath, type PathSeg } from './svgGeometry';

export interface SvgTag {
  name: string;
  start: number;
  openEnd: number;
  end: number;
}

/** Éléments graphiques, dans l’ordre du document, sans la balise svg racine. */
export function graphicTags(source: string): SvgTag[] {
  const tags: SvgTag[] = [];
  const stack: { name: string; tag: SvgTag | null }[] = [];
  const re = /<\/?([A-Za-z][\w:.-]*)\b[^>]*?>/g;
  let seenRoot = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const full = match[0];
    const name = match[1];
    if (full.startsWith('</')) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name !== name) continue;
        const open = stack[i];
        stack.splice(i);
        if (open.tag) open.tag.end = match.index + full.length;
        break;
      }
      continue;
    }
    const start = match.index;
    const openEnd = start + full.length;
    const self = /\/>\s*$/.test(full);
    if (name === 'svg' && !seenRoot) {
      seenRoot = true;
      if (!self) stack.push({ name, tag: null });
      continue;
    }
    const tag: SvgTag = { name, start, openEnd, end: openEnd };
    tags.push(tag);
    if (!self) stack.push({ name, tag });
  }
  return tags;
}

/** Élément le plus intérieur dont la balise contient le curseur. */
export function tagAt(source: string, offset: number): number {
  const tags = graphicTags(source);
  let found = -1;
  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    if (offset >= tag.start && offset <= tag.end) found = i;
  }
  return found;
}

export function attrOf(source: string, index: number, name: string): string {
  const tag = graphicTags(source)[index];
  if (!tag) return '';
  const open = source.slice(tag.start, tag.openEnd);
  const found = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(open);
  return found ? found[1] : '';
}

export function setAttr(source: string, index: number, name: string, value: string): string {
  const tag = graphicTags(source)[index];
  if (!tag) return source;
  const open = source.slice(tag.start, tag.openEnd);
  const safe = value.replace(/"/g, '');
  const found = new RegExp(`\\s${name}\\s*=\\s*"[^"]*"`, 'i');
  const next = found.test(open)
    ? open.replace(found, ` ${name}="${safe}"`)
    : open.replace(/\/?>\s*$/, match => ` ${name}="${safe}"${match}`);
  return source.slice(0, tag.start) + next + source.slice(tag.openEnd);
}

export function removeTag(source: string, index: number): string {
  const tag = graphicTags(source)[index];
  if (!tag) return source;
  return source.slice(0, tag.start) + source.slice(tag.end);
}

export function setViewBox(source: string, box: string): string {
  const safe = box.replace(/"/g, '');
  if (/viewBox\s*=\s*"[^"]*"/i.test(source)) return source.replace(/viewBox\s*=\s*"[^"]*"/i, `viewBox="${safe}"`);
  return source.replace(/<svg\b/i, `<svg viewBox="${safe}"`);
}

/** Plage de l’attribut viewBox de la balise svg racine. */
export function viewBoxRange(source: string): { start: number; end: number } | null {
  const open = /<svg\b[^>]*>/i.exec(source);
  if (!open) return null;
  const found = /\bviewBox\s*=\s*"[^"]*"/i.exec(open[0]);
  if (!found) return null;
  const start = open.index + found.index;
  return { start, end: start + found[0].length };
}

export function viewBoxOf(source: string): string {
  const found = /viewBox\s*=\s*"([^"]*)"/i.exec(source);
  return found ? found[1] : '-1 -1 2 2';
}

export function insertMarkup(source: string, offset: number, markup: string): string {
  const open = source.search(/<svg\b/i);
  const openEnd = open >= 0 ? source.indexOf('>', open) + 1 : 0;
  const close = source.lastIndexOf('</svg>');
  let at = offset;
  if (close >= 0 && (at < openEnd || at > close)) at = close;
  at = Math.max(0, Math.min(at, source.length));
  const snippet = markup.startsWith('\n') ? markup : `\n  ${markup}`;
  const next = source.slice(0, at) + snippet + source.slice(at);
  return next.endsWith('\n') ? next : `${next}\n`;
}

function num(value: number): string {
  const n = Math.round(value * 1000) / 1000;
  return String(Object.is(n, -0) ? 0 : n);
}

export interface EditPoint {
  x: number;
  y: number;
  role: 'anchor' | 'control';
  /** Commande du chemin, pour relier un contrôle à son sommet. */
  seg: number;
  /** Paire de coordonnées dans cette commande. */
  part: number;
}

function pathPoints(segs: PathSeg[]): EditPoint[] {
  const points: EditPoint[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  segs.forEach((seg, segIndex) => {
    const roleAt = (pair: number, pairs: number): EditPoint['role'] => pair < pairs - 1 ? 'control' : 'anchor';
    if (seg.op === 'H') points.push({ x: seg.abs[0], y: cy, role: 'anchor', seg: segIndex, part: 0 });
    else if (seg.op === 'V') points.push({ x: cx, y: seg.abs[0], role: 'anchor', seg: segIndex, part: 0 });
    else if (seg.op === 'A') points.push({ x: seg.abs[5], y: seg.abs[6], role: 'anchor', seg: segIndex, part: 0 });
    else if (seg.op !== 'Z') {
      const pairs = seg.abs.length / 2;
      for (let pair = 0; pair < pairs; pair += 1) {
        points.push({ x: seg.abs[pair * 2], y: seg.abs[pair * 2 + 1], role: roleAt(pair, pairs), seg: segIndex, part: pair });
      }
    }
    if (seg.op === 'H') cx = seg.abs[0];
    else if (seg.op === 'V') cy = seg.abs[0];
    else if (seg.op === 'Z') { cx = sx; cy = sy; }
    else if (seg.op === 'A') { cx = seg.abs[5]; cy = seg.abs[6]; }
    else { cx = seg.abs[seg.abs.length - 2]; cy = seg.abs[seg.abs.length - 1]; }
    if (seg.op === 'M') { sx = cx; sy = cy; }
  });
  return points;
}

/** Attributs de la balise ouverte, sans le balisage. */
export function tagAttrs(source: string, index: number): Record<string, string> {
  const tag = graphicTags(source)[index];
  if (!tag) return {};
  const open = source.slice(tag.start, tag.openEnd);
  const attrs: Record<string, string> = {};
  for (const match of open.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

/** Sommets éditables de l’élément, dans son repère. */
export function knotsOf(source: string, index: number): EditPoint[] {
  const tag = graphicTags(source)[index];
  if (!tag) return [];
  return shapeKnots(tag.name, tagAttrs(source, index));
}

/** Déplace un sommet et réécrit l’attribut concerné. Les autres sommets restent en place. */
export function moveKnot(source: string, index: number, knot: number, x: number, y: number): string {
  const tag = graphicTags(source)[index];
  if (!tag) return source;
  const before = tagAttrs(source, index);
  const after = moveShapeKnot(tag.name, before, knot, x, y);
  let next = source;
  for (const [key, value] of Object.entries(after)) {
    if ((before[key] ?? '') !== value) next = setAttr(next, index, key, value);
  }
  return next;
}

/** Sommets du tracé, sans les poignées de tangente. */
export function trackAnchors(d: string): { x: number; y: number }[] {
  return pathPoints(parsePath(d)).filter(point => point.role === 'anchor').map(point => ({ x: point.x, y: point.y }));
}

function writeAnchors(source: string, index: number, points: { x: number; y: number }[]): string {
  if (points.length < 2) return source;
  return setAttr(source, index, 'd', curvePath(points));
}

/** Insère un sommet. `at` est sa place dans la suite, entre les extrémités. */
export function insertTrackPoint(source: string, index: number, at: number, x: number, y: number): string {
  const points = trackAnchors(attrOf(source, index, 'd'));
  if (points.length < 2) return source;
  const spot = Math.max(1, Math.min(at, points.length - 1));
  points.splice(spot, 0, { x, y });
  return writeAnchors(source, index, points);
}

/** Retire un sommet de passage. Les deux extrémités restent. */
export function removeTrackPoint(source: string, index: number, anchor: number): string {
  const points = trackAnchors(attrOf(source, index, 'd'));
  if (anchor <= 0 || anchor >= points.length - 1) return source;
  points.splice(anchor, 1);
  return writeAnchors(source, index, points);
}

/** Déplace un sommet et reconstruit la courbe qui passe par tous. */
export function moveTrackPoint(source: string, index: number, anchor: number, x: number, y: number): string {
  const points = trackAnchors(attrOf(source, index, 'd'));
  if (!points[anchor]) return source;
  points[anchor] = { x, y };
  return writeAnchors(source, index, points);
}

export function shapeMarkup(kind: string, viewBox: string): string {
  const [x, y, w, h] = viewBox.trim().split(/[\s,]+/).map(Number);
  const cx = Number.isFinite(x) && Number.isFinite(w) ? x + w / 2 : 0;
  const cy = Number.isFinite(y) && Number.isFinite(h) ? y + h / 2 : 0;
  const s = Number.isFinite(w) && w > 0 ? w / 8 : 0.4;
  const sw = num(Math.max(s / 12, 0.02));
  if (kind === 'circle') return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(s)}" fill="#f59e0b" stroke="#b45309" stroke-width="${sw}"/>`;
  if (kind === 'ellipse') return `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(s)}" ry="${num(s * 0.65)}" fill="#f59e0b" stroke="#b45309" stroke-width="${sw}"/>`;
  if (kind === 'line') return `<line x1="${num(cx - s)}" y1="${num(cy)}" x2="${num(cx + s)}" y2="${num(cy)}" fill="none" stroke="#ffffff" stroke-width="${sw}"/>`;
  if (kind === 'polygon') {
    const points = [[cx, cy - s], [cx + s, cy + s * 0.7], [cx - s, cy + s * 0.7]].map(pair => pair.map(num).join(',')).join(' ');
    return `<polygon points="${points}" fill="#f59e0b" stroke="#b45309" stroke-width="${sw}"/>`;
  }
  if (kind === 'path') {
    const d = curvePath([
      { x: cx - s, y: cy },
      { x: cx, y: cy - s * 0.75 },
      { x: cx + s, y: cy }
    ]);
    return `<path data-curve="smooth" d="${d}" fill="none" stroke="#ffffff" stroke-width="${sw}"/>`;
  }
  if (kind === 'text') return `<text x="${num(cx)}" y="${num(cy)}" font-size="${num(s)}" text-anchor="middle" fill="#ffffff">texte</text>`;
  return `<rect x="${num(cx - s)}" y="${num(cy - s * 0.7)}" width="${num(s * 2)}" height="${num(s * 1.4)}" fill="#f59e0b" stroke="#b45309" stroke-width="${sw}"/>`;
}
