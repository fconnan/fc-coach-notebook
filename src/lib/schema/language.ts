import type { JSONSchema } from 'monaco-yaml';
import source from './fccn-schema-1.json' with { type: 'json' };
import { isArrowId, isPlayerId } from './scene';
import { svgGeom, svgPaint, svgTags } from './svgShape';
import type { LibraryEntry } from './types';

const TEAMS = ['blue', 'red', 'white', 'yellow'];
const GENRES = ['object', 'shape', 'formation', 'zone'] as const;

export function schemaDocument(entries: Pick<LibraryEntry, 'id' | 'type'>[]): JSONSchema {
  const doc = structuredClone(source) as JSONSchema;
  const definitions = doc.definitions;
  const props = doc.properties;
  for (const genre of GENRES) {
    const names = shortNames(entries, genre);
    const properties: Record<string, JSONSchema> = {};
    for (const name of names) properties[name] = callSchema(`${genre}.${name}`);
    for (const tag of svgTags()) properties[tag] = svgSchema(tag);
    if (genre === 'object') {
      for (const entry of entries) {
        if (isPlayerId(entry.id) || isArrowId(entry.id)) properties[entry.id] = callSchema(entry.id);
      }
    }
    if (definitions) {
      definitions[`${genre}Item`] = {
        type: 'object',
        minProperties: 1,
        maxProperties: 1,
        description: 'La clé est le nom court dans ce genre. Une clé pointée est un identifiant complet.',
        properties,
        additionalProperties: { $ref: '#/definitions/call' }
      };
    }
  }
  const pitches = [...new Set(entries.filter(entry => entry.type === 'pitch' || entry.id.startsWith('pitch.')).flatMap(entry => {
    const short = entry.id.startsWith('pitch.') ? entry.id.slice('pitch.'.length) : entry.id;
    return [short, entry.id];
  }))].sort((a, b) => a.localeCompare(b, 'fr'));
  if (props && typeof props === 'object' && pitches.length) {
    const pitch = props.pitch;
    if (pitch && typeof pitch !== 'boolean') {
      pitch.oneOf = [
        { type: 'string', enum: pitches, description: 'Nom du terrain, par exemple full ou half-attack.' },
        {
          type: 'object',
          description: 'Terrain et arguments.',
          properties: {
            name: { type: 'string', enum: pitches, description: 'Nom du terrain.' },
            width: { type: 'number', description: 'Largeur, en mètres.' },
            length: { type: 'number', description: 'Longueur, en mètres.' },
            margin: { type: 'number', description: 'Marge, en mètres.' },
            boundary: { type: 'string', description: 'Élément posé aux quatre coins.' },
            style: { type: 'string', description: 'Variante de dessin.' },
            mirror: { type: 'boolean', description: 'Miroir par rapport à la ligne médiane. Les deux extrémités s’échangent.' },
            rotate: { type: 'number', enum: [180], description: 'Demi-tour autour du centre.' }
          }
        }
      ];
    }
  }
  return doc;
}

function shortNames(entries: Pick<LibraryEntry, 'id' | 'type'>[], genre: string): string[] {
  const names = entries
    .filter(entry => entry.type === genre || entry.id.startsWith(`${genre}.`))
    .map(entry => entry.id.startsWith(`${genre}.`) ? entry.id.slice(genre.length + 1) : entry.id)
    .filter(name => name && !name.includes('.'));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'fr'));
}

function svgSchema(tag: string): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  for (const name of svgGeom(tag)) {
    properties[name] = name === 'd'
      ? { type: 'string', description: 'Tracé SVG, en mètres.' }
      : name === 'points'
        ? { description: 'Points, en mètres. Texte SVG ou liste de paires.', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } }] }
        : { type: 'number', description: 'En mètres.' };
  }
  for (const name of svgPaint()) properties[name] = { type: ['string', 'number'], description: 'Attribut de dessin SVG.' };
  if (tag === 'path') properties.curve = { type: 'string', enum: ['smooth', 'line', 'free'], description: 'Courbe lisse, segments droits, ou bézier libre.' };
  if (tag !== 'circle') properties.fit = { type: 'string', enum: ['none', 'ratio', 'free'], description: 'none : pas de poignées. ratio : étirable en gardant les proportions. free : déformable.' };
  return {
    type: 'object',
    additionalProperties: false,
    description: `Tracé SVG ${tag}. Pas de defs ni de marker.`,
    properties
  };
}

