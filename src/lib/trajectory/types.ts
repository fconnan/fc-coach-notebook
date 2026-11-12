export interface Point {
  x: number;
  y: number;
}

export type MotifKind = 'none' | 'sine' | 'zigzag';

/** Trajectoire dans le repère du terrain. Les mètres du motif sont ceux du terrain, pas une part de la longueur. */
export interface TrajectoryDef {
  start: Point;
  end: Point;
  /** Points de passage, dans le repère du terrain. Sans point, le tracé est la droite du départ à l'arrivée. */
  via?: Point[];
  motif?: MotifKind;
  /** Longueur d'onde, en mètres. Constante : la dernière période peut être incomplète. */
  wave?: number;
  /** Amplitude latérale, en mètres. */
  amp?: number;
  phase?: number;
  side?: 1 | -1;
  /** Longueur d'adoucissement aux extrémités du motif, en mètres. */
  taper?: number;
  /** Mètres finaux sans motif : le trait arrive droit sur la pointe. */
  neck?: number;
  /** Raccourcit le tracé dessiné, sans déplacer la cible de pointAt. */
  trim?: number;
}

export interface GeneratedPath {
  d: string;
  /** Ligne médiane, sans motif. */
  line: string;
  /** Longueur de la ligne médiane, en mètres. */
  length: number;
  start: Point;
  end: Point;
  startTangent: Point;
  endTangent: Point;
  /** Point de la ligne médiane, fraction de 0 à 1. 1 est la cible. */
  pointAt(fraction: number): Point;
}

export class TrajectoryError extends Error {}
