import assert from 'node:assert/strict';
import path from 'node:path';
import { loadLibrary } from './library';
import { activeItems, callDefaults, paramValues, pickAsset, resolveParams, writeDefaults } from './parameters';
import { buildScene, elementScene } from './scene';
import type { ItemSpec, LibraryEntry, SchemaDoc, SvgAsset } from './types';

const assets: SvgAsset[] = [
  { when: { shape: 'token' }, markup: 'DEF', viewBox: '0 0 1 1' },
  { when: { shape: 'arms' }, markup: 'ORI', viewBox: '0 0 1 1' },
  { when: {}, markup: 'ANY', viewBox: '0 0 1 1' }
];
assert.equal(pickAsset(assets, { shape: 'token' })?.markup, 'DEF');
assert.equal(pickAsset(assets, { shape: 'arms' })?.markup, 'ORI');
assert.equal(pickAsset([{ when: {}, markup: 'ANY', viewBox: '0 0 1 1' }], {})?.markup, 'ANY');

const player: LibraryEntry = {
  id: 'player',
  name: 'player',
  type: 'player',
  dir: 'elements/players',
  file: 'elements/players/player.yaml',
  doc: {
    id: 'player',
    type: 'player',
    parameters: [{ shape: 'token' }, { team: 'blue' }],
    items: [
      { 'shape=token': [{ 'team=red': [{ svg: { path: 'red.svg' } }] }, { svg: { path: 'token.svg' } }] }
    ] as unknown as ItemSpec[],
    defaults: [
      { 'team=blue': { fill: '#2563eb', ink: '#ffffff' } },
      { 'team=red': { fill: '#dc2626', ink: '#ffffff' } }
    ]
  },
  svgs: [
    { when: { shape: 'token' }, markup: '<g id="token" fill="{{fill|black}}"/>', viewBox: '0 0 1 1' },
    { when: { shape: 'arms' }, markup: '<g id="arms"/>', viewBox: '0 0 1 1' }
  ]
};
const red: LibraryEntry = {
  id: 'player.red',
  name: 'red',
  type: 'player',
  dir: 'elements/players',
  file: 'elements/players/player.red.yaml',
  doc: { id: 'player.red', type: 'player', items: [{ player: { team: 'red' } }] },
  svgs: player.svgs
};
const block: LibraryEntry = {
  id: 'formation.block',
  name: 'block',
  type: 'formation',
  dir: 'elements/formations',
  file: 'elements/formations/formation.block.yaml',
  doc: {
    id: 'formation.block',
    type: 'formation',
    items: [
      { player: { name: 1, x: 0, y: 0 } },
      { player: { name: 2, team: 'white', x: 1, y: 0 } }
    ]
  },
  svgs: []
};
const names = new Map<string, LibraryEntry>([[player.id, player], [red.id, red], [block.id, block]]);

const bare = resolveParams({ entry: player, library: names, callType: 'player', args: {} });
assert.equal(bare.shape, 'token');
assert.equal(bare.team, 'blue');
const fromDoc = resolveParams({
  entry: player,
  library: names,
  callType: 'player',
  args: {},
  docs: [{ player: { shape: 'arms' } }],
  session: { player: { shape: 'token' } }
});
assert.equal(fromDoc.shape, 'arms', 'les defaults du document passent devant la session');
const fromCall = resolveParams({
  entry: player,
  library: names,
  callType: 'player',
  args: { shape: 'token' },
  docs: [{ player: { shape: 'arms' } }]
});
assert.equal(fromCall.shape, 'token', 'l’argument de l’appel passe devant les defaults');
const fromSession = resolveParams({
  entry: player,
  library: names,
  callType: 'player',
  args: {},
  session: { player: { shape: 'arms' } }
});
assert.equal(fromSession.shape, 'arms');
assert.equal(paramValues(player, { team: 'red', shape: 'token' }, names).fill, '#dc2626');
assert.deepEqual(activeItems(player.doc.items, { shape: 'token', team: 'red' }).map(item => JSON.stringify(item)).length, 2);

