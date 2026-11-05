/** Géométrie de chemin partagée par l’éditeur SVG et l’étirement. */

function num(value: number): string {
  const n = Math.round(value * 10000) / 10000;
  return String(Object.is(n, -0) ? 0 : n);
}

const PATH_ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

export interface PathSeg {
  rel: boolean;
  op: string;
  abs: number[];
}

function pathTokens(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d))) out.push(match[1] ?? Number(match[2]));
  return out;
}

function toAbsolute(op: string, rel: boolean, values: number[], cx: number, cy: number): number[] {
  if (!rel) return values.slice();
  if (op === 'H') return [cx + values[0]];
  if (op === 'V') return [cy + values[0]];
  if (op === 'A') return [values[0], values[1], values[2], values[3], values[4], cx + values[5], cy + values[6]];
  const abs: number[] = [];
  for (let i = 0; i < values.length; i += 2) abs.push(cx + values[i], cy + values[i + 1]);
  return abs;
}

export function parsePath(d: string): PathSeg[] {
  const segs: PathSeg[] = [];
  let op = '';
  let rel = false;
  let fresh = false;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const tokens = pathTokens(d);
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i];
    if (typeof token === 'string') {
      op = token.toUpperCase();
      rel = token !== 'Z' && token === token.toLowerCase();
      fresh = true;
      i += 1;
      if (op === 'Z') {
        segs.push({ rel, op, abs: [] });
        cx = sx;
        cy = sy;
      }
      continue;
    }
    if (!op || op === 'Z') break;
    const draw = !fresh && op === 'M' ? 'L' : op;
    const count = PATH_ARGS[draw] ?? 0;
    const values = tokens.slice(i, i + count).filter((item): item is number => typeof item === 'number');
    if (values.length < count) break;
    i += count;
    const abs = toAbsolute(draw, rel, values, cx, cy);
    segs.push({ rel, op: draw, abs });
    fresh = false;
    if (draw === 'H') cx = abs[0];
    else if (draw === 'V') cy = abs[0];
    else if (draw === 'A') { cx = abs[5]; cy = abs[6]; }
    else { cx = abs[abs.length - 2]; cy = abs[abs.length - 1]; }
    if (draw === 'M') { sx = cx; sy = cy; }
  }
  return segs;
}

export function formatPath(segs: PathSeg[]): string {
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const parts: string[] = [];
  for (const seg of segs) {
    const letter = seg.rel ? seg.op.toLowerCase() : seg.op;
    if (seg.op === 'Z') {
      parts.push(letter);
      cx = sx;
      cy = sy;
      continue;
    }
    let values: number[] = [];
    if (seg.op === 'H') values = [seg.rel ? seg.abs[0] - cx : seg.abs[0]];
    else if (seg.op === 'V') values = [seg.rel ? seg.abs[0] - cy : seg.abs[0]];
    else if (seg.op === 'A') {
      values = [
        seg.abs[0], seg.abs[1], seg.abs[2], seg.abs[3], seg.abs[4],
        seg.rel ? seg.abs[5] - cx : seg.abs[5],
        seg.rel ? seg.abs[6] - cy : seg.abs[6]
      ];
    } else {
      for (let i = 0; i < seg.abs.length; i += 2) {
        values.push(seg.rel ? seg.abs[i] - cx : seg.abs[i], seg.rel ? seg.abs[i + 1] - cy : seg.abs[i + 1]);
      }
    }
    parts.push(`${letter} ${values.map(num).join(' ')}`);
    if (seg.op === 'H') cx = seg.abs[0];
    else if (seg.op === 'V') cy = seg.abs[0];
    else if (seg.op === 'A') { cx = seg.abs[5]; cy = seg.abs[6]; }
    else { cx = seg.abs[seg.abs.length - 2]; cy = seg.abs[seg.abs.length - 1]; }
    if (seg.op === 'M') { sx = cx; sy = cy; }
  }
  return parts.join(' ');
}

/** Réécrit le chemin en absolu. Les rayons d’arc restent, le point d’arrivée est mappé. */
export function mapPath(d: string, mapX: (value: number) => number, mapY: (value: number) => number): string {
  const segs = parsePath(d).map(seg => ({ ...seg, abs: seg.abs.slice(), rel: false }));
  for (const seg of segs) {
    if (seg.op === 'H') seg.abs[0] = mapX(seg.abs[0]);
    else if (seg.op === 'V') seg.abs[0] = mapY(seg.abs[0]);
    else if (seg.op === 'A') {
      seg.abs[5] = mapX(seg.abs[5]);
      seg.abs[6] = mapY(seg.abs[6]);
    } else if (seg.op !== 'Z') {
      for (let i = 0; i + 1 < seg.abs.length; i += 2) {
        seg.abs[i] = mapX(seg.abs[i]);
        seg.abs[i + 1] = mapY(seg.abs[i + 1]);
      }
    }
  }
  return formatPath(segs);
}
