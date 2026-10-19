import type { ComponentElement, ElementType, Page, Position, TeamType } from '$lib/stores/workspace';

const EQUIPMENT_TYPES: ElementType[] = [
  'cone', 'coneTall', 'pole', 'hurdle', 'ladder', 'ring', 'mannequin', 'miniGoal', 'fullGoal'
];

/** Centre du terrain affiché (coordonnées SVG), selon le gabarit de page. */
export function pitchCenter(fieldTemplate: Page['fieldTemplate']): Position {
  if (fieldTemplate === 'Demi') return { x: 340, y: 262.5 };
  if (fieldTemplate === 'DemiBas') return { x: 340, y: 787.5 };
  return { x: 340, y: 525 };
}

const OCCUPY_RADIUS = 22;
const OFFSET_STEP = 26;

/** Cherche une position libre autour de `preferred`, avec léger décalage si occupée. */
export function findFreePosition(preferred: Position, elements: ComponentElement[]): Position {
  const occupied = (x: number, y: number) =>
    elements.some(el => Math.hypot(el.position.x - x, el.position.y - y) < OCCUPY_RADIUS);

  if (!occupied(preferred.x, preferred.y)) return { ...preferred };

  for (let ring = 1; ring <= 12; ring++) {
    const count = ring * 8;
    for (let i = 0; i < count; i++) {
      const a = (2 * Math.PI * i) / count;
      const x = preferred.x + Math.cos(a) * OFFSET_STEP * ring;
      const y = preferred.y + Math.sin(a) * OFFSET_STEP * ring;
      if (!occupied(x, y)) return { x, y };
    }
  }
  return { x: preferred.x + OFFSET_STEP, y: preferred.y + OFFSET_STEP };
}

export type LibraryPlaceArgs = {
  type: ElementType;
  team?: TeamType;
  label?: string;
};

/** Construit les données d'un nouvel élément à la position donnée. */
export function buildElementAt(
  page: Page,
  position: Position,
  args: LibraryPlaceArgs
): Omit<ComponentElement, 'id'> {
  const { type, team = 'none', label = '' } = args;
  const base = { type, team, position };

  if (type === 'ball') {
    return { ...base, radius: page.ballSize, color: page.ballColor };
  }

  if (type === 'player') {
    const isGK = label === 'G';
    return {
      ...base,
      label,
      radius: team === 'team1' ? page.team1Size : page.team2Size,
      color: team === 'team1' ? page.team1Color : page.team2Color,
      angle: team === 'team2' ? 180 : 0,
      role: isGK ? 'goalkeeper' : 'outfield'
    };
  }

  if (EQUIPMENT_TYPES.includes(type)) {
    return { ...base, radius: 14, angle: 0 };
  }

  if (type === 'arrow') {
    return {
      ...base,
      pathPoints: [position, { x: position.x + 100, y: position.y }],
      curveType: 'L',
      arrowEnd: true,
      headEnd: 'arrow',
      strokeWidth: 3,
      color: '#ffffff'
    };
  }

  if (type === 'text') {
    return { ...base, text: 'Texte', fontSize: 24, color: '#ffffff', fontWeight: 'bold' };
  }

  if (type === 'callout') {
    return {
      ...base,
      text: 'Annotation',
      width: 180,
      fillColor: '#fdf7d0',
      color: '#1a1a1a',
      fontSize: 13
    };
  }

  if (type === 'rect' || type === 'ellipse') {
    return {
      ...base,
      width: 120,
      height: 80,
      color: '#ffffff',
      strokeWidth: 2,
      fillColor: 'none',
      fillOpacity: 0
    };
  }

  if (type === 'zone') {
    return {
      ...base,
      width: 120,
      height: 80,
      color: '#9bd64a',
      strokeWidth: 2,
      fillColor: '#9bd64a',
      fillOpacity: 0.25
    };
  }

  throw new Error(`Type non pris en charge pour le placement : ${type}`);
}
