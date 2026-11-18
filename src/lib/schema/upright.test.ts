import assert from 'node:assert/strict';
import path from 'node:path';
import { loadLibrary } from './library';
import { elementScene } from './scene';
import type { SchemaDoc } from './types';
import { partCenter, uprightMatrix, wrapUpright } from './upright';

type Mat = [number, number, number, number, number, number];

function mul(left: Mat, right: Mat): Mat {
  const [a1, b1, c1, d1, e1, f1] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}

function parseMatrix(value: string): Mat {
  const found = /matrix\(\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s*\)/.exec(value);
  assert.ok(found, value);
  return found.slice(1, 7).map(Number) as Mat;
}

function apply(matrix: Mat, x: number, y: number): [number, number] {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≈ ${expected}`);
}

/** S⁻¹ R(a) S C est l'identité : la rotation s'annule, l'échelle reste. */
function staysPut(angle: number, sx: number, sy: number, px: number, py: number) {
  const rad = (angle * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const rotation: Mat = [c, s, -s, c, 0, 0];
  const scale: Mat = [sx, 0, 0, sy, 0, 0];
  const correction = parseMatrix(uprightMatrix(angle, sx, sy, px, py));
  const combined = mul(rotation, mul(scale, correction));
  close(combined[0], sx);
  close(combined[1], 0);
  close(combined[2], 0);
  close(combined[3], sy);
  const placed = mul(rotation, scale);
  const origin = apply(placed, px, py);
  for (const [x, y] of [[px, py], [px + 1, py], [px, py + 0.4], [px - 0.2, py + 1]]) {
    const got = apply(combined, x, y);
    const delta = apply(scale, x - px, y - py);
    close(got[0], origin[0] + delta[0]);
    close(got[1], origin[1] + delta[1]);
  }
}

staysPut(90, 0.3, -0.3, 0, 0);
staysPut(90, 0.3, -0.5, 1.2, -0.4);
staysPut(-40.7, 0.25, -0.25, 0, 0.1);
staysPut(0, 2, -3, 4, 5);
assert.equal(uprightMatrix(0, 1, -1, 2, 3), 'matrix(1 0 0 1 0 0)');

const token = partCenter('text', 'y="0.38" font-size="1.1"');
close(token.x, 0);
close(token.y, 0.38 - 0.35 * 1.1);
const arms = partCenter('text', 'x="0" y="5" font-size="14"');
close(arms.x, 0);
close(arms.y, 5 - 0.35 * 14);
const pivot = partCenter('text', 'data-pivot="1 2" y="9" font-size="10"');
assert.deepEqual(pivot, { x: 1, y: 2 });
assert.deepEqual(partCenter('circle', 'cx="37" cy="34" r="13.5"'), { x: 37, y: 34 });
assert.deepEqual(partCenter('rect', 'x="1" y="2" width="4" height="6"'), { x: 3, y: 5 });

const wrapped = wrapUpright(
  '<circle id="body" r="1"/><text id="label" y="0.38" font-size="1.1">8</text>',
  ['label'],
  90,
  0.3,
  -0.5
);
assert.equal(wrapped.includes('id='), false);
assert.match(wrapped, /data-part="body"/);
assert.equal((wrapped.match(/data-upright="1"/g) || []).length, 1);
const holder = /<g data-upright="1"[^>]*>[\s\S]*<\/g>/.exec(wrapped);
assert.ok(holder);
assert.match(holder[0], /data-part="label"/);
assert.equal(holder[0].includes('data-part="body"'), false);
staysPut(90, 0.3, -0.5, 0, token.y);

const library = await loadLibrary(path.resolve('data'));
const loaded = new Map(library.map(entry => [entry.id, entry]));
const base = loaded.get('player');
const blue = loaded.get('player.blue');
assert.ok(base && blue);
assert.ok(base.svgs.length > 0 && base.svgs.every(item => item.upright?.[0] === 'label'));
assert.ok(blue.svgs.some(item => item.when.shape === 'arms' && item.upright?.[0] === 'label'));

const svg = elementScene({
  id: 'upright',
  type: 'sample',
  width: 40,
  length: 40,
  items: [
    { player: { name: 1, team: 'blue', x: 10, y: 12, angle: 90, shape: 'token' } },
    { 'player.blue': { name: 2, x: 20, y: 18, angle: 90, shape: 'arms' } }
  ]
} as SchemaDoc, loaded);
assert.equal((svg.match(/data-upright="1"/g) || []).length, 2);
assert.equal(svg.includes('id="label"'), false);
assert.equal((svg.match(/data-part="label"/g) || []).length, 2);
const literal = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
assert.match(svg, new RegExp(`transform="${literal(uprightMatrix(90, 1, -1, token.x, token.y))}"`));
assert.match(svg, new RegExp(`transform="${literal(uprightMatrix(90, 1, -1, arms.x, arms.y))}"`));

console.log('upright ok');
