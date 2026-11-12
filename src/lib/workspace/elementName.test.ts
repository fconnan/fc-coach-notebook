import assert from 'node:assert/strict';
import { sharedElementPrefix, withElementPrefix } from './catalog';

assert.equal(sharedElementPrefix(['sample.zones.yaml', 'sample.trajectories.yaml']), 'sample');
assert.equal(sharedElementPrefix(['arrow.svg', 'arrow.dribble.yaml']), 'arrow');
assert.equal(sharedElementPrefix(['object.cone.svg', 'pitch.full.yaml']), '');
assert.equal(sharedElementPrefix([]), '');
assert.equal(withElementPrefix('test', ['sample.zones.yaml']), 'sample.test');
assert.equal(withElementPrefix('sample.autre', ['sample.zones.yaml']), 'sample.autre');
assert.equal(withElementPrefix('test', []), 'test');

console.log('element name ok');
