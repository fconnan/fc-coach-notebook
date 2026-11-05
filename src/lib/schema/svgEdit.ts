import { formatPath, parsePath, type PathSeg } from './svgGeometry';

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

function movePathPoint(d: string, knot: number, x: number, y: number): string {
  const segs = parsePath(d).map(seg => ({ ...seg, abs: seg.abs.slice() }));
  const points = pathPoints(segs);
  const point = points[knot];
  if (!point) return d;
  const seg = segs[point.seg];
  if (seg.op === 'H') seg.abs[0] = x;
  else if (seg.op === 'V') seg.abs[0] = y;
  else if (seg.op === 'A') { seg.abs[5] = x; seg.abs[6] = y; }
  else {
    seg.abs[point.part * 2] = x;
    seg.abs[point.part * 2 + 1] = y;
  }
  return formatPath(segs);
}

function readNum(source: string, index: number, name: string, fallback = 0): number {
  const match = /[+-]?(?:\d*\.\d+|\d+)/.exec(attrOf(source, index, name));
  const value = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(value) ? value : fallback;
}

function pointList(text: string): [number, number][] {
  const values = text.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const points: [number, number][] = [];
  for (let i = 0; i + 1 < values.length; i += 2) points.push([values[i], values[i + 1]]);
  return points;
}

/** Sommets éditables de l’élément, dans son repère. */
export function knotsOf(source: string, index: number): EditPoint[] {
  const tag = graphicTags(source)[index];
  if (!tag) return [];
  const name = tag.name.toLowerCase();
  if (name === 'path') return pathPoints(parsePath(attrOf(source, index, 'd')));
  if (name === 'polygon' || name === 'polyline') {
    return pointList(attrOf(source, index, 'points')).map(([x, y], seg) => ({ x, y, role: 'anchor' as const, seg, part: 0 }));
  }
  if (name === 'line') {
    return [
      { x: readNum(source, index, 'x1'), y: readNum(source, index, 'y1'), role: 'anchor', seg: 0, part: 0 },
      { x: readNum(source, index, 'x2'), y: readNum(source, index, 'y2'), role: 'anchor', seg: 1, part: 0 }
    ];
  }
  if (name === 'rect') {
    const x = readNum(source, index, 'x');
    const y = readNum(source, index, 'y');
    const w = readNum(source, index, 'width');
    const h = readNum(source, index, 'height');
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py], seg) => ({ x: px, y: py, role: 'anchor' as const, seg, part: 0 }));
  }
  if (name === 'circle') {
    const cx = readNum(source, index, 'cx');
    const cy = readNum(source, index, 'cy');
    const r = readNum(source, index, 'r');
    return [
      { x: cx, y: cy, role: 'anchor', seg: 0, part: 0 },
      { x: cx + r, y: cy, role: 'control', seg: 1, part: 0 }
    ];
  }
  if (name === 'ellipse') {
    const cx = readNum(source, index, 'cx');
    const cy = readNum(source, index, 'cy');
    return [
      { x: cx, y: cy, role: 'anchor', seg: 0, part: 0 },
      { x: cx + readNum(source, index, 'rx'), y: cy, role: 'control', seg: 1, part: 0 },
      { x: cx, y: cy + readNum(source, index, 'ry'), role: 'control', seg: 2, part: 0 }
    ];
  }
  if (name === 'text') return [{ x: readNum(source, index, 'x'), y: readNum(source, index, 'y'), role: 'anchor', seg: 0, part: 0 }];
  return [];
}

/** Déplace un sommet et réécrit l’attribut concerné. Les autres sommets restent en place. */
export function moveKnot(source: string, index: number, knot: number, x: number, y: number): string {
  const tag = graphicTags(source)[index];
  if (!tag) return source;
  const name = tag.name.toLowerCase();
  if (name === 'path') return setAttr(source, index, 'd', movePathPoint(attrOf(source, index, 'd'), knot, x, y));
  if (name === 'polygon' || name === 'polyline') {
    const points = pointList(attrOf(source, index, 'points'));
    if (!points[knot]) return source;
    points[knot] = [x, y];
    return setAttr(source, index, 'points', points.map(pair => `${num(pair[0])},${num(pair[1])}`).join(' '));
  }
  if (name === 'line') {
    const key = knot === 0 ? ['x1', 'y1'] : ['x2', 'y2'];
    return setAttr(setAttr(source, index, key[0], num(x)), index, key[1], num(y));
  }
  if (name === 'rect') {
    const left = readNum(source, index, 'x');
    const top = readNum(source, index, 'y');
    const right = left + readNum(source, index, 'width');
    const bottom = top + readNum(source, index, 'height');
    const xs = [left, right];
    const ys = [top, bottom];
    if (knot === 0 || knot === 3) xs[0] = x;
    else xs[1] = x;
    if (knot === 0 || knot === 1) ys[0] = y;
    else ys[1] = y;
    const nx = Math.min(...xs);
    const ny = Math.min(...ys);
    return setAttr(setAttr(setAttr(setAttr(source, index, 'x', num(nx)), index, 'y', num(ny)), index, 'width', num(Math.abs(xs[1] - xs[0]))), index, 'height', num(Math.abs(ys[1] - ys[0])));
  }
  if (name === 'circle') {
    const cx = readNum(source, index, 'cx');
    const cy = readNum(source, index, 'cy');
    if (knot === 0) return setAttr(setAttr(source, index, 'cx', num(x)), index, 'cy', num(y));
    return setAttr(source, index, 'r', num(Math.hypot(x - cx, y - cy)));
  }
  if (name === 'ellipse') {
    const cx = readNum(source, index, 'cx');
    const cy = readNum(source, index, 'cy');
    if (knot === 0) return setAttr(setAttr(source, index, 'cx', num(x)), index, 'cy', num(y));
    if (knot === 1) return setAttr(source, index, 'rx', num(Math.abs(x - cx)));
    return setAttr(source, index, 'ry', num(Math.abs(y - cy)));
  }
  if (name === 'text') return setAttr(setAttr(source, index, 'x', num(x)), index, 'y', num(y));
  return source;
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
  if (kind === 'path') return `<path d="M ${num(cx - s)} ${num(cy)} L ${num(cx)} ${num(cy - s)} L ${num(cx + s)} ${num(cy)}" fill="none" stroke="#ffffff" stroke-width="${sw}"/>`;
  if (kind === 'text') return `<text x="${num(cx)}" y="${num(cy)}" font-size="${num(s)}" text-anchor="middle" fill="#ffffff">texte</text>`;
  return `<rect x="${num(cx - s)}" y="${num(cy - s * 0.7)}" width="${num(s * 2)}" height="${num(s * 1.4)}" fill="#f59e0b" stroke="#b45309" stroke-width="${sw}"/>`;
}
