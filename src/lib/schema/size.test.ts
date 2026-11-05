import assert from 'node:assert/strict';
import { glyphFactor, parseShare, realExtent, resolveMin } from './size';

assert.equal(parseShare('3.5%'), 0.035);
assert.equal(parseShare(0), 0);
assert.equal(parseShare('0'), 0);
assert.equal(parseShare(4), 0.04);

const sizes = { scale: 1.2, player: '4%', cone: 0 };
assert.equal(resolveMin(sizes, 'object.player', 0.035, undefined), 0.04 * 1.2);
assert.equal(resolveMin(sizes, 'object.cone', 0.02, undefined), undefined);
assert.equal(resolveMin(sizes, 'object.cone', 0.02, '5%'), 0.05 * 1.2);
assert.equal(resolveMin(sizes, 'object.player', 0.035, 0), undefined);
assert.equal(resolveMin({ scale: 0 }, 'object.player', 0.035, undefined), undefined);
assert.equal(resolveMin(undefined, 'object.disc', 0.02, undefined), 0.02);

assert.equal(glyphFactor(0.8, undefined, 105), 1);
assert.equal(glyphFactor(0.8, 0.035, 12), 1);
assert.ok(Math.abs(glyphFactor(0.8, 0.035, 105) - (0.035 * 105) / 0.8) < 1e-9);
assert.equal(glyphFactor(0.8, undefined, 105), 1);

const player = realExtent({ realW: 0.8, min: 0.035 }, { w: 2.8, h: 2.8 });
assert.ok(Math.abs(player.w - 0.8) < 1e-9);
assert.ok(Math.abs(player.ux - 0.8 / 2.8) < 1e-9);
const meters = realExtent(undefined, { w: 4.3, h: 0.64 });
assert.equal(meters.ux, 1);
assert.equal(meters.w, 4.3);

console.log('size ok');
