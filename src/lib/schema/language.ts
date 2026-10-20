import type { LibraryEntry } from './types';

export function schemaDocument(names: string[]) {
  const known = names.length ? names : ['half', 'full'];
  const point = { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 };
  const move = {
    type: 'object',
    properties: {
      player: { type: ['string', 'number'] },
      dribble: point,
      run: point,
      from: { type: ['string', 'number'] },
      pass: { type: ['string', 'number', 'array'] }
    }
  };
  const item: Record<string, unknown> = {
    type: 'object',
    properties: {
      team: { type: 'string', enum: ['blue', 'red', 'white', 'yellow'] },
      shape: { type: 'string', enum: known },
      at: point,
      object: { type: 'string', enum: known },
      player: { type: ['string', 'number'] },
      ball: { type: ['array', 'string', 'number'] },
      goal: { type: ['array', 'boolean'] }
    }
  };
  const zone: Record<string, unknown> = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      box: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
      items: { type: 'array', items: item },
      zones: { type: 'array', items: { $ref: '#/$defs/zone' } }
    }
  };
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type', 'version', 'name'],
    properties: {
      type: { const: 'fc-tactics-schema' },
      version: { const: 0 },
      name: { type: 'string' },
      units: { enum: ['meters', 'relative'] },
      svg: { type: 'string' },
      pitch: {
        type: 'object',
        properties: {
          template: { type: 'string', enum: known },
          width: { type: 'number' },
          length: { type: 'number' },
          margin: { type: 'number' },
          boundary: { type: 'string', enum: known }
        }
      },
      lines: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
      players: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            number: { type: ['string', 'number'] },
            at: point,
            team: { type: 'string' }
          }
        }
      },
      zones: { type: 'array', items: { $ref: '#/$defs/zone' } },
      items: { type: 'array', items: item },
      phases: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            duration: { type: 'number' },
            moves: { type: 'array', items: move }
          }
        }
      }
    },
    $defs: { zone }
  };
}

export function namesFrom(entries: LibraryEntry[]): string[] {
  return [...new Set(entries.map(entry => entry.name).filter(Boolean))].sort();
}
