export const SCHEMA_TYPE = 'fc-tactics-schema';
export const SCHEMA_VERSION = 0;

export interface SchemaDoc {
  type?: string;
  version?: number;
  name?: string;
  units?: 'meters' | 'relative';
  pitch?: PitchSpec;
  lines?: number[][];
  players?: PlayerSpec[];
  zones?: ZoneSpec[];
  items?: ItemSpec[];
  phases?: PhaseSpec[];
  svg?: string;
}

export interface PitchSpec {
  template?: string;
  width?: number;
  length?: number;
  margin?: number;
  boundary?: string;
}

export interface PlayerSpec {
  number?: string | number;
  at?: number[];
  team?: string;
}

export interface ZoneSpec {
  name?: string;
  box?: number[];
  zones?: ZoneSpec[];
  items?: ItemSpec[];
}

export interface ItemSpec {
  team?: string;
  shape?: string;
  at?: number[];
  object?: string;
  player?: string | number;
  ball?: number[] | string | number;
  goal?: number[] | boolean;
}

export interface PhaseSpec {
  name?: string;
  duration?: number;
  moves?: MoveSpec[];
}

export interface MoveSpec {
  player?: string | number;
  dribble?: number[];
  run?: number[];
  from?: string | number;
  pass?: string | number | number[];
}

export interface LibraryEntry {
  name: string;
  file: string;
  dir: string;
  doc: SchemaDoc;
}

export interface PlacedPlayer {
  id: string;
  team: string;
  x: number;
  y: number;
}

export interface PlacedMark {
  svg: string;
  x: number;
  y: number;
}

export interface PlacedZone {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArrowMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'dribble' | 'run' | 'pass';
}

export interface Scene {
  width: number;
  length: number;
  margin: number;
  lines: number[][];
  zones: PlacedZone[];
  players: PlacedPlayer[];
  marks: PlacedMark[];
  arrows: ArrowMark[];
  ball: { x: number; y: number } | null;
  phases: { name: string; duration: number }[];
  error?: string;
}
