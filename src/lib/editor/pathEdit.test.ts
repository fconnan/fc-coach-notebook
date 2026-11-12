import assert from 'node:assert/strict';
import { curvePath } from '../trajectory';
import { insertAnchor, moveAnchor, pathAnchors, pathKind, removeAnchor, setPathKind } from './pathEdit';

const arc = curvePath([{ x: 0, y: 0 }, { x: 1, y: 0.6 }, { x: 2, y: 0 }]);
assert.equal(pathKind(arc), 'smooth');
assert.equal(pathAnchors(arc).length, 3);

const withPoint = insertAnchor(arc, 'smooth', 2, 1.5, 0.2);
assert.equal(pathAnchors(withPoint).length, 4);
assert.match(withPoint, / C /);
assert.equal(pathAnchors(withPoint)[0].x, 0);
assert.equal(pathAnchors(withPoint)[3].x, 2);

const lined = setPathKind(withPoint, 'line');
assert.equal(pathKind(lined, 'line'), 'line');
assert.match(lined, / L /);
assert.doesNotMatch(lined, / C /);

const moved = moveAnchor(lined, 'line', 1, 1, 1);
assert.equal(pathAnchors(moved)[1].y, 1);
assert.equal(pathAnchors(moved)[2].x, 1.5);

const shorter = removeAnchor(moved, 'line', 1);
assert.equal(pathAnchors(shorter).length, 3);
const trimmed = removeAnchor(shorter, 'line', 0);
assert.equal(pathAnchors(trimmed).length, 2);
assert.equal(pathAnchors(removeAnchor(trimmed, 'line', 0)).length, 2);

const freed = setPathKind(arc, 'free');
assert.equal(freed, arc);
const split = insertAnchor(arc, 'free', 1, 1, 0.4);
assert.equal(pathAnchors(split).length, 4);
assert.equal(pathAnchors(split)[0].x, 0);
assert.equal(pathAnchors(split)[3].x, 2);

console.log('path edit ok');