function callSchema(id: string): JSONSchema {
  const nameSchema: JSONSchema = isPlayerId(id)
    ? { type: ['string', 'number'], description: 'Numéro.' }
    : { type: ['string', 'number'], description: 'Nom.' };
  return {
    description: `Élément ${id}.`,
    oneOf: [
      { type: 'object',
        properties: {
          name: nameSchema,
          title: { type: 'string', description: 'Texte écrit dans le dessin, à la place de {{title}}.' },
          team: { type: 'string', enum: TEAMS, description: 'Équipe.' },
          pitch: { type: 'string', description: 'Demi-terrain du document. Le rectangle vient de la zone de ce nom.' },
          style: { type: 'string', description: 'Variante de dessin.' },
          p: { description: 'Position. Un nombre absent vaut 0. Un texte nomme un point du terrain.', oneOf: [{ type: 'string' }, { $ref: '#/definitions/markPoint' }] },
          s: { description: 'Taille. Un nombre absent vaut 0.', oneOf: [{ type: 'string' }, { $ref: '#/definitions/markSize' }] },
          r: { description: 'Rectangle. Un nombre absent vaut 0. Un texte nomme un rectangle du terrain.', oneOf: [{ type: 'string' }, { $ref: '#/definitions/markRect' }] },
          c: { description: 'Cercle. Un nombre absent vaut 0. Un texte nomme un cercle du terrain.', oneOf: [{ type: 'string' }, { $ref: '#/definitions/markCircle' }] },
          x: { type: 'number', description: 'Abscisse.' },
          y: { type: 'number', description: 'Ordonnée.' },
          w: { type: 'number', description: 'Largeur.' },
          h: { type: 'number', description: 'Hauteur.' },
          unit: { enum: ['meters', 'relative'], description: 'Unité.' },
          margin: { description: 'Marge extérieure au trait.', allOf: [{ $ref: '#/definitions/inset' }] },
          padding: { description: 'Marge intérieure au trait.', allOf: [{ $ref: '#/definitions/inset' }] },
          angle: { type: 'number', description: 'Angle, en degrés.' },
          min: { description: 'Minimum lisible de cet objet, en part du grand côté. 5% ou 0 pour la taille réelle.' },
          fit: { type: 'string', enum: ['none', 'ratio', 'free'], description: 'Étirement. none : pas de poignées. ratio : proportions gardées. free : déformable.' },
          player: { type: ['string', 'number'], description: 'Joueur qui porte le ballon.' },
          ...(isArrowId(id) ? {
            to: { description: 'Arrivée de la flèche.', oneOf: [{ $ref: '#/definitions/markPoint' }] },
            via: { type: 'array', description: 'Points de passage, dans l’ordre. Sans point, le trait est droit.', items: { $ref: '#/definitions/markPoint' } }
          } : {}),
          width: { type: 'number', description: 'Largeur.' },
          length: { type: 'number', description: 'Longueur.' },
          mirror: { type: 'boolean', description: 'Miroir : les deux extrémités s’échangent.' },
          rotate: { type: 'number', enum: [180], description: 'Demi-tour autour du centre.' },
          fill: { type: 'string', description: 'Couleur du lavis.' },
          alpha: { type: 'number', description: 'Transparence du lavis, de 0 à 1.' },
          object: { type: 'array', items: { $ref: '#/definitions/objectItem' } },
          shape: { type: 'array', items: { $ref: '#/definitions/shapeItem' } },
          formation: { type: 'array', items: { $ref: '#/definitions/formationItem' } },
          zone: { type: 'array', items: { $ref: '#/definitions/zoneItem' } }
        }
      }
    ]
  };
}

export function namesFrom(entries: LibraryEntry[]): string[] {
  return [...new Set(entries.map(entry => entry.name).filter(Boolean))].sort();
}
