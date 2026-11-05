import type { JSONSchema } from 'monaco-yaml';
import source from './fccn-schema-1.json' with { type: 'json' };
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

function callSchema(id: string): JSONSchema {
  const nameSchema: JSONSchema = id === 'object.player'
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
          player: { type: ['string', 'number'], description: 'Joueur qui porte le ballon.' },
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
