import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { folderEntries, insertElement } from './assist';
import type { LibraryEntry } from './types';

const source = 'version: fccn-schema:1\n';
const ball: LibraryEntry = {
  id: 'object.ball',
  name: 'ball',
  type: 'object',
  dir: 'elements/objects',
  file: 'object.ball.yaml',
  doc: {},
  svgs: []
};

const next = insertElement(source, ball, []);
const doc = parse(next) as { items: Array<{ ball: { x: number; y: number } }> };
assert.equal(doc.items.length, 1);
assert.equal(typeof doc.items[0].ball.x, 'number');
assert.equal(typeof doc.items[0].ball.y, 'number');
assert.match(next, /^items:\n  - ball: /m);

const again = insertElement(next, ball, []);
const both = parse(again) as { items: unknown[] };
assert.equal(both.items.length, 2);

const placed = parse(next) as { pitch?: string; items: Array<{ ball: { x: number; y: number } }> };
assert.equal(placed.pitch, undefined);
assert.equal(placed.items[0].ball.y, 0);

const seen = parse(insertElement(source, ball, [], { x: -2, y: 2 })) as {
  items: Array<{ ball: { x: number; y: number } }>;
};
assert.equal(seen.items[0].ball.x, -2);
assert.equal(seen.items[0].ball.y, 2);

const pitch: LibraryEntry = {
  id: 'pitch.rect',
  name: 'rect',
  type: 'pitch',
  dir: 'elements/pitches',
  file: 'pitch.rect.yaml',
  doc: { width: 20, length: 20 },
  svgs: []
};
const onRect = parse(insertElement('version: fccn-schema:1\nitems:\n  - pitch: rect\n', ball, [pitch])) as {
  items: Array<{ pitch?: string; ball?: { x: number; y: number } }>;
};
assert.equal(onRect.items[0].pitch, 'rect');
assert.equal(onRect.items[1].ball?.x, 8.5);
assert.equal(onRect.items[1].ball?.y, 10);

const field = parse(insertElement(source, pitch, [])) as { pitch?: string; items: Array<{ pitch: string }> };
assert.equal(field.pitch, undefined);
assert.equal(field.items[0].pitch, 'rect');

const offered = folderEntries([
  { id: 'player', name: 'player', type: 'player', dir: 'elements/players', file: 'player.yaml', doc: { listed: false }, svgs: [] },
  { id: 'player.blue', name: 'blue', type: 'player', dir: 'elements/players', file: 'player.blue.yaml', doc: {}, svgs: [] }
], 'elements/players');
assert.deepEqual(offered.map(entry => entry.name), ['blue']);

console.log('assist insert ok');
