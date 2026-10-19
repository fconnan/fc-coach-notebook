import type { ComponentElement } from '$lib/stores/workspace';

/** Posture id stored in JSON (`element.posture`). */
export type PlayerPostureId =
  | 'standing'
  | 'ready'
  | 'running'
  | 'running_back'
  | 'dribbling'
  | 'kicking'
  | 'jumping'
  | 'side_step'
  | 'defensive'
  | 'gk_ready'
  | 'gk_diving';

export interface PlayerPostureMeta {
  id: PlayerPostureId;
  label: string;
  gkOnly?: boolean;
  outfieldOnly?: boolean;
}

export const PLAYER_POSTURES: PlayerPostureMeta[] = [
  { id: 'standing', label: 'Debout' },
  { id: 'ready', label: 'En attente' },
  { id: 'running', label: 'Course' },
  { id: 'running_back', label: 'Course (dos)' },
  { id: 'dribbling', label: 'Conduite' },
  { id: 'kicking', label: 'Frappe / passe' },
  { id: 'jumping', label: 'Saut' },
  { id: 'side_step', label: 'Pas chassé' },
  { id: 'defensive', label: 'Défensif' },
  { id: 'gk_ready', label: 'GB prêt', gkOnly: true },
  { id: 'gk_diving', label: 'GB plongeon', gkOnly: true }
];

export function defaultPosture(isGK: boolean): PlayerPostureId {
  return isGK ? 'gk_ready' : 'standing';
}

export function resolvePosture(el: Pick<ComponentElement, 'posture' | 'role' | 'label'>): PlayerPostureId {
  if (el.posture) return el.posture;
  return defaultPosture(el.role === 'goalkeeper' || el.label === 'G');
}

export function posturesForPlayer(isGK: boolean): PlayerPostureMeta[] {
  return PLAYER_POSTURES.filter((p) => !p.gkOnly || isGK).filter((p) => !p.outfieldOnly || !isGK);
}

export interface PlayerFigureColors {
  shirt: string;
  short: string;
  skin: string;
  pattern: string;
  stroke: string;
}
