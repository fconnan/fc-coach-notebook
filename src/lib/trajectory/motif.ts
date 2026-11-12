import { TrajectoryError, type MotifKind } from './types';

export interface Motif {
  wave: number;
  /** Décalage latéral, en mètres, à l'abscisse curviligne. */
  at(distance: number): number;
}

function wrap(value: number): number {
  return value - Math.floor(value);
}

function smooth(value: number): number {
  const t = Math.max(0, Math.min(value, 1));
  return t * t * (3 - 2 * t);
}

/** Ramène le motif sur l'axe au départ, avant le col droit, et sur le col lui-même. */
function envelope(distance: number, waveEnd: number, taper: number): number {
  if (distance <= 0 || distance >= waveEnd) return 0;
  if (!(taper > 0)) return 1;
  return Math.min(smooth(distance / taper), smooth((waveEnd - distance) / taper));
}

function sine(distance: number, wave: number, phase: number): number {
  return Math.sin((2 * Math.PI * distance) / wave + phase);
}

/** Triangle de période `wave`, entre -1 et 1. */
function zigzag(distance: number, wave: number, phase: number): number {
  const f = wrap(distance / wave + phase);
  return 1 - 4 * Math.abs(f - 0.5);
}

export function motifOf(
  kind: MotifKind,
  length: number,
  amp: number,
  wave: number,
  phase: number,
  side: 1 | -1,
  taper: number,
  neck: number
): Motif | null {
  if (kind === 'none' || !(Math.abs(amp) > 1e-6)) return null;
  if (!(wave > 0)) throw new TrajectoryError('Longueur d\'onde invalide');
  const room = Math.max(0, Math.min(neck, length));
  const waveEnd = length - room;
  const shape = kind === 'zigzag' ? zigzag : sine;
  return {
    wave,
    at: distance => amp * side * envelope(distance, waveEnd, taper) * shape(distance, wave, phase)
  };
}
