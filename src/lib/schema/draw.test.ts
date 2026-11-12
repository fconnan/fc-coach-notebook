import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { curvePath } from '../trajectory';
import { pathAnchors, pathKind, setPathKind } from '../editor/pathEdit';
import { insertShape } from './assist';
import { paintShape, readShape, removeItem, removeItems, retagShape, shapeColor, writeShape } from './edit';
import { fitShape, moveShapeKnot, rotateShape, translateShape } from '../editor/shapeModel';

const source = 'version: fccn-schema:1\nobject:\n  - { ball: { x: 0, y: 0 } }\n';
const next = insertShape(source, 'circle', [], { x: 1, y: 2 });
const doc = parse(next) as {
  object: [{ ball: { x: number; y: number } }, { circle: { cx: number; cy: number; r: number; fill: string } }];
};
assert.equal(doc.object[0].ball.x, 0);
assert.equal(doc.object[1].circle.cx, 1);
assert.equal(doc.object[1].circle.cy, 2);
assert.equal(doc.object[1].circle.r, 0.6);
assert.equal(doc.object[1].circle.fill, '#f59e0b');
assert.match(next, /ball: \{ x: 0, y: 0 \}/);

const painted = paintShape(next, 'object/1/circle', 'fill', '#112233');
assert.equal(shapeColor(painted, 'object/1/circle', 'fill'), '#112233');
assert.match(painted, /ball: \{ x: 0, y: 0 \}/);
assert.equal(paintShape(painted, 'object/0/ball', 'fill', '#112233'), painted);

const rect = insertShape(source, 'rect', [], { x: -1, y: 0 });
const box = parse(rect) as { object: [unknown, { rect: { x: number; width: number; height: number } }] };
assert.equal(box.object[1].rect.x, -1.6);
assert.equal(box.object[1].rect.width, 1.2);

const kept = removeItem(painted, 'object/1/circle');
const after = parse(kept) as { object: { ball?: { x: number } }[] };
assert.equal(after.object.length, 1);
assert.equal(after.object[0].ball?.x, 0);

const cleared = removeItem(source, 'object/0/ball');
assert.equal(cleared.includes('object:'), false);
assert.equal((parse(cleared) as { object?: unknown }).object, undefined);
assert.match(cleared, /^version: fccn-schema:1\n?$/);

const beside = 'version: fccn-schema:1\nobject:\n  - { ball: { x: 0, y: 0 } }\npitch: rect\n';
const clearedBeside = removeItem(beside, 'object/0/ball');
assert.equal(clearedBeside.includes('object:'), false);
assert.match(clearedBeside, /pitch: rect/);
assert.equal((parse(clearedBeside) as { object?: unknown; pitch?: string }).pitch, 'rect');

const flow = 'version: fccn-schema:1\nobject: [{ ball: { x: 1, y: 2 } }]\n';
const clearedFlow = removeItem(flow, 'object/0/ball');
assert.equal(clearedFlow.includes('object:'), false);
assert.equal((parse(clearedFlow) as { object?: unknown }).object, undefined);

const trio = `${source}  - { circle: { cx: 0, cy: 0, r: 1 } }\n  - { rect: { x: 2, y: 2, width: 1, height: 1 } }\n`;
const dropped = removeItems(trio, ['object/0/ball', 'object/2/rect']);
const left = parse(dropped) as { object: { circle?: { r: number } }[] };
assert.equal(left.object.length, 1);
assert.equal(left.object[0].circle?.r, 1);
const none = removeItems(trio, ['object/0/ball', 'object/1/circle', 'object/2/rect']);
assert.equal(none.includes('object:'), false);
assert.equal((parse(none) as { object?: unknown }).object, undefined);
assert.throws(() => insertShape(source, 'text', []), /forme inconnue/);

const curved = insertShape(source, 'path', [], { x: 0, y: 0 });
const pathItem = parse(curved) as { object: [unknown, { path: { d: string; curve: string } }] };
assert.equal(pathItem.object[1].path.curve, 'smooth');
assert.equal(pathKind(pathItem.object[1].path.d, 'smooth'), 'smooth');
assert.match(pathItem.object[1].path.d, / C /);
assert.equal(pathAnchors(pathItem.object[1].path.d).length, 3);
assert.match(setPathKind(pathItem.object[1].path.d, 'line'), / L /);
assert.equal(pathItem.object[1].path.d, curvePath(pathAnchors(pathItem.object[1].path.d)));

const moved = translateShape('rect', { x: '0', y: '0', width: '2', height: '1' }, 0.5, -0.25);
assert.equal(moved.x, '0.5');
assert.equal(moved.y, '-0.25');
assert.equal(moved.width, '2');
const stretched = moveShapeKnot('rect', moved, 2, 3, 2);
assert.equal(stretched.width, '2.5');
assert.equal(stretched.height, '2.25');
const turned = rotateShape('rect', stretched, 90);
assert.match(turned.transform || '', /^rotate\(90 /);

const written = writeShape(next, 'object/1/circle', { ...readShape(next, 'object/1/circle')!.attrs, cx: '1.5', cy: '2' });
assert.equal(readShape(written, 'object/1/circle')?.attrs.cx, '1.5');
assert.match(written, /ball: \{ x: 0, y: 0 \}/);

const wide = fitShape('circle', { cx: '0', cy: '0', r: '1', fill: '#fff' }, -1, -1, 2, 1);
assert.equal(wide.tag, 'ellipse');
assert.equal(wide.attrs.rx, '2');
assert.equal(wide.attrs.ry, '1');
assert.equal(wide.attrs.fill, '#fff');
assert.equal(wide.attrs.r, undefined);
const grown = fitShape('rect', { x: '0', y: '0', width: '2', height: '1' }, 0, 0, 1.5, 2);
assert.equal(grown.tag, 'rect');
assert.equal(grown.attrs.width, '3');
assert.equal(grown.attrs.height, '2');

const retagged = retagShape('version: fccn-schema:1\nobject:\n  - { circle: { cx: 0, cy: 0, r: 1, fill: "#fff" } }\n', 'object/0/circle', 'ellipse', wide.attrs);
assert.equal(retagged.ref, 'object/0/ellipse');
assert.match(retagged.source, /ellipse:/);
assert.equal(retagged.source.includes('r:'), false);
assert.equal((parse(retagged.source) as { object: { ellipse: { rx: number; fill: string } }[] }).object[0].ellipse.fill, '#fff');

console.log('draw ok');
