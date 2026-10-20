import type {
  ArrowMark,
  ItemSpec,
  LibraryEntry,
  MoveSpec,
  PlacedMark,
  PlacedPlayer,
  PlacedZone,
  Scene,
  SchemaDoc,
  ZoneSpec
} from './types';

function parts(value: string): string[] {
  return value.split('/').filter(Boolean);
}

function score(exerciseDir: string, schemaDir: string): [number, number] | null {
  const ex = parts(exerciseDir);
  const sc = parts(schemaDir);
  const global = sc[0] === 'library';
  let shared = 0;
  while (shared < ex.length && shared < sc.length && ex[shared] === sc[shared]) shared += 1;
  const insideExercise = shared === ex.length;
  const onAncestor = shared === sc.length;
  const localLibrary = shared > 0 && sc[shared] === 'library';
  if (!global && !insideExercise && !onAncestor && !localLibrary) return null;
  return [shared, -(sc.length - shared)];
}

export function libraryFor(exerciseDir: string, entries: LibraryEntry[], exerciseFile = ''): Map<string, SchemaDoc> {
  const best = new Map<string, { entry: LibraryEntry; rank: [number, number] }>();
  for (const entry of entries) {
    if (!entry.name || entry.file === exerciseFile) continue;
    const rank = score(exerciseDir, entry.dir);
    if (!rank) continue;
    const current = best.get(entry.name);
    if (!current || rank[0] > current.rank[0] || (rank[0] === current.rank[0] && rank[1] > current.rank[1])) {
      best.set(entry.name, { entry, rank });
    }
  }
  return new Map([...best.entries()].map(([name, item]) => [name, item.entry.doc]));
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  return [num(value[0]), num(value[1])];
}

function idOf(value: string | number | undefined): string {
  return value === undefined ? '' : String(value);
}

interface Pitch {
  width: number;
  length: number;
  margin: number;
  boundary: string;
  lines: number[][];
}

function pitchOf(doc: SchemaDoc, library: Map<string, SchemaDoc>, depth: number): Pitch {
  const spec = doc.pitch || {};
  let width = num(spec.width, 0);
  let length = num(spec.length, 0);
  let margin = num(spec.margin, 0);
  let boundary = spec.boundary || '';
  let lines = Array.isArray(doc.lines) ? doc.lines : [];
  if (spec.template && depth < 6) {
    const base = library.get(spec.template);
    if (base) {
      const parent = pitchOf(base, library, depth + 1);
      width = width || parent.width;
      length = length || parent.length;
      margin = spec.margin === undefined ? parent.margin : margin;
      boundary = boundary || parent.boundary;
      if (!lines.length) lines = parent.lines;
    }
  }
  if (!width) width = 68;
  if (!length) length = 105;
  return { width, length, margin, boundary, lines };
}

function mapPoint(at: [number, number], box: [number, number, number, number], relative: boolean): [number, number] {
  if (!relative) return [box[0] + at[0], box[1] + at[1]];
  return [box[0] + at[0] * box[2], box[1] + at[1] * box[3]];
}

function placePlayers(
  doc: SchemaDoc,
  team: string,
  box: [number, number, number, number],
  into: PlacedPlayer[]
) {
  const relative = doc.units !== 'meters';
  for (const player of doc.players || []) {
    const at = pair(player.at);
    if (!at) continue;
    const [x, y] = mapPoint(at, box, relative);
    const side = player.team || team;
    into.push({ id: `${side}:${idOf(player.number)}`, team: side, x, y });
  }
}

function placeItems(
  items: ItemSpec[] | undefined,
  library: Map<string, SchemaDoc>,
  box: [number, number, number, number],
  players: PlacedPlayer[],
  marks: PlacedMark[],
  ballHolder: { id: string }
) {
  for (const item of items || []) {
    if (item.shape) {
      const shape = library.get(item.shape);
      if (shape) placePlayers(shape, item.team || 'blue', box, players);
    }
    if (item.player !== undefined) {
      const at = pair(item.at);
      if (at) {
        const side = item.team || 'blue';
        players.push({ id: `${side}:${idOf(item.player)}`, team: side, x: box[0] + at[0], y: box[1] + at[1] });
      }
    }
    if (item.object) {
      const at = pair(item.at);
      const mark = library.get(item.object);
      if (at && mark?.svg) marks.push({ svg: mark.svg, x: box[0] + at[0], y: box[1] + at[1] });
    }
    if (item.ball !== undefined) {
      if (Array.isArray(item.ball)) {
        const at = pair(item.ball);
        if (at) ballHolder.id = `@${box[0] + at[0]},${box[1] + at[1]}`;
      } else {
        ballHolder.id = idOf(item.ball as string | number);
      }
    }
  }
}