const formed = buildScene({
  id: 'sample.temp',
  type: 'sample',
  width: 20,
  length: 20,
  items: [{ block: { team: 'red', x: 0, y: 0 } }]
} as SchemaDoc, names, 0, 0);
const one = formed.players.find(item => item.id.endsWith(':1'));
const two = formed.players.find(item => item.id.endsWith(':2'));
assert.equal(one?.team, 'red');
assert.match(one?.svg || '', /#dc2626/);
assert.equal(two?.team, 'white');

const alias = buildScene({
  id: 'sample.temp',
  type: 'sample',
  width: 10,
  length: 10,
  items: [{ 'player.red': { name: 3, x: 1, y: 1 } }]
} as SchemaDoc, names, 0, 0);
assert.equal(alias.players[0]?.team, 'red');
assert.equal(alias.players[0]?.id, 'red:3');

const pinned = elementScene({
  id: 'sample.temp',
  type: 'sample',
  width: 10,
  length: 10,
  defaults: [{ player: { shape: 'arms' } }],
  items: [{ player: { team: 'blue', name: 1, x: 1, y: 1, shape: 'token' } }]
} as unknown as SchemaDoc, names, 0, 0, true, { player: { shape: 'arms' } });
assert.match(pinned, /data-part="token"/);
assert.match(pinned, /data-element="player"/);
assert.match(pinned, /shape&quot;:&quot;token/);

const source = 'version: fccn-schema:1\ndefaults:\n  - team=red: { fill: "#dc2626" }\nitems:\n  - player: { name: 1 }\n';
const written = writeDefaults(source, 'player', 'shape', 'arms');
assert.match(written, /player: \{ shape: arms \}/);
assert.match(written, /team=red:/);
const cleared = writeDefaults(written, 'player', 'shape', '');
assert.equal(cleared.includes('shape:'), false);
assert.match(cleared, /team=red:/);
assert.equal(callDefaults({ defaults: [{ player: { shape: 'arms' } }, { 'team=red': { fill: '#dc2626' } }] }).player.shape, 'arms');

const library = await loadLibrary(path.resolve('data'));
const blue = library.find(entry => entry.id === 'player.blue');
const base = library.find(entry => entry.id === 'player');
const ball = library.find(entry => entry.id === 'object.ball');
const rect = library.find(entry => entry.id === 'pitch.rect');
assert.ok(blue && base && ball && rect);
const loaded = new Map(library.map(entry => [entry.id, entry]));
assert.equal(paramValues(blue, { team: 'blue' }, loaded).fill, '#2563eb');
assert.equal(paramValues(base, { team: 'white', shape: 'token' }, loaded).line, '#111827');
assert.equal(base.svgs.find(item => item.when.shape === 'token')?.when.shape, 'token');
assert.equal(base.svgs.find(item => item.when.shape === 'arms')?.viewBox, '-37 -34 74 54');
assert.equal(ball.svgs[0]?.when && Object.keys(ball.svgs[0].when).length, 0);
assert.equal(rect.svgs.find(item => item.when.shape === 'cross')?.fixed, true);
const painted = elementScene({
  id: 'sample.temp',
  type: 'sample',
  width: 20,
  length: 20,
  items: [{ player: { name: 4, team: 'blue', x: 2, y: 3 } }]
} as SchemaDoc, loaded);
assert.match(painted, /fill="#2563eb"/);
const cross = elementScene({
  id: 'sample.temp',
  type: 'sample',
  defaults: [{ pitch: { shape: 'cross' } }],
  items: [{ pitch: 'rect' }]
} as SchemaDoc, loaded);
const plain = elementScene({
  id: 'sample.temp',
  type: 'sample',
  items: [{ pitch: 'rect' }]
} as SchemaDoc, loaded);
assert.match(cross, /<line x1="10"/);
assert.equal(plain.includes('<line x1="10"'), false);

console.log('parameters ok');
