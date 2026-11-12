import assert from 'node:assert/strict';
import { elementScene } from './scene';
import { drawSvg } from './svgShape';
import type { SchemaDoc } from './types';

const same = (x: number, y: number): [number, number] => [x, y];
const circle = drawSvg('circle', { cx: 1, cy: 2, r: 0.5, fill: '#fff', 'stroke-width': 0.08, marker: 'url(#arrow)' }, same);
assert.ok(circle);
assert.match(circle.markup, /<circle [^>]*cx="1"/);
assert.match(circle.markup, /cy="2"/);
assert.match(circle.markup, /r="0.5"/);
assert.match(circle.markup, /fill="#fff"/);
assert.match(circle.markup, /stroke-width="0.08"/);
assert.doesNotMatch(circle.markup, /marker/);
assert.equal(circle.box.minX, 0.5 - 0.04);
assert.equal(circle.box.maxY, 2.5 + 0.04);

const path = drawSvg('path', { d: 'M0 0 L2 1', fill: 'none', stroke: '#111' }, (x, y) => [x + 3, y - 1]);
assert.ok(path);
assert.match(path.markup, /matrix\(1 0 0 1 3 -1\)/);
assert.match(path.markup, /d="M0 0 L2 1"/);
assert.equal(path.box.minX, 3);
assert.equal(path.box.maxX, 5);
assert.equal(path.box.minY, -1);
assert.equal(path.box.maxY, 0);

assert.equal(drawSvg('defs', { d: 'M0 0' }, same), null);
assert.equal(drawSvg('circle', { r: 1, fill: 'url(#ball)' }, same), null);
assert.equal(drawSvg('rect', { x: 0, y: 0, width: 2, height: 1, marker: 'mid' }, same)?.markup.includes('marker'), false);

const doc = {
  id: 'sample.temp',
  type: 'sample',
  object: [
    { circle: { cx: 1, cy: 2, r: 0.5, fill: '#ffffff', stroke: '#111111', 'stroke-width': 0.04 } },
    { rect: { x: -2, y: 0, width: 1, height: 0.5, fill: 'none' } },
    { path: { d: 'M0 0 H3', fill: 'none', stroke: '#fff' } }
  ]
} as unknown as SchemaDoc;
const svg = elementScene(doc, new Map(), 0, 0, true);
assert.match(svg, /data-pick="object\/0\/circle"/);
assert.match(svg, /<circle [^>]*r="0.5"/);
assert.match(svg, /data-pick="object\/1\/rect"/);
assert.match(svg, /<path [^>]*d="M0 0 H3"/);
assert.doesNotMatch(svg, /<defs|<marker/);

console.log('svg shape ok');
