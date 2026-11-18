import assert from 'node:assert/strict';
import { buildScene } from './scene';
import type { LibraryEntry, SchemaDoc } from './types';

function entry(id: string, doc: Partial<SchemaDoc>, svgs: LibraryEntry['svgs'] = []): LibraryEntry {
  const [type, ...rest] = id.split('.');
  return {
    id,
    name: rest.join('.'),
    type: type as LibraryEntry['type'],
    dir: 'elements',
    file: `${id}.yaml`,
    doc: { ...doc, id, type } as SchemaDoc,
    svgs
  };
}

const library = new Map<string, LibraryEntry>([
  entry('pitch.half-defense', {
    width: 68,
    length: 52.5,
    origin: { x: 34, y: 0 },
    define: { surface: { x: -20.16, w: 40.32, h: 16.5 } },
    items: [{ svg: { path: 'half-defense.svg' } }, { goal: { x: 0, y: 0 } }]
  }, [{ when: {}, markup: '<rect/>', viewBox: '-36 -54.5 72 56.5' }]),
  entry('pitch.half-attack', { items: [{ pitch: { name: 'half-defense', mirror: true } }] }),
  entry('pitch.full', {
    width: 68,
    length: 105,
    origin: { x: 34, y: 52.5 },
    items: [
      { zone: { 'half-defense': { x: 0, y: -52.5 } } },
      { zone: { 'half-attack': { x: 0, y: 52.5 } } }
    ]
  }),
  entry('object.goal', {}, [{ when: {}, markup: '<rect/>', viewBox: '-3.66 0 7.32 2' }]),
  entry('zone.box', {}),
  entry('formation.keeper', {
    units: 'relative',
    items: [{ pitch: 'half-defense' }, { player: { name: 1, x: 0, y: 0.05 } }]
  })
].map(item => [item.id, item]));

const near = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label} : ${actual} au lieu de ${expected}`);
const goals = (doc: SchemaDoc) => buildScene(doc, library, 0, 0).marks.map(mark => ({ x: mark.x, y: mark.y, angle: mark.angle || 0 }));

const defense = goals(library.get('pitch.half-defense')!.doc);
assert.deepEqual(defense, [{ x: 0, y: 0, angle: 0 }]);

const attack = buildScene(library.get('pitch.half-attack')!.doc, library, 0, 0);
assert.deepEqual(attack.marks.map(mark => [mark.x, mark.y, mark.angle]), [[0, 0, 180]]);
assert.equal(attack.pitchX, 34);
assert.equal(attack.pitchY, 52.5);
assert.match(attack.drawing, /viewBox="-34 -52\.5 68 52\.5"[^>]*><g transform="translate\(0 -52\.5\) scale\(1 -1\)">/);

const full = goals(library.get('pitch.full')!.doc);
assert.deepEqual(full, [{ x: 0, y: -52.5, angle: 0 }, { x: 0, y: 52.5, angle: 180 }]);

const match = buildScene({
  id: 'sample.match',
  type: 'sample',
  items: [
    { pitch: 'full' },
    { zone: { box: { r: 'pitch.half-attack.surface' } } },
    { formation: { keeper: { team: 'blue', pitch: 'half-defense' } } },
    { formation: { keeper: { team: 'red', pitch: 'half-attack' } } }
  ]
} as SchemaDoc, library, 0, 0);
const [blue, red] = match.players;
near(blue.x, 0, 'gardien bleu x');
near(blue.y, -52.5 + 2.625, 'gardien bleu y');
near(red.x, 0, 'gardien rouge x');
near(red.y, 52.5 - 2.625, 'gardien rouge y');
const surface = match.zones[0];
near(surface.x, -20.16, 'surface x');
near(surface.y, 36, 'surface y');
near(surface.h, 16.5, 'surface h');

const keeper = buildScene(library.get('formation.keeper')!.doc, library, 0, 0).players[0];
near(keeper.x, 0, 'formation x');
near(keeper.y, 2.625, 'formation y');

const exercise = buildScene({
  items: [{ pitch: 'full' }, { player: { name: 8, team: 'blue', x: 34, y: 8 } }]
} as SchemaDoc, library, 0, 0);
const placed = exercise.players[0];
near(placed.x, 34, 'exercice x');
near(placed.y, 8, 'exercice y');
const goal = exercise.marks.find(mark => Math.abs(mark.y) < 1e-6);
assert.ok(goal, 'but du bas');
near(goal.x, 34, 'but x');

console.log('scene origin ok');
