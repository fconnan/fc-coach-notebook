export const SCHEMA_TYPE = 'fccn-schema:0';

export type SchemaUnit = 'meters' | 'relative';

export interface SchemaDoc {
  type?: string;
  name?: string;
  units?: SchemaUnit;
  outline?: boolean;
  pitch?: PitchSpec;
  lines?: Array<number[] | Segment>;
  players?: PlayerSpec[];
  zones?: ZoneSpec[];
  items?: ItemSpec[];
  phases?: PhaseSpec[];
  svg?: string;
  viewBox?: string;
  /** Rendu précalculé, à côté du YAML. Ce n’est pas un second objet de la bibliothèque. */
  preview?: string;
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
  pos?: Spot;
  at?: number[];
  x?: number;
  y?: number;
  team?: string;
}

export interface BoxEdges {
  x?: number;
  y?: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export type BoxInset = number | BoxEdges;

export interface RectSpec {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  unit?: SchemaUnit;
  margin?: BoxInset;
  padding?: BoxInset;
}

export interface ZoneSpec {
  name?: string;
  box?: number[] | Rect;
  rect?: RectSpec;
  unit?: SchemaUnit;
  margin?: BoxInset;
  padding?: BoxInset;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  zones?: ZoneSpec[];
  items?: ItemSpec[];
}

export interface Rect {
  x: number;
  y: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Spot {
  x: number;
  y: number;
}

export interface ItemSpec {
  team?: string;
  shape?: string;
  rect?: RectSpec;
  unit?: SchemaUnit;
  pos?: Spot;
  at?: number[];
  x?: number;
  y?: number;
  object?: string;
  player?: string | number;
  ball?: number[] | Spot | string | number;
  goal?: number[] | boolean;
}

export interface PhaseSpec {
  name?: string;
  duration?: number;
  moves?: MoveSpec[];
}

export interface MoveSpec {
  player?: string | number;
  dribble?: number[] | Spot;
  run?: number[] | Spot;
  from?: string | number;
  pass?: string | number | number[] | Spot;
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
  /** Pitch drawing in SVG coordinates, y downward, origin at the top-left of the playing area. */
  drawing: string;
  zones: PlacedZone[];
  players: PlacedPlayer[];
  marks: PlacedMark[];
  arrows: ArrowMark[];
  ball: { x: number; y: number } | null;
  phases: { name: string; duration: number }[];
  error?: string;
}
