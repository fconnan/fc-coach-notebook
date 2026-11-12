import assert from 'node:assert/strict';
import { generateTrajectory, TrajectoryError, type Point } from './index';
import { motifOf } from './motif';

function near(a: number, b: number, tol = 0.05): void {
  assert.ok(Math.abs(a - b) < tol, `${a} !~ ${b}`);
}

function endAt(start: Point, end: Point): void {
  const path = generateTrajectory({ start, end });
  const tip = path.pointAt(1);
  near(tip.x, end.x);
  near(tip.y, end.y);
  near(path.startTangent.x, path.endTangent.x, 0.02);
}

function closest(path: { pointAt(fraction: number): Point }, spot: Point): number {
  let best = Infinity;
  for (let i = 0; i <= 400; i += 1) {
    const at = path.pointAt(i / 400);
    best = Math.min(best, Math.hypot(at.x - spot.x, at.y - spot.y));
  }
  return best;
}

endAt({ x: 0, y: 0 }, { x: 10, y: 0 });
endAt({ x: 0, y: 0 }, { x: 0, y: 10 });
endAt({ x: 1, y: 2 }, { x: 7, y: 9 });

const straight = generateTrajectory({ start: { x: 1, y: 2 }, end: { x: 9, y: 2 } });
assert.match(straight.d, /^M 1 2 L 9 2$/);
assert.equal(straight.line, straight.d);
near(straight.pointAt(0.5).x, 5);
near(straight.pointAt(0.5).y, 2);

const curved = generateTrajectory({
  start: { x: 0, y: 0 },
  end: { x: 10, y: 0 },
  via: [{ x: 4, y: 3 }, { x: 7, y: -2 }]
});
assert.ok(curved.length > 10);
near(curved.pointAt(1).x, 10);
near(curved.pointAt(1).y, 0);
assert.ok(closest(curved, { x: 4, y: 3 }) < 0.08, `passe à côté de 4,3 (${closest(curved, { x: 4, y: 3 })})`);
assert.ok(closest(curved, { x: 7, y: -2 }) < 0.08);
assert.match(curved.line, /4 3/);
assert.match(curved.line, /7 -2/);
assert.match(curved.d, /^M 0 0 C /);

const up = generateTrajectory({
  start: { x: 0, y: 0 },
  end: { x: 0, y: 10 },
  via: [{ x: -2, y: 5 }]
});
assert.ok(closest(up, { x: -2, y: 5 }) < 0.08);
near(up.pointAt(1).x, 0);
near(up.pointAt(1).y, 10);

const flat = generateTrajectory({
  start: { x: 0, y: 0 }, end: { x: 8, y: 0 }, motif: 'sine', amp: 0, wave: 2
});
assert.match(flat.d, /^M 0 0 L 8 0$/);

for (const length of [10, 20, 30]) {
  const wave = motifOf('sine', length, 1, 3, 0, 1, 0, 0);
  assert.ok(wave);
  near(wave.at(0.75), 1, 0.001);
  near(wave.at(0.75 + 6), 1, 0.001);
  near(wave.at(length / 2), Math.sin((2 * Math.PI * (length / 2)) / 3), 0.001);
}

const ended = motifOf('sine', 10, 1, 2, 0, 1, 0.6, 1.2);
assert.ok(ended);
near(ended.at(0), 0, 0.001);
near(ended.at(10), 0, 0.001);
near(ended.at(9.5), 0, 0.001);
assert.ok(Math.abs(ended.at(0.5)) > 0.5);

const zag = motifOf('zigzag', 8, 1, 2, 0, 1, 0, 0);
assert.ok(zag);
near(zag.at(1), 1, 0.001);
near(zag.at(2), -1, 0.001);

const wavy = generateTrajectory({
  start: { x: 0, y: 0 },
  end: { x: 12, y: 0 },
  motif: 'sine',
  amp: 0.4,
  wave: 2,
  taper: 0.5,
  neck: 1
});
near(wavy.pointAt(1).x, 12);
near(wavy.pointAt(1).y, 0);
near(wavy.endTangent.y, 0, 0.02);
assert.match(wavy.d, /^M /);

const short = generateTrajectory({
  start: { x: 0, y: 0 }, end: { x: 0.4, y: 0 }, motif: 'sine', amp: 0.1, wave: 2
});
assert.ok(short.d.startsWith('M'));
near(short.pointAt(1).x, 0.4);

const diagonal = generateTrajectory({
  start: { x: 0, y: 0 },
  end: { x: 6, y: 8 },
  via: [{ x: 2, y: 6 }],
  motif: 'zigzag',
  amp: 0.3,
  wave: 1.5
});
near(diagonal.pointAt(1).x, 6);
near(diagonal.pointAt(1).y, 8);
assert.ok(closest(diagonal, { x: 2, y: 6 }) < 0.08);
assert.notEqual(diagonal.d, diagonal.line);
assert.match(diagonal.line, /2 6/);

assert.equal(generateTrajectory({ start: { x: 1, y: 1 }, end: { x: 1, y: 1 } }).d, '');
assert.throws(() => generateTrajectory({
  start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, motif: 'sine', amp: 1, wave: 0
}), TrajectoryError);

console.log('trajectory ok');
