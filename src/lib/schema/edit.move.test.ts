import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { movePoint, relocate } from './edit';

const source = `version: fccn-schema:1
object:
  - { ball: { x: 1, y: 2 } }
  - { cone: { x: 4, y: 5 } }
  - { arrow.run: { p: { x: 0, y: 0 }, to: { x: 3, y: 0 }, via: [{ x: 1, y: 1 }] } }
`;

const moved = movePoint(source, 'object/0/ball', 1.5, 2.5);
assert.match(moved, /ball: \{ x: 1\.5, y: 2\.5 \}/);
assert.match(moved, /cone: \{ x: 4, y: 5 \}/);

const next = relocate(source, [
  { ref: 'object/0/ball', x: 2, y: 4 },
  { ref: 'object/1/cone', x: 5, y: 7 }
], [
  { ref: 'object/2/arrow.run', dx: 1, dy: 2 }
]);
const doc = parse(next) as {
  object: [
    { ball: { x: number; y: number } },
    { cone: { x: number; y: number } },
    { 'arrow.run': { p: { x: number; y: number }; to: { x: number; y: number }; via: { x: number; y: number }[] } }
  ];
};
assert.equal(doc.object[0].ball.x, 2);
assert.equal(doc.object[0].ball.y, 4);
assert.equal(doc.object[1].cone.x, 5);
assert.equal(doc.object[1].cone.y, 7);
const arrow = doc.object[2]['arrow.run'];
assert.deepEqual(arrow.p, { x: 1, y: 2 });
assert.deepEqual(arrow.to, { x: 4, y: 2 });
assert.deepEqual(arrow.via[0], { x: 2, y: 3 });

console.log('edit move ok');