function placeZones(
  zones: ZoneSpec[] | undefined,
  library: Map<string, SchemaDoc>,
  origin: [number, number],
  placed: PlacedZone[],
  players: PlacedPlayer[],
  marks: PlacedMark[],
  ballHolder: { id: string }
) {
  for (const zone of zones || []) {
    const box = zone.box;
    if (!box || box.length < 4) continue;
    const world: [number, number, number, number] = [origin[0] + num(box[0]), origin[1] + num(box[1]), num(box[2]), num(box[3])];
    placed.push({ name: zone.name || '', x: world[0], y: world[1], w: world[2], h: world[3] });
    placeItems(zone.items, library, world, players, marks, ballHolder);
    placeZones(zone.zones, library, [world[0], world[1]], placed, players, marks, ballHolder);
  }
}

function matches(player: PlacedPlayer, token: string | number | undefined): boolean {
  const key = idOf(token);
  return player.id === key || player.id.endsWith(`:${key}`);
}

function findPlayer(players: PlacedPlayer[], token: string | number | undefined): PlacedPlayer | undefined {
  return players.find(player => matches(player, token) && player.team === 'blue')
    || players.find(player => matches(player, token));
}

function applyMove(players: PlacedPlayer[], move: MoveSpec) {
  const who = findPlayer(players, move.player);
  const dest = pair(move.dribble) || pair(move.run);
  if (who && dest) {
    who.x = dest[0];
    who.y = dest[1];
  }
}

function arrowsFor(before: PlacedPlayer[], after: PlacedPlayer[], moves: MoveSpec[]): ArrowMark[] {
  const arrows: ArrowMark[] = [];
  for (const move of moves) {
    if (move.dribble || move.run) {
      const from = findPlayer(before, move.player);
      const to = from ? after.find(player => player.id === from.id) : undefined;
      if (from && to) arrows.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, kind: move.dribble ? 'dribble' : 'run' });
    }
    if (move.pass !== undefined && move.from !== undefined) {
      const from = findPlayer(before, move.from);
      const target = Array.isArray(move.pass) ? pair(move.pass) : null;
      const mate = typeof move.pass === 'number' || typeof move.pass === 'string'
        ? findPlayer(after, move.pass)
        : null;
      if (from && mate) arrows.push({ x1: from.x, y1: from.y, x2: mate.x, y2: mate.y, kind: 'pass' });
      else if (from && target) arrows.push({ x1: from.x, y1: from.y, x2: target[0], y2: target[1], kind: 'pass' });
    }
  }
  return arrows;
}

function cornerMarks(pitch: Pitch, library: Map<string, SchemaDoc>): PlacedMark[] {
  if (!pitch.boundary) return [];
  const mark = library.get(pitch.boundary);
  if (!mark?.svg) return [];
  const spots: [number, number][] = [
    [0, 0], [pitch.width, 0], [0, pitch.length], [pitch.width, pitch.length]
  ];
  return spots.map(([x, y]) => ({ svg: mark.svg as string, x, y }));
}

