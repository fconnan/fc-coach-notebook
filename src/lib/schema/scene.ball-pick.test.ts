import assert from 'node:assert/strict';
import { elementScene } from './scene';
import type { LibraryEntry, SchemaDoc } from './types';

const ball: LibraryEntry = {
  id: 'object.ball',
  name: 'ball',
  type: 'object',
  dir: 'elements/objects',
  file: 'object.ball.yaml',
  doc: {},
  svgs: []
};

const doc: SchemaDoc = {
  id: 'sample.temp',
  type: 'sample',
  items: [{ ball: { x: -4.5, y: 0 } }]
};

const svg = elementScene(doc, new Map([[ball.id, ball]]), 0, 0, true);
assert.match(svg, /data-pick="items\/0\/ball"/);
assert.match(svg, /data-handle="1"/);
assert.match(svg, /data-ball="1"/);

const stacked: SchemaDoc = {
  id: 'sample.temp',
  type: 'sample',
  items: [
    { ball: { x: 0, y: 0 } },
    { player: { name: 1, team: 'blue', x: 0, y: 0 } }
  ]
};
const player: LibraryEntry = {
  id: 'player.blue',
  name: 'Joueur bleu',
  type: 'player',
  dir: 'elements/players',
  file: 'player.blue.yaml',
  doc: {},
  svgs: [{ when: {}, markup: '<circle r="1.15" fill="#2563eb"/>', viewBox: '-1.4 -1.4 2.8 2.8' }]
};
const both = elementScene(stacked, new Map([[ball.id, ball], [player.id, player]]), 0, 0, true);
const ballPick = both.lastIndexOf('data-pick="items/0/ball"');
const playerPick = both.lastIndexOf('data-pick="items/1/player"');
assert.ok(ballPick > playerPick, 'la cible du ballon reste au-dessus du joueur');

const partial = elementScene({
  id: 'sample.temp',
  type: 'sample',
  items: [
    { player: { name: 1, team: 'blue' } },
    { player: { name: 2, team: 'blue', x: 3 } },
    { player: { name: 3, team: 'blue', y: 2 } }
  ]
}, new Map([[player.id, player]]), 0, 0, true);
assert.match(partial, /translate\(0 0\)/);
assert.match(partial, /translate\(3 0\)/);
assert.match(partial, /translate\(0 2\)/);

const empty = elementScene({ id: 'sample.neuf', type: 'sample' }, new Map(), 0, 0, true);
assert.match(empty, /data-left=/);
assert.match(empty, /data-length="1"/);

console.log('scene ball pick ok');
