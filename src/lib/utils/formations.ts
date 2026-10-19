import type { TeamType } from '$lib/stores/workspace';

// Display-space dimensions of the vertical pitch (see Pitch.svelte mapping).
// Width (left-right) = 680, Length (goal-to-goal) = 1050.
const PITCH_W = 680;
const PITCH_L = 1050;

export interface FormationSpot {
  label: string;
  fx: number; // 0..1 across the width
  fy: number; // 0..1 along the length (0 = far goal, 1 = own goal)
}

// Formations are defined for a team defending the BOTTOM goal (own goal at fy≈1),
// attacking upwards. Outfield numbering follows football convention.
export const FORMATIONS: Record<string, FormationSpot[]> = {
  '4-4-2': [
    { label: 'G', fx: 0.50, fy: 0.95 },
    { label: '2', fx: 0.16, fy: 0.78 }, { label: '5', fx: 0.39, fy: 0.80 }, { label: '6', fx: 0.61, fy: 0.80 }, { label: '3', fx: 0.84, fy: 0.78 },
    { label: '7', fx: 0.16, fy: 0.56 }, { label: '8', fx: 0.39, fy: 0.58 }, { label: '4', fx: 0.61, fy: 0.58 }, { label: '11', fx: 0.84, fy: 0.56 },
    { label: '9', fx: 0.40, fy: 0.38 }, { label: '10', fx: 0.60, fy: 0.38 }
  ],
  '4-3-3': [
    { label: 'G', fx: 0.50, fy: 0.95 },
    { label: '2', fx: 0.16, fy: 0.78 }, { label: '5', fx: 0.39, fy: 0.80 }, { label: '6', fx: 0.61, fy: 0.80 }, { label: '3', fx: 0.84, fy: 0.78 },
    { label: '4', fx: 0.30, fy: 0.58 }, { label: '8', fx: 0.50, fy: 0.60 }, { label: '10', fx: 0.70, fy: 0.58 },
    { label: '7', fx: 0.20, fy: 0.36 }, { label: '9', fx: 0.50, fy: 0.34 }, { label: '11', fx: 0.80, fy: 0.36 }
  ],
  '4-2-3-1': [
    { label: 'G', fx: 0.50, fy: 0.95 },
    { label: '2', fx: 0.16, fy: 0.78 }, { label: '5', fx: 0.39, fy: 0.80 }, { label: '6', fx: 0.61, fy: 0.80 }, { label: '3', fx: 0.84, fy: 0.78 },
    { label: '4', fx: 0.38, fy: 0.62 }, { label: '8', fx: 0.62, fy: 0.62 },
    { label: '7', fx: 0.20, fy: 0.46 }, { label: '10', fx: 0.50, fy: 0.44 }, { label: '11', fx: 0.80, fy: 0.46 },
    { label: '9', fx: 0.50, fy: 0.30 }
  ],
  '3-5-2': [
    { label: 'G', fx: 0.50, fy: 0.95 },
    { label: '5', fx: 0.28, fy: 0.80 }, { label: '4', fx: 0.50, fy: 0.82 }, { label: '6', fx: 0.72, fy: 0.80 },
    { label: '2', fx: 0.12, fy: 0.58 }, { label: '8', fx: 0.36, fy: 0.60 }, { label: '10', fx: 0.50, fy: 0.62 }, { label: '7', fx: 0.64, fy: 0.60 }, { label: '3', fx: 0.88, fy: 0.58 },
    { label: '9', fx: 0.40, fy: 0.38 }, { label: '11', fx: 0.60, fy: 0.38 }
  ],
  '4-4-2 losange': [
    { label: 'G', fx: 0.50, fy: 0.95 },
    { label: '2', fx: 0.16, fy: 0.78 }, { label: '5', fx: 0.39, fy: 0.80 }, { label: '6', fx: 0.61, fy: 0.80 }, { label: '3', fx: 0.84, fy: 0.78 },
    { label: '4', fx: 0.50, fy: 0.66 }, { label: '7', fx: 0.22, fy: 0.54 }, { label: '11', fx: 0.78, fy: 0.54 }, { label: '10', fx: 0.50, fy: 0.46 },
    { label: '9', fx: 0.40, fy: 0.34 }, { label: '8', fx: 0.60, fy: 0.34 }
  ]
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

/**
 * Returns absolute display-space positions for a formation.
 * team1 defends the bottom goal; team2 is mirrored to defend the top goal.
 */
export function formationPositions(name: string, team: TeamType): { label: string; x: number; y: number }[] {
  const spots = FORMATIONS[name] || FORMATIONS['4-4-2'];
  return spots.map(s => {
    const fy = team === 'team2' ? 1 - s.fy : s.fy;
    const fx = team === 'team2' ? 1 - s.fx : s.fx;
    return { label: s.label, x: fx * PITCH_W, y: fy * PITCH_L };
  });
}
