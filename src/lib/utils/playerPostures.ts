import type { ComponentElement } from '$lib/stores/workspace';

/** Pose id stored in JSON (`element.posture`). */
export type PlayerAnimId = string;

export interface PlayerAnimEntry {
  id: string;
  label: string;
  gkOnly?: boolean;
}

/** Silhouette ids for 2D SVG figure. */
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

/** @deprecated Legacy silhouette list — UI uses pose catalog instead. */
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

/** 2D / 2.5D pose options (PNG sprites + 2D silhouettes). */
export const POSE_CATALOG: PlayerAnimEntry[] = [
  { id: 'idle', label: 'Debout' },
  { id: 'run', label: 'Course' },
  { id: 'run_back', label: 'Course arrière' },
  { id: 'walk', label: 'Marche / conduite' },
  { id: 'kick', label: 'Frappe / passe' },
  { id: 'jump', label: 'Saut' },
  { id: 'side_step', label: 'Pas chassé' },
  { id: 'header', label: 'Tête' },
  { id: 'gk_ready', label: 'GB prêt', gkOnly: true },
  { id: 'gk_dive', label: 'GB plongeon', gkOnly: true }
];

/** Legacy JSON posture id → current pose id. */
export const LEGACY_POSTURE_TO_ANIM: Record<string, string> = {
  standing: 'idle',
  ready: 'idle',
  running: 'run',
  running_back: 'run_back',
  dribbling: 'walk',
  kicking: 'kick',
  jumping: 'jump',
  side_step: 'side_step',
  defensive: 'idle',
  gk_ready: 'gk_ready',
  gk_diving: 'gk_dive'
};

/** Pose id → nearest 2D silhouette for PlayerFigure. */
export const ANIM_TO_FIGURE_POSTURE: Record<string, PlayerPostureId> = {
  idle: 'standing',
  run: 'running',
  run_back: 'running_back',
  walk: 'dribbling',
  kick: 'kicking',
  jump: 'jumping',
  side_step: 'side_step',
  header: 'jumping',
  gk_ready: 'gk_ready',
  gk_dive: 'gk_diving'
};

function knownPoseIds(): Set<string> {
  return new Set([
    ...POSE_CATALOG.map((a) => a.id),
    ...PLAYER_POSTURES.map((p) => p.id)
  ]);
}

export function isGoalkeeper(el: Pick<ComponentElement, 'role' | 'label'>): boolean {
  return el.role === 'goalkeeper' || el.label === 'G';
}

export function defaultAnimId(isGK: boolean): string {
  return isGK ? 'gk_ready' : 'idle';
}

export function defaultPosture(isGK: boolean): PlayerAnimId {
  return defaultAnimId(isGK);
}

/** Migrate legacy posture or validate stored pose id. */
export function resolvePlayerAnimId(
  el: Pick<ComponentElement, 'posture' | 'role' | 'label'>
): PlayerAnimId {
  const gk = isGoalkeeper(el);
  const ids = knownPoseIds();
  if (el.posture) {
    if (ids.has(el.posture)) return el.posture;
    const migrated = LEGACY_POSTURE_TO_ANIM[el.posture];
    if (migrated && ids.has(migrated)) return migrated;
  }
  return defaultAnimId(gk);
}

export function animIdToFigurePosture(animId: string): PlayerPostureId {
  return ANIM_TO_FIGURE_POSTURE[animId] ?? 'standing';
}

export function resolvePosture(el: Pick<ComponentElement, 'posture' | 'role' | 'label'>): PlayerPostureId {
  return animIdToFigurePosture(resolvePlayerAnimId(el));
}

export function posturesForPlayer(isGK: boolean): PlayerPostureMeta[] {
  return PLAYER_POSTURES.filter((p) => !p.gkOnly || isGK).filter((p) => !p.outfieldOnly || !isGK);
}

export function migratePlayerPosture(posture: string | undefined, _isGK: boolean): string | undefined {
  if (!posture) return undefined;
  const ids = knownPoseIds();
  if (ids.has(posture)) return posture;
  const migrated = LEGACY_POSTURE_TO_ANIM[posture];
  if (migrated && ids.has(migrated)) return migrated;
  return undefined;
}

export function listCatalogAnimations(isGK: boolean): PlayerAnimEntry[] {
  return POSE_CATALOG.filter((a) => !a.gkOnly || isGK);
}

export interface PlayerFigureColors {
  shirt: string;
  short: string;
  skin: string;
  pattern: string;
  stroke: string;
}
