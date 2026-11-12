import assert from 'node:assert/strict';
import { attrOf, graphicTags, insertTrackPoint, moveTrackPoint, removeTrackPoint, trackAnchors } from './svgEdit';

const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.4 4.4 0.8">
  <defs>
    <marker id="filled" viewBox="0 0 10 8">
      <path d="M 0 0.8 L 10 4 L 0 7.2 Z"/>
    </marker>
  </defs>
  <path data-track="1" marker-end="url(#filled)" d="M 0 0 L 4 0"/>
</svg>
`;
const index = graphicTags(source).findIndex(tag => source.slice(tag.start, tag.openEnd).includes('data-track'));
assert.ok(index >= 0);

let next = insertTrackPoint(source, index, 1, 2, 0.4);
let anchors = trackAnchors(attrOf(next, index, 'd'));
assert.equal(anchors.length, 3);
assert.equal(anchors[1].x, 2);
assert.equal(anchors[1].y, 0.4);
assert.match(attrOf(next, index, 'd'), /^M 0 0 C /);
assert.match(next, /data-track="1"/);
assert.match(next, /marker-end="url\(#filled\)"/);

next = moveTrackPoint(next, index, 1, 2, 0.8);
anchors = trackAnchors(attrOf(next, index, 'd'));
assert.equal(anchors[1].y, 0.8);
assert.equal(anchors[0].x, 0);
assert.equal(anchors[2].x, 4);

next = removeTrackPoint(next, index, 1);
assert.equal(attrOf(next, index, 'd'), 'M 0 0 L 4 0');
assert.equal(removeTrackPoint(next, index, 0), next);

console.log('svg track ok');
