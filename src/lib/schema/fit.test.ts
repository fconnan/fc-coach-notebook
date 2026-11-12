import assert from 'node:assert/strict';
import { fitMode, ratioBox } from './fit';
import { drawSvg } from './svgShape';

assert.equal(fitMode(undefined), 'none');
assert.equal(fitMode(''), 'none');
assert.equal(fitMode('ratio'), 'ratio');
assert.equal(fitMode('étirable'), 'ratio');
assert.equal(fitMode('free'), 'free');
assert.equal(fitMode('déformable'), 'free');
assert.equal(fitMode('none', 'free'), 'none');
assert.equal(fitMode('autre', 'ratio'), 'ratio');

const side = ratioBox({ minX: 0, minY: 0, maxX: 2, maxY: 1 }, 'e', { x: 4, y: 0 });
assert.equal(side.minX, 0);
assert.equal(side.maxX, 4);
assert.equal(side.maxY - side.minY, 2);
assert.ok(Math.abs((side.minY + side.maxY) / 2 - 0.5) < 1e-9);

const corner = ratioBox({ minX: 0, minY: 0, maxX: 2, maxY: 2 }, 'se', { x: 4, y: -2 });
assert.deepEqual(corner, { minX: 0, maxX: 4, minY: -2, maxY: 2 });

const identity = (x: number, y: number): [number, number] => [x, y];
const rect = drawSvg('rect', { x: 0, y: 0, width: 1, height: 1, fit: 'free' }, identity, 'object/0/rect');
assert.ok(rect?.markup.includes('data-fit="free"'));
assert.equal(rect?.markup.includes(' fit='), false);

const plain = drawSvg('rect', { x: 0, y: 0, width: 1, height: 1 }, identity, 'object/1/rect');
assert.equal(plain?.markup.includes('data-fit'), false);

const circle = drawSvg('circle', { cx: 0, cy: 0, r: 1, fit: 'free' }, identity, 'object/2/circle');
assert.ok(circle?.markup.includes('data-fit="ratio"'));

console.log('fit ok');
