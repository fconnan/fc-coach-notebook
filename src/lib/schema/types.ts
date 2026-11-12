export const SCHEMA_VERSION = 'fccn-schema:1';

export type SchemaUnit = 'meters' | 'relative';

export interface SvgVariant {
  path: string;
  style?: string;
}

/** Dessin déjà lu : le markup est le contenu du fichier, sans la balise svg. */
export interface StretchSpec {
  x?: string;
  y?: string;
}

/** Taille réelle du viewBox, en mètres, et minimum lisible en part du grand côté. */
export interface SizeSpec {
  realW?: number;
  realH?: number;
  /** 0,035 pour 3,5 %. 0, ou absent, garde la taille réelle. */
  min?: number;
}

/** Règles d’affichage d’un schéma. `scale` multiplie les minimums ; une clé d’élément les surcharge. */
export interface SizeRules {
  scale?: number;
  [element: string]: number | string | undefined;
}

export interface SvgAsset {
  style: string;
  markup: string;
  viewBox: string;
  /** Bandes d’étirement. Le YAML de l’élément l’emporte sur les attributs du SVG. */
  stretch?: StretchSpec;
  /** Taille réelle et minimum lisible. Le YAML de l’élément l’emporte sur les attributs du SVG. */
  size?: SizeSpec;
  /** Étirement à la pose. `ratio` garde les proportions, `free` déforme. Absent : pas de poignées. */
  fit?: 'ratio' | 'free';
}

export interface SchemaDoc {
  version?: string;
  /** Genre, posé à la lecture depuis le nom du fichier : object, pitch, shape, formation, zone. */
  type?: string;
  /** Identifiant pointé, posé à la lecture : object.ball. Il n’est pas enregistré. */
  id?: string;
  /** Sur un exercice, le titre. */
  name?: string;
  /** Style global, pour choisir une variante SVG. */
  style?: string;
  units?: SchemaUnit;
  outline?: boolean;
  /** Terrain du document : un nom court, ou des arguments dont name. */
  pitch?: string | CallArgs;
  width?: number;
  length?: number;
  margin?: number;
  boundary?: string;
  /** Points nommés du terrain, en mètres. */
  p?: Record<string, MarkPoint>;
  /** Rectangles nommés du terrain, en mètres. */
  r?: Record<string, MarkRect>;
  /** Cercles nommés du terrain, en mètres. */
  c?: Record<string, MarkCircle>;
  object?: ItemSpec[];
  shape?: ItemSpec[];
  formation?: ItemSpec[];
  zone?: ItemSpec[];
  phases?: PhaseSpec[];
  svg?: SvgVariant[];
  /** Étirement du dessin. Prioritaire sur les attributs data-stretch du SVG. */
  stretch?: StretchSpec;
  /** Taille réelle du dessin. Prioritaire sur les attributs data-real du SVG. */
  size?: { real?: { w?: number; h?: number }; min?: number | string };
  /** Étirement. Prioritaire sur data-fit du SVG. `ratio` garde les proportions, `free` déforme, `none` retire les poignées. */
  fit?: string;
  /** Affichage des objets de ce schéma. `scale: 0` laisse tout à la taille réelle. */
  sizes?: SizeRules;
  viewBox?: string;
  /** Ligne médiane et motif d’une flèche. Le mouvement peut les recouvrir. */
  trajectory?: TrajectorySpec;
  /** Style du dessin : encre, épaisseur, pointillés. */
  params?: Record<string, string | number>;
  /** Rendu calculé à la lecture, pour l’icône. Il n’est pas enregistré. */
  preview?: string;
}

/** Géométrie d’un préréglage de flèche, en mètres. */
export interface TrajectorySpec {
  motif?: 'none' | 'sine' | 'zigzag';
  /** Points de passage du tracé de démonstration. */
  via?: MarkPoint[];
  wave?: number;
  amp?: number;
  phase?: number;
  side?: 1 | -1;
  taper?: number;
  neck?: number;
  trim?: number;
}

