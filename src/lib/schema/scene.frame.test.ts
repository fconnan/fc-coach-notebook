import assert from 'node:assert/strict';
import { elementScene, renderSvg } from './scene';
import type { LibraryEntry, Scene, SchemaDoc } from './types';

const scene: Scene = {
  width: 20,
  length: 20,
  margin: 1.5,
  lines: [],
  drawing: '',
  ink: '',
  inkBounds: [],
  zones: [],
  players: [],
  marks: [],
  arrows: [],
  ball: { x: 29.5, y: 52.5, svg: '', radius: 0.2 },
  phases: []
};

const svg = renderSvg(scene);
const box = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
assert.ok(box);
const width = Number(box[1]);
const height = Number(box[2]);
assert.ok(width > 29.5, `largeur ${width}`);
assert.ok(height > 52.5, `hauteur ${height}`);
assert.match(svg, /class="fc-pitch"[^>]*data-fixed="1"[^>]*width="20"/);

const rect: LibraryEntry = {
  id: 'pitch.rect',
  name: 'rect',
  type: 'pitch',
  dir: 'elements/pitches',
  file: 'pitch.rect.yaml',
  doc: { width: 20, length: 20, id: 'pitch.rect', type: 'pitch' },
  svgs: [{ when: {}, markup: '<rect width="100%" height="100%"/>', viewBox: '0 0 100 100', fixed: true }]
};
const drawn = elementScene(
  { id: 'sample.field', type: 'sample', items: [{ pitch: 'rect' }] } as SchemaDoc,
  new Map([[rect.id, rect]]),
  0,
  0,
  true
);
assert.match(drawn, /<svg[^>]*data-fixed="1"/);
assert.match(drawn, /class="fc-pitch"[^>]*data-fixed="1"/);
assert.equal(drawn.includes('data-pick="items/0/pitch"'), false);

const full: LibraryEntry = {
  id: 'pitch.full',
  name: 'full',
  type: 'pitch',
  dir: 'elements/pitches',
  file: 'pitch.full.yaml',
  doc: { width: 68, length: 105, margin: 2, origin: { x: 34, y: 52.5 }, id: 'pitch.full', type: 'pitch' },
  svgs: []
};
const ball: LibraryEntry = {
  id: 'object.ball',
  name: 'ball',
  type: 'object',
  dir: 'elements/objects',
  file: 'object.ball.yaml',
  doc: { id: 'object.ball', type: 'object' },
  svgs: []
};
const centered = elementScene(
  { id: 'sample.temp', type: 'sample', items: [{ ball: { x: 0.355, y: 0.436 } }, { pitch: 'full' }] } as SchemaDoc,
  new Map([[full.id, full], [ball.id, ball]]),
  0,
  0,
  true
);
assert.match(centered, /class="fc-pitch"[^>]*x="-34"[^>]*y="-52\.5"/);
assert.match(centered, /data-ball="1"[^>]*data-x="0\.355"/);
assert.match(centered, /translate\(0\.355 /);

console.log('scene frame ok');
