import type { JSONSchema } from 'monaco-yaml';
import source from './fccn-schema-1.json' with { type: 'json' };
import { declaredParams, paramChoices } from './parameters';
import { isArrowId, isPlayerId } from './scene';
import { svgGeom, svgPaint, svgTags } from './svgShape';
import type { LibraryEntry, SchemaDoc } from './types';

const GENRES = ['object', 'shape', 'formation', 'zone'] as const;
const TEST_BODY: JSONSchema = {
  type: 'array',
  description: 'Corps du test. Ces items sont posés quand le paramètre a cette valeur.',
  items: { $ref: '#/definitions/item' }
};

type KnownEntry = Pick<LibraryEntry, 'id' | 'type'> & { doc?: SchemaDoc };

function asLibrary(entries: KnownEntry[]): LibraryEntry[] {
  return entries.filter(item => item.doc).map(item => ({
    id: item.id,
    type: item.type,
    name: item.id.includes('.') ? item.id.slice(item.id.indexOf('.') + 1) : item.id,
    file: '',
    dir: '',
    doc: item.doc as SchemaDoc,
    svgs: []
  }));
}

export function schemaDocument(entries: KnownEntry[]): JSONSchema {
  const library = asLibrary(entries);
  const doc = structuredClone(source) as JSONSchema;
  const definitions = doc.definitions;
  for (const genre of GENRES) {
    const names = shortNames(entries, genre);
    const properties: Record<string, JSONSchema> = {};
    for (const name of names) properties[name] = callSchema(`${genre}.${name}`, library);
    for (const tag of svgTags()) properties[tag] = svgSchema(tag);
    properties.svg = svgFileSchema();
    if (genre === 'object') {
      for (const entry of entries) {
        if (isPlayerId(entry.id)) properties.player = callSchema(entry.id, library);
        if (isArrowId(entry.id)) {
          const dot = entry.id.lastIndexOf('.');
          properties[dot > 0 ? entry.id.slice(dot + 1) : entry.id] = callSchema(entry.id, library);
        }
      }
    }
    if (definitions) {
      definitions[`${genre}Item`] = {
        type: 'object',
        minProperties: 1,
        maxProperties: 1,
        description: 'La clé est le dernier segment du nom de fichier. ball pour object.ball.yaml.',
        properties,
        patternProperties: { '^[\\w-]+=[\\w.-]+$': TEST_BODY },
        additionalProperties: { $ref: '#/definitions/call' }
      };
    }
  }
  const pitches = [...new Set(entries.filter(entry => entry.type === 'pitch' || entry.id.startsWith('pitch.')).flatMap(entry => {
    const short = entry.id.startsWith('pitch.') ? entry.id.slice('pitch.'.length) : entry.id;
    return [short, entry.id];
  }))].sort((a, b) => a.localeCompare(b, 'fr'));
  const objectItem = definitions?.objectItem;
  if (objectItem && typeof objectItem === 'object' && !Array.isArray(objectItem)) {
    objectItem.properties = objectItem.properties || {};
    objectItem.properties.zone = { $ref: '#/definitions/zoneItem', description: 'Zone enveloppée. Une seule clé, le type.' };
    objectItem.properties.formation = { $ref: '#/definitions/formationItem', description: 'Formation enveloppée. Une seule clé, le type.' };
    objectItem.properties.shape = { $ref: '#/definitions/shapeItem', description: 'Forme enveloppée. Une seule clé, le type.' };
  }
  if (objectItem && typeof objectItem === 'object' && !Array.isArray(objectItem) && objectItem.properties && pitches.length) {
    objectItem.properties.pitch = {
      description: 'Terrain posé. Un nom court, ou des arguments dont name.',
      oneOf: [
        { type: 'string', enum: pitches },
        {
          type: 'object',
          properties: {
            name: { type: 'string', enum: pitches, description: 'Nom du terrain.' },
            width: { type: 'number', description: 'Largeur, en mètres.' },
            length: { type: 'number', description: 'Longueur, en mètres.' },
            margin: { type: 'number', description: 'Marge, en mètres.' },
            mirror: { type: 'boolean', description: 'Miroir : les deux extrémités s’échangent.' },
            rotate: { type: 'number', enum: [180], description: 'Demi-tour autour du centre.' }
          }
        }
      ]
    };
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

function svgFileSchema(): JSONSchema {
  return {
    type: 'object',
    description: 'Dessin SVG de l’élément. Le chemin est relatif au fichier. Les autres clés sont des paramètres {{nom}}.',
    properties: {
      path: { type: 'string', description: 'Chemin relatif au fichier YAML.' }
    },
    additionalProperties: { type: ['string', 'number', 'boolean'], description: 'Paramètre du dessin, par exemple fill ou dash.' }
  };
}

function svgSchema(tag: string): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  const centered = tag === 'circle' || tag === 'ellipse' || tag === 'rect';
  for (const name of svgGeom(tag)) {
    const key = (tag === 'circle' || tag === 'ellipse') && name === 'cx' ? 'x'
      : (tag === 'circle' || tag === 'ellipse') && name === 'cy' ? 'y'
        : name;
    properties[key] = key === 'd'
      ? { type: 'string', description: 'Tracé SVG, en mètres.' }
      : key === 'points'
        ? { description: 'Points, en mètres. Texte SVG ou liste de paires.', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } }] }
        : {
            type: 'number',
            description: centered && (key === 'x' || key === 'y')
              ? 'Centre, en mètres. Absent, il vaut 0.'
              : 'En mètres.'
          };
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