export interface CallArgs {
  name?: string | number;
  /** Texte écrit dans le dessin, à la place de {{title}}. */
  title?: string;
  team?: string;
  /** Demi-terrain du document. Le rectangle vient de la zone de ce nom. */
  pitch?: string;
  style?: string;
  /** Couleur du lavis. Sans alpha, un lavis coloré est à 0,2. */
  fill?: string;
  /** Transparence du lavis, de 0 à 1. */
  alpha?: number;
  /** Position. Un nombre absent vaut 0. Un texte nomme un point du terrain. */
  p?: MarkPoint | string;
  /** Taille. Un nombre absent vaut 0. */
  s?: MarkSize | string;
  /** Rectangle. Un nombre absent vaut 0. Un texte nomme un rectangle du terrain. */
  r?: MarkRect | string;
  /** Cercle. Un nombre absent vaut 0. Un texte nomme un cercle du terrain. */
  c?: MarkCircle | string;
  unit?: SchemaUnit;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  angle?: number;
  /** Minimum lisible de cet objet, en part du grand côté. 5% ou 0. */
  min?: number | string;
  /** Étirement de cette pose. `ratio` garde les proportions, `free` déforme, `none` retire les poignées. */
  fit?: string;
  player?: string | number;
  width?: number;
  length?: number;
  margin?: BoxInset;
  padding?: BoxInset;
  boundary?: string;
  /** Réflexion par rapport à la ligne médiane : les deux extrémités s’échangent. */
  mirror?: boolean;
  /** Demi-tour autour du centre. 180 échange les extrémités et les côtés. */
  rotate?: number;
  /** Arrivée d'une flèche posée. */
  to?: MarkPoint | number[];
  /** Points de passage d'une flèche, dans l'ordre. Sans point, le trait est droit. */
  via?: (MarkPoint | number[])[];
  /** Préréglage de flèche, ou none pour un déplacement sans dessin. */
  arrow?: string;
  wave?: number;
  amp?: number;
  phase?: number;
  side?: 1 | -1;
  taper?: number;
  neck?: number;
  dash?: string;
  ink?: string;
  object?: ItemSpec[];
  shape?: ItemSpec[];
  formation?: ItemSpec[];
  zone?: ItemSpec[];
}

/** Une seule clé : le type. La valeur est un nom ou des arguments. */
export type ItemSpec = Record<string, string | number | CallArgs>;

