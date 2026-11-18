import type { SchemaDoc, TrajectorySpec } from './types';

export interface TrajectoryDraft {
  ink: string;
  width: number;
  dash: string;
  motif: 'none' | 'sine' | 'zigzag';
  wave: number;
  amp: number;
  phase: number;
  side: 1 | -1;
  taper: number;
}

export const TRAJECTORY_BASE: TrajectoryDraft = {
  ink: '#111827',
  width: 0.1,
  dash: 'none',
  motif: 'none',
  wave: 0.7,
  amp: 0.2,
  phase: 0,
  side: 1,
  taper: 0
};

function asNum(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

/** Valeurs d’aperçu : le fichier d’abord, puis les défauts du moteur. */
export function draftOf(doc: { trajectory?: TrajectorySpec; params?: Record<string, string | number> } | null): TrajectoryDraft {
  const path = doc?.trajectory;
  const params = doc?.params;
  const motif = path?.motif === 'sine' || path?.motif === 'zigzag' ? path.motif : 'none';
  return {
    ink: params?.ink !== undefined ? String(params.ink) : TRAJECTORY_BASE.ink,
    width: asNum(params?.width, TRAJECTORY_BASE.width),
    dash: params?.dash !== undefined ? String(params.dash) : TRAJECTORY_BASE.dash,
    motif,
    wave: path?.wave ?? TRAJECTORY_BASE.wave,
    amp: path?.amp ?? TRAJECTORY_BASE.amp,
    phase: path?.phase ?? 0,
    side: path?.side === -1 ? -1 : 1,
    taper: path?.taper ?? 0
  };
}
