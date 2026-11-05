import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutAxis, parseStretch, stretchSvg } from './stretch';
import { readSvg } from './svg';

const ladder = readSvg(readFileSync(new URL('../../../data/elements/objects/object.ladder.svg', import.meta.url), 'utf8'));
const asset = { markup: ladder.markup, viewBox: ladder.viewBox, stretch: ladder.stretch };

function lines(markup: string): number[] {
  return [...markup.matchAll(/<line\b[^>]*\bx1="([^"]+)"/g)].map(match => Number(match[1]));
}

const bands = parseStretch('fixed -1.75 repeat(0.5) 1.75 fixed', -2.15, 2.15);
assert.equal(bands?.length, 3);
assert.equal(bands?.[1].mode, 'repeat');
assert.equal(bands?.[1].step, 0.5);

const native = stretchSvg(asset, 4.3, 0.64);
assert.deepEqual(lines(native.markup), [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]);
assert.match(native.markup, /stroke-width="0.05"/);
assert.match(native.markup, /stroke-width="0.035"/);
assert.doesNotMatch(native.markup, /transform="scale/);

const long = stretchSvg(asset, 8.6, 0.64);
assert.equal(lines(long.markup).length, 16);
assert.match(long.markup, /stroke-width="0.05"/);
const rect = /<rect\b([^>]*?)\/>/.exec(long.markup);
assert.ok(rect);
const x = Number(/x="([^"]+)"/.exec(rect[1])?.[1]);
const width = Number(/width="([^"]+)"/.exec(rect[1])?.[1]);
assert.ok(Math.abs(x - -4.15) < 0.001, `x ${x}`);
assert.ok(Math.abs(width - 8.3) < 0.001, `width ${width}`);

const wide = stretchSvg(asset, 4.3, 1.2);
assert.match(wide.markup, /stroke-width="0.05"/);
assert.match(wide.markup, /y1="-0.4125"/);

const tiny = stretchSvg(asset, 1.2, 0.64);
assert.match(tiny.markup, /transform="scale\(/);
assert.equal(lines(tiny.markup).length, 1);

const plain = stretchSvg({ markup: '<circle r="1"/>', viewBox: '-1 -1 2 2' }, 4, 4);
assert.match(plain.markup, /scale\(2\)/);

const yFixed = layoutAxis('fixed', -0.55, 0.55, 1.1);
assert.equal(yFixed.uniform, false);
assert.ok(Math.abs(yFixed.map(0.36) - 0.36) < 0.001);

const wave = stretchSvg({
  markup: '<polygon points="3,-0.32 4,0 3,0.32"/><g data-repeat="x"><path d="M 0 0 Q 0.25 0.36 0.5 0 T 1 0"/></g>',
  viewBox: '0 -0.55 4 1.1',
  stretch: { x: 'repeat(1) 3 fixed', y: 'fixed' }
}, 10, 1.1);
assert.equal(wave.markup.match(/<path\b/g)?.length, 9);
assert.match(wave.markup, /points="9,-0.32 10,0 9,0.32"/);

console.log('stretch ok');