export interface BoxEdges {
  x?: number;
  y?: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export type BoxInset = number | BoxEdges;

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

export interface MarkPoint {
  x?: number;
  y?: number;
}

export interface MarkSize {
  w?: number;
  h?: number;
}

export interface MarkRect {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface MarkCircle {
  x?: number;
  y?: number;
  radius?: number;
}

export interface Spot {
  x: number;
  y: number;
}

/** Trajet d'une flèche. Sans `via`, le trait est la droite du joueur au point d'arrivée. */
export interface Travel extends Spot {
  /** Préréglage, par exemple zigzag. `none` dessine rien : le joueur suit quand même le tracé. */
  arrow?: string;
  /** Points de passage, dans le repère du terrain. */
  via?: MarkPoint[];
  /** Longueur d'onde, en mètres. */
  wave?: number;
  /** Amplitude latérale, en mètres. */
  amp?: number;
  phase?: number;
  side?: 1 | -1;
  taper?: number;
  neck?: number;
  width?: number;
  dash?: string;
  ink?: string;
}

export interface PhaseSpec {
  name?: string;
  duration?: number;
  moves?: MoveSpec[];
}

export interface MoveSpec {
  player?: string | number;
  dribble?: number[] | Travel;
  run?: number[] | Travel;
  from?: string | number;
  pass?: string | number | number[] | Travel;
}

export interface LibraryEntry {
  /** Chemin pointé, par exemple object.ball ou pitch.rect-20x15. */
  id: string;
  /** Premier segment de l’identifiant : object, pitch, shape, formation, zone. */
  type: string;
  /** Reste de l’identifiant : ball, rect-20x15. */
  name: string;
  file: string;
  dir: string;
  doc: SchemaDoc;
  svgs: SvgAsset[];
}

export interface PlacedPlayer {
  id: string;
  team: string;
  x: number;
  y: number;
  /** Dessin du jeton, avec le numéro déjà inscrit. */
  svg: string;
  /** Chemin YAML dans le schéma, par exemple `object/2/player`. */
  ref?: string;
  /** Vient d’une forme : sélectionnable, mais ses coordonnées ne sont pas dans ce fichier. */
  locked?: boolean;
  ox?: number;
  oy?: number;
  sx?: number;
  sy?: number;
  relative?: boolean;
  /** Mètres par unité de dessin, pour ramener le SVG à sa taille réelle. */
  ux?: number;
  uy?: number;
  /** Rayon réel du jeton, en mètres. */
  radius?: number;
  /** Grand côté réel, en mètres. */
  real?: number;
  /** Minimum lisible déjà multiplié par le facteur du schéma. */
  min?: number;
  /** Poignées de la sélection. Absent : aucune. */
  fit?: 'ratio' | 'free';
}

export interface PlacedMark {
  svg: string;
  x: number;
  y: number;
  /** Degrés, autour du point d’ancrage, sens antihoraire sur le schéma. */
  angle?: number;
  ref?: string;
  locked?: boolean;
  ox?: number;
  oy?: number;
  sx?: number;
  sy?: number;
  relative?: boolean;
  /** Taille posée, en mètres. */
  w?: number;
  h?: number;
  title?: string;
  /** ViewBox source, présent quand le dessin a des règles d’étirement. */
  box?: { x: number; y: number; w: number; h: number };
  stretch?: StretchSpec;
  ux?: number;
  uy?: number;
  /** Grand côté réel, en mètres. */
  real?: number;
  /** Minimum lisible déjà multiplié par le facteur du schéma. */
  min?: number;
  /** Poignées de la sélection. Absent : aucune. */
  fit?: 'ratio' | 'free';
}

export interface PlacedZone {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  alpha?: number;
  ref?: string;
}

export interface ArrowMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'dribble' | 'run' | 'pass';
  /** Dessin étiré le long de +x, depuis l’origine. */
  svg?: string;
  /** Orientation dans le repère du schéma, en degrés. */
  angle?: number;
  /** Agrandissement d’affichage, appliqué après l’étirement. */
  glyph?: number;
  /** Préréglage arrow.*, s'il diffère du type de mouvement. `none` ne dessine pas le trait. */
  arrow?: string;
  /** Motif résolu : sine et zigzag portent une onde. */
  motif?: 'none' | 'sine' | 'zigzag';
  /** Points de passage, dans le repère de la scène. */
  via?: MarkPoint[];
  /** Chemin YAML, par exemple `phases/0/moves/1/dribble` ou `object/2/arrow.run`. */
  ref?: string;
  /** `player` : le départ est le joueur. `free` : la flèche est posée dans le schéma. */
  start?: 'player' | 'free';
  /** Ligne médiane, sans motif, en coordonnées de scène. */
  line?: string;
  /** L'arrivée est un joueur : pas de poignée sur la pointe. */
  tip?: boolean;
  locked?: boolean;
  ox?: number;
  oy?: number;
  sx?: number;
  sy?: number;
  relative?: boolean;
  wave?: number;
  amp?: number;
  phase?: number;
  side?: 1 | -1;
  taper?: number;
  neck?: number;
  width?: number;
  dash?: string;
  ink?: string;
  /** Joueur qui suit cette ligne médiane. */
  actor?: string;
  /** Longueur de la ligne médiane, en mètres. */
  length?: number;
  /** Point de la ligne médiane. 1 est la cible. */
  pointAt?: (fraction: number) => { x: number; y: number };
  /** Le dessin est déjà en coordonnées de scène. */
  world?: boolean;
}

export interface Scene {
  width: number;
  length: number;
  margin: number;
  lines: number[][];
  /** Pitch drawing in SVG coordinates, y downward, origin at the top-left of the playing area. */
  drawing: string;
  /** Tracés SVG simples, en mètres, dans le repère du schéma (Y vers le haut). */
  ink: string;
  inkBounds: { minX: number; minY: number; maxX: number; maxY: number }[];
  zones: PlacedZone[];
  players: PlacedPlayer[];
  marks: PlacedMark[];
  arrows: ArrowMark[];
  ball: {
    x: number;
    y: number;
    svg: string;
    ref?: string;
    radius?: number;
    radiusY?: number;
    real?: number;
    fit?: 'ratio' | 'free';
    min?: number;
    locked?: boolean;
    ox?: number;
    oy?: number;
    sx?: number;
    sy?: number;
    relative?: boolean;
  } | null;
  phases: { name: string; duration: number }[];
  error?: string;
}
