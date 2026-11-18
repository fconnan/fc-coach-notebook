import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { clearArg, movePoint, relocate, setArg } from './edit';

const source = `version: fccn-schema:1
items:
  - ball: { x: 1, y: 2 }
  - cone: { x: 4, y: 5 }
  - run: { p: { x: 0, y: 0 }, to: { x: 3, y: 0 }, via: [{ x: 1, y: 1 }] }
`;

const moved = movePoint(source, 'items/0/ball', 1.5, 2.5);
assert.match(moved, /ball: \{ x: 1\.5, y: 2\.5 \}/);
assert.match(moved, /cone: \{ x: 4, y: 5 \}/);

const next = relocate(source, [
  { ref: 'items/0/ball', x: 2, y: 4 },
  { ref: 'items/1/cone', x: 5, y: 7 }
], [
  { ref: 'items/2/run', dx: 1, dy: 2 }
]);
const doc = parse(next) as {
  items: [
    { ball: { x: number; y: number } },
    { cone: { x: number; y: number } },
    { run: { p: { x: number; y: number }; to: { x: number; y: number }; via: { x: number; y: number }[] } }
  ];
};
assert.equal(doc.items[0].ball.x, 2);
assert.equal(doc.items[0].ball.y, 4);
assert.equal(doc.items[1].cone.x, 5);
assert.equal(doc.items[1].cone.y, 7);
const arrow = doc.items[2].run;
assert.deepEqual(arrow.p, { x: 1, y: 2 });
assert.deepEqual(arrow.to, { x: 4, y: 2 });
assert.deepEqual(arrow.via[0], { x: 2, y: 3 });

const bare = `version: fccn-schema:1
items:
  - player: { name: 1, team: blue, angle: -40.7 }
`;
const placed = movePoint(bare, 'items/0/player', 3.5, -1.25);
assert.match(placed, /player: \{ name: 1, team: blue, angle: -40\.7, x: 3\.5, y: -1\.25 \}/);
const player = (parse(placed) as { items: [{ player: { name: number; angle: number; x: number; y: number } }] }).items[0].player;
assert.equal(player.name, 1);
assert.equal(player.angle, -40.7);
assert.equal(player.x, 3.5);
assert.equal(player.y, -1.25);

const styled = setArg(placed, 'items/0/player', 'shape', 'arms');
assert.match(styled, /shape: arms/);
assert.equal((parse(styled) as { items: [{ player: { shape: string; angle: number } }] }).items[0].player.shape, 'arms');
assert.equal((parse(styled) as { items: [{ player: { angle: number } }] }).items[0].player.angle, -40.7);
const swapped = setArg(styled, 'items/0/player', 'shape', 'token');
assert.match(swapped, /shape: token/);
assert.equal(swapped.includes('shape: arms'), false);
const cleared = clearArg(swapped, 'items/0/player', 'shape');
assert.equal(cleared.includes('shape:'), false);
assert.match(cleared, /team: blue/);

console.log('edit move ok');
