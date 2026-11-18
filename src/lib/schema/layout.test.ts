import assert from 'node:assert/strict';
import { movePoint, itemAt } from './edit';
import { instanceSetting, readSchema, SchemaLayoutError } from './layout';
import { buildScene } from './scene';
import type { LibraryEntry, SchemaDoc } from './types';

const flat = readSchema(`version: fccn-schema:1
settings:
  - listed: false
  - real-w: 0.8
  - min-size: 3.5%
define:
  surface: { x: -20.16, w: 40.32, h: 16.5 }
  penalty: { y: 11 }
items:
  - svg: { path: half-defense.svg }
`);
assert.equal(flat.listed, false);
assert.equal(flat['real-w'], 0.8);
assert.equal(flat['min-size'], '3.5%');
assert.equal(flat.define?.surface.x, -20.16);
assert.equal(flat.define?.penalty.y, 11);
assert.equal(flat.define?.surface.h, 16.5);

assert.throws(
  () => readSchema('version: fccn-schema:1\nhello: 1\n'),
  (err: unknown) => err instanceof SchemaLayoutError && /hors catégorie/.test(err.message)
);
assert.throws(
  () => readSchema('version: fccn-schema:1\nsettings:\n  - nope: 1\n'),
  (err: unknown) => err instanceof SchemaLayoutError && /inconnue dans settings/.test(err.message)
);
assert.throws(
  () => readSchema('version: fccn-schema:1\ndefine:\n  - surface: { x: 1 }\n  - surface: { y: 2 }\n'),
  (err: unknown) => err instanceof SchemaLayoutError && /en double dans define/.test(err.message)
);

const zone = `version: fccn-schema:1
items:
  - zone:
      rect: { x: 4, y: 5, w: 6, h: 7 }
`;
assert.equal(itemAt(zone, zone.indexOf('rect')), 'items/0/zone/rect');
const moved = movePoint(zone, 'items/0/zone/rect', 8, 9);
assert.match(moved, /x: 8/);
assert.match(moved, /y: 9/);
assert.match(moved, /zone:/);

assert.equal(instanceSetting('min-size', { 'min-size': '5%' }, [{ player: { 'min-size': '8%' } }], ['player']), '5%');
assert.equal(instanceSetting('min-size', {}, [{ player: { 'min-size': '8%' } }, { player: { 'min-size': '3%' } }], ['player']), '3%');
assert.equal(instanceSetting('min-size', {}, [{ player: { 'min-size': '8%' } }], ['player']), '8%');

function entry(id: string, doc: Partial<SchemaDoc>, svgs: LibraryEntry['svgs'] = []): LibraryEntry {
  const [type, ...rest] = id.split('.');
  return { id, name: rest.join('.'), type, dir: 'elements', file: `${id}.yaml`, doc: { ...doc, id, type } as SchemaDoc, svgs };
}

const library = new Map<string, LibraryEntry>([
  entry('pitch.half-defense', {
    width: 68,
    length: 52.5,
    origin: { x: 34, y: 0 },
    define: {
      surface: { x: -20.16, w: 40.32, h: 16.5 },
      penalty: { y: 11 },
      cercle: { y: 52.5, radius: 9.15 }
    },
    items: [{ goal: { x: 0, y: 0 } }]
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
  entry('player', {}, [{
    when: {},
    markup: '<g id="label"/>',
    viewBox: '-1 -1 2 2',
    size: { realW: 0.8, min: 0.02 },
    upright: ['label']
  }])
].map(item => [item.id, item]));

const attack = buildScene({
  items: [{ pitch: 'half-attack' }, { zone: { box: { r: 'pitch.half-attack.surface' } } }]
} as SchemaDoc, library, 0, 0);
const surface = attack.zones[0];
assert.ok(surface, 'surface reprise du terrain miroir');
assert.ok(Math.abs(surface.w - 40.32) < 1e-6, `largeur ${surface?.w}`);
assert.ok(Math.abs(surface.h - 16.5) < 1e-6, `hauteur ${surface?.h}`);

const placed = buildScene({
  width: 40,
  length: 40,
  defaults: [{ player: { 'min-size': '8%' } }],
  items: [
    { player: { name: 1, x: 4, y: 4 } },
    { player: { name: 2, x: 8, y: 8, 'min-size': '2%' } }
  ]
} as SchemaDoc, library, 0, 0);
const fromDefaults = placed.players.find(player => player.id.endsWith(':1'));
const fromArg = placed.players.find(player => player.id.endsWith(':2'));
assert.ok(Math.abs((fromDefaults?.min ?? 0) - 0.08) < 1e-6, `defaults ${fromDefaults?.min}`);
assert.ok(Math.abs((fromArg?.min ?? 0) - 0.02) < 1e-6, `argument ${fromArg?.min}`);

console.log('layout ok');
