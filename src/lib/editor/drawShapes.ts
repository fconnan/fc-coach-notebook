/** Outils de tracé partagés par l’éditeur SVG et l’éditeur de schéma. */
export type DrawShape = { kind: string; label: string; d: string };

export const DRAW_SHAPES: DrawShape[] = [
  { kind: 'rect', label: 'Rectangle', d: 'M4 6h16v12H4z' },
  { kind: 'circle', label: 'Cercle', d: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z' },
  { kind: 'ellipse', label: 'Ellipse', d: 'M12 6.5a9 5.5 0 1 0 0 11a9 5.5 0 1 0 0-11z' },
  { kind: 'line', label: 'Ligne', d: 'M5 19 19 5' },
  { kind: 'polygon', label: 'Polygone', d: 'M12 4.5 20 18.5H4z' },
  { kind: 'path', label: 'Chemin', d: 'M4 18C8 3 16 21 20 6' }
];

export const TEXT_SHAPE: DrawShape = { kind: 'text', label: 'Texte', d: 'M6 5h12M12 5v14M9 19h6' };