export function buildScene(
  doc: SchemaDoc,
  library: Map<string, SchemaDoc>,
  phaseIndex: number,
  progress: number
): Scene {
  const pitch = pitchOf(doc, library, 0);
  const players: PlacedPlayer[] = [];
  const marks: PlacedMark[] = [...cornerMarks(pitch, library)];
  const zones: PlacedZone[] = [];
  const ballHolder = { id: '' };
  const box: [number, number, number, number] = [0, 0, pitch.width, pitch.length];
  placeItems(doc.items, library, box, players, marks, ballHolder);
  placeZones(doc.zones, library, [0, 0], zones, players, marks, ballHolder);
  const phases = (doc.phases || []).map(phase => ({
    name: phase.name || 'Phase',
    duration: num(phase.duration, 4)
  }));
  const index = phases.length ? Math.max(0, Math.min(phaseIndex, phases.length - 1)) : -1;
  for (let i = 0; i < index; i += 1) {
    for (const move of doc.phases?.[i]?.moves || []) applyMove(players, move);
  }
  let arrows: ArrowMark[] = [];
  const t = Math.max(0, Math.min(progress, 1));
  if (index >= 0) {
    const moves = doc.phases?.[index]?.moves || [];
    const before = players.map(player => ({ ...player }));
    const after = players.map(player => ({ ...player }));
    for (const move of moves) applyMove(after, move);
    for (const player of players) {
      const start = before.find(item => item.id === player.id);
      const end = after.find(item => item.id === player.id);
      if (!start || !end) continue;
      player.x = start.x + (end.x - start.x) * t;
      player.y = start.y + (end.y - start.y) * t;
    }
    arrows = arrowsFor(before, after, moves);
  }
  let ball: { x: number; y: number } | null = null;
  if (ballHolder.id.startsWith('@')) {
    const [x, y] = ballHolder.id.slice(1).split(',').map(Number);
    ball = { x, y };
  } else if (ballHolder.id) {
    const carrier = findPlayer(players, ballHolder.id);
    if (carrier) ball = { x: carrier.x, y: carrier.y };
  }
  const lastPass = [...arrows].reverse().find(arrow => arrow.kind === 'pass');
  if (lastPass) {
    ball = {
      x: lastPass.x1 + (lastPass.x2 - lastPass.x1) * t,
      y: lastPass.y1 + (lastPass.y2 - lastPass.y1) * t
    };
  }
  return {
    width: pitch.width,
    length: pitch.length,
    margin: pitch.margin,
    lines: pitch.lines,
    zones,
    players,
    marks,
    arrows,
    ball,
    phases
  };
}

const TEAM_COLOR: Record<string, string> = {
  blue: '#2563eb',
  red: '#dc2626',
  white: '#f8fafc',
  yellow: '#ca8a04'
};

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wavy(x1: number, y1: number, x2: number, y2: number): string {
  const steps = 8;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const amp = Math.sin(t * Math.PI * 4) * 0.6;
    d += ` L ${x1 + dx * t + nx * amp} ${y1 + dy * t + ny * amp}`;
  }
  return d;
}

export function renderSvg(scene: Scene): string {
  const margin = scene.margin || 0;
  const width = scene.width + margin * 2;
  const height = scene.length + margin * 2;
  const players = scene.players.map(player => {
    const fill = TEAM_COLOR[player.team] || '#334155';
    const ink = player.team === 'white' || player.team === 'yellow' ? '#111827' : '#ffffff';
    return `<g transform="translate(${player.x} ${player.y})">
      <circle r="1.15" fill="${fill}" stroke="#ffffff" stroke-width="0.12"/>
      <g transform="scale(1 -1)"><text text-anchor="middle" y="0.38" font-size="1.1" font-family="sans-serif" fill="${ink}">${esc(player.id.split(':').pop() || '')}</text></g>
    </g>`;
  }).join('');
  const zones = scene.zones.map(zone =>
    `<rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" fill="rgba(255,255,255,0.06)" stroke="#ffffff" stroke-width="0.12" stroke-dasharray="0.8 0.5"/>`
  ).join('');
  const lines = scene.lines.filter(line => line.length >= 4).map(line =>
    `<line x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}" stroke="#ffffff" stroke-width="0.18" fill="none"/>`
  ).join('');
  const marks = scene.marks.map(mark =>
    `<g transform="translate(${mark.x} ${mark.y})">${mark.svg}</g>`
  ).join('');
  const arrows = scene.arrows.map(arrow => {
    if (arrow.kind === 'dribble') {
      return `<path d="${wavy(arrow.x1, arrow.y1, arrow.x2, arrow.y2)}" fill="none" stroke="#111827" stroke-width="0.22"/>`;
    }
    const dash = arrow.kind === 'run' ? ' stroke-dasharray="0.7 0.45"' : '';
    return `<line x1="${arrow.x1}" y1="${arrow.y1}" x2="${arrow.x2}" y2="${arrow.y2}" stroke="#111827" stroke-width="0.22"${dash} marker-end="url(#arrow)"/>`;
  }).join('');
  const ball = scene.ball
    ? `<circle cx="${scene.ball.x}" cy="${scene.ball.y}" r="0.45" fill="#ffffff" stroke="#111827" stroke-width="0.08"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M 0 0 L 6 3 L 0 6 z" fill="#111827"/>
    </marker>
  </defs>
  <rect width="${width}" height="${height}" fill="#166534"/>
  <g transform="translate(${margin} ${margin + scene.length}) scale(1 -1)">
    <rect x="0" y="0" width="${scene.width}" height="${scene.length}" fill="#2b6b39"/>
    ${lines}
    ${zones}
    ${marks}
    ${arrows}
    ${players}
    ${ball}
  </g>
</svg>`;
}
