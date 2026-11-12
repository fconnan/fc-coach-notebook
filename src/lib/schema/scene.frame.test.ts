import assert from 'node:assert/strict';
import { renderSvg } from './scene';
import type { Scene } from './types';

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
assert.match(svg, /class="fc-pitch"[^>]*width="20"/);

console.log('scene frame ok');
