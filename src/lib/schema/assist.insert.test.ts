import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { insertElement } from './assist';
import type { LibraryEntry } from './types';

const source = 'version: fccn-schema:1\n';
const ball: LibraryEntry = {
  id: 'object.ball',
  name: 'ball',
  type: 'object',
  dir: 'elements/objects',
  file: 'object.ball.svg',
  doc: {},
  svgs: []
};

const next = insertElement(source, ball, []);
const doc = parse(next) as { object: Array<{ ball: { x: number; y: number } }> };
assert.equal(doc.object.length, 1);
assert.equal(typeof doc.object[0].ball.x, 'number');
assert.equal(typeof doc.object[0].ball.y, 'number');

const again = insertElement(next, ball, []);
const both = parse(again) as { object: unknown[] };
assert.equal(both.object.length, 2);

const placed = parse(next) as { pitch?: string; object: Array<{ ball: { x: number; y: number } }> };
assert.equal(placed.pitch, undefined);
assert.equal(placed.object[0].ball.y, 0);

const seen = parse(insertElement(source, ball, [], { x: -2, y: 2 })) as {
  object: Array<{ ball: { x: number; y: number } }>;
};
assert.equal(seen.object[0].ball.x, -2);
assert.equal(seen.object[0].ball.y, 2);

const pitch: LibraryEntry = {
  id: 'pitch.rect',
  name: 'rect',
  type: 'pitch',
  dir: 'elements/pitches',
  file: 'pitch.rect.yaml',
  doc: { width: 20, length: 20 },
  svgs: []
};
const onRect = parse(insertElement('version: fccn-schema:1\npitch: rect\n', ball, [pitch])) as {
  object: Array<{ ball: { x: number; y: number } }>;
};
assert.equal(onRect.object[0].ball.x, 5.5);
assert.equal(onRect.object[0].ball.y, 10);

console.log('assist insert ok');