function callSchema(id: string, library: LibraryEntry[]): JSONSchema {
  const nameSchema: JSONSchema = isPlayerId(id)
    ? { type: ['string', 'number'], description: 'Numéro.' }
    : { type: ['string', 'number'], description: 'Nom.' };
  const self = library.find(item => item.id === id);
  const choices = self ? paramChoices(self, library) : [];
  const declared: Record<string, JSONSchema> = {};
  for (const param of self ? declaredParams(self, library) : []) {
    const names = choices.find(choice => choice.key === param.key)?.names || [];
    declared[param.key] = names.length
      ? { type: 'string', enum: names, description: `Paramètre ${param.key}.` }
      : { type: 'string', description: `Paramètre ${param.key}.` };
  }
  return {
    description: `Élément ${id}.`,
    oneOf: [
      { type: 'object',
        properties: {
          name: nameSchema,
          title: { type: 'string', description: 'Texte écrit dans le dessin, à la place de {{title}}.' },
          pitch: { type: 'string', description: 'Demi-terrain du document. Le rectangle vient de la zone de ce nom.' },
          ...declared,
          p: { description: 'Position. Un nombre absent vaut 0. Un texte nomme un point du terrain.', oneOf: [{ type: 'string' }, { $ref: '#/definitions/markPoint' }] },
          s: { description: 'Taille. Un nombre absent vaut 0.', oneOf: [{ type: 'string' }, { $ref: '#/definitions/markSize' }] },
          r: { description: 'Rectangle. Un nombre absent vaut 0. Un texte nomme un rectangle du terrain.', oneOf: [{ type: 'string' }, { $ref: '#/definitions/markRect' }] },
          c: { description: 'Cercle. Un nombre absent vaut 0. Un texte nomme un cercle du terrain.', oneOf: [{ type: 'string' }, { $ref: '#/definitions/markCircle' }] },
          x: { type: 'number', description: 'Abscisse. Absente, elle vaut 0.' },
          y: { type: 'number', description: 'Ordonnée. Absente, elle vaut 0.' },
          w: { type: 'number', description: 'Largeur.' },
          h: { type: 'number', description: 'Hauteur.' },
          unit: { enum: ['meters', 'relative'], description: 'Unité.' },
          margin: { description: 'Marge extérieure au trait.', allOf: [{ $ref: '#/definitions/inset' }] },
          padding: { description: 'Marge intérieure au trait.', allOf: [{ $ref: '#/definitions/inset' }] },
          angle: { type: 'number', description: 'Angle, en degrés.' },
          'min-size': { description: 'Minimum lisible de cet objet, en part du grand côté. 5% ou 0 pour la taille réelle.' },
          'real-w': { type: 'number', description: 'Largeur réelle de cette pose, en mètres.' },
          'real-h': { type: 'number', description: 'Hauteur réelle de cette pose, en mètres.' },
          'stretch-x': { type: 'string', description: 'Bandes horizontales de cette pose.' },
          'stretch-y': { type: 'string', description: 'Bandes verticales de cette pose.' },
          upright: { type: 'array', items: { type: 'string' }, description: 'Parties qui gardent l’horizontale.' },
          fixed: { type: 'boolean', description: 'Visible, sans sélection.' },
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
          items: { type: 'array', items: { $ref: '#/definitions/objectItem' } },
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
