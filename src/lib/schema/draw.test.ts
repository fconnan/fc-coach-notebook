import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { curvePath } from '../trajectory';
import { pathAnchors, pathKind, setPathKind } from '../editor/pathEdit';
import { insertShape } from './assist';
import { paintShape, readShape, removeItem, removeItems, retagShape, shapeColor, writeShape } from './edit';
import { formatSchema } from './format';
import { fitShape, moveShapeKnot, rotateShape, translateShape } from '../editor/shapeModel';

const source = 'version: fccn-schema:1\nitems:\n  - { ball: { x: 0, y: 0 } }\n';
const next = insertShape(source, 'circle', [], { x: 1, y: 2 });
const doc = parse(next) as {
  items: [{ ball: { x: number; y: number } }, { circle: { x: number; y: number; r: number; fill: string; cx?: number } }];
};
assert.equal(doc.items[0].ball.x, 0);
assert.equal(doc.items[1].circle.x, 1);
assert.equal(doc.items[1].circle.y, 2);
assert.equal(doc.items[1].circle.cx, undefined);
assert.equal(doc.items[1].circle.r, 0.6);
assert.equal(doc.items[1].circle.fill, '#f59e0b');
assert.match(next, /ball: \{ x: 0, y: 0 \}/);
assert.equal(next.includes('object:'), false);

const painted = paintShape(next, 'items/1/circle', 'fill', '#112233');
assert.equal(shapeColor(painted, 'items/1/circle', 'fill'), '#112233');
assert.match(painted, /ball: \{ x: 0, y: 0 \}/);
assert.equal(paintShape(painted, 'items/0/ball', 'fill', '#112233'), painted);

const rect = insertShape(source, 'rect', [], { x: -1, y: 0 });
const box = parse(rect) as { items: [unknown, { rect: { x: number; y: number; width: number; height: number } }] };
assert.equal(box.items[1].rect.x, -1);
assert.equal(box.items[1].rect.y, 0);
assert.equal(box.items[1].rect.width, 1.2);
assert.equal(box.items[1].rect.height, 0.84);
const wideView = insertShape(source, 'circle', [], { x: 0, y: 0, span: 100 });
const grownCircle = parse(wideView) as { items: [unknown, { circle: { x: number; y: number; r: number } }] };
assert.equal(grownCircle.items[1].circle.x, 0);
assert.equal(grownCircle.items[1].circle.y, 0);
assert.equal(grownCircle.items[1].circle.r, 6);

const kept = removeItem(painted, 'items/1/circle');
const after = parse(kept) as { items: { ball?: { x: number } }[] };
assert.equal(after.items.length, 1);
assert.equal(after.items[0].ball?.x, 0);

const cleared = removeItem(source, 'items/0/ball');
assert.equal(cleared.includes('object:'), false);
assert.equal((parse(cleared) as { object?: unknown }).object, undefined);
assert.match(cleared, /^version: fccn-schema:1\n?$/);

const beside = 'version: fccn-schema:1\nitems:\n  - ball: { x: 0, y: 0 }\n  - pitch: rect\n';
const clearedBeside = removeItem(beside, 'items/0/ball');
assert.equal(clearedBeside.includes('object:'), false);
assert.match(clearedBeside, /pitch: rect/);
assert.equal((parse(clearedBeside) as { items: { pitch?: string }[] }).items[0].pitch, 'rect');

const flow = 'version: fccn-schema:1\nitems: [{ ball: { x: 1, y: 2 } }]\n';
const clearedFlow = removeItem(flow, 'items/0/ball');
assert.equal(clearedFlow.includes('object:'), false);
assert.equal((parse(clearedFlow) as { object?: unknown }).object, undefined);

const trio = `${source}  - { circle: { cx: 0, cy: 0, r: 1 } }\n  - { rect: { x: 2, y: 2, width: 1, height: 1 } }\n`;
const dropped = removeItems(trio, ['items/0/ball', 'items/2/rect']);
const left = parse(dropped) as { items: { circle?: { r: number } }[] };
assert.equal(left.items.length, 1);
assert.equal(left.items[0].circle?.r, 1);
const none = removeItems(trio, ['items/0/ball', 'items/1/circle', 'items/2/rect']);
assert.equal(none.includes('object:'), false);
assert.equal((parse(none) as { object?: unknown }).object, undefined);
assert.throws(() => insertShape(source, 'text', []), /forme inconnue/);

const onlyItems = 'version: fccn-schema:1\nitems:\n  - ball: { x: 0, y: 0 }\n';
const clearedItems = removeItem(onlyItems, 'items/0/ball');
assert.equal(clearedItems.includes('items:'), false);
assert.equal((parse(clearedItems) as { items?: unknown }).items, undefined);

const formatted = formatSchema(`version: fccn-schema:1
items:
  - { ball: { x: 0.318, y: 0.24 } }
  - player: { name: 1, team: blue, x: -0.073, y: -0.02 }
  - { rect: { x: -0.6, y: -0.42, width: 1.2, height: 0.84, fill: "#f59e0b", stroke: "#b45309", stroke-width: 0.04 } }
  - { arrow.run: { p: { x: 1, y: 2 }, to: { x: 4, y: 2 } } }
  - { player: { name: 8, team: blue, p: { x: 3, y: 13.2 } } }
`);
assert.match(formatted, /^items:/m);
assert.match(formatted, /- ball: \{ x: 0\.318, y: 0\.24 \}/);
assert.match(formatted, /- player: \{ name: 1, team: blue/);
assert.match(formatted, /- rect: \{/);
assert.match(formatted, /- run: \{ p: \{ x: 1, y: 2 \}, to: \{ x: 4, y: 2 \} \}/);
assert.match(formatted, /- player: \{ name: 8, team: blue, p: \{ x: 3, y: 13\.2 \} \}/);
assert.equal(formatted.includes('object:'), false);
assert.equal(formatted.includes('arrow.run'), false);
assert.equal(formatSchema(formatted), formatted);

const curved = insertShape(source, 'path', [], { x: 0, y: 0 });
const pathItem = parse(curved) as { items: [unknown, { path: { d: string; curve: string } }] };
assert.equal(pathItem.items[1].path.curve, 'smooth');
assert.equal(pathKind(pathItem.items[1].path.d, 'smooth'), 'smooth');
assert.match(pathItem.items[1].path.d, / C /);
assert.equal(pathAnchors(pathItem.items[1].path.d).length, 3);
assert.match(setPathKind(pathItem.items[1].path.d, 'line'), / L /);
assert.equal(pathItem.items[1].path.d, curvePath(pathAnchors(pathItem.items[1].path.d)));

const moved = translateShape('rect', { x: '0', y: '0', width: '2', height: '1' }, 0.5, -0.25);
assert.equal(moved.x, '0.5');
assert.equal(moved.y, '-0.25');
assert.equal(moved.width, '2');
const stretched = moveShapeKnot('rect', moved, 2, 3, 2);
assert.equal(stretched.width, '2.5');
assert.equal(stretched.height, '2.25');
const turned = rotateShape('rect', stretched, 90);
assert.match(turned.transform || '', /^rotate\(90 /);

const written = writeShape(next, 'items/1/circle', { ...readShape(next, 'items/1/circle')!.attrs, cx: '1.5', cy: '2' });
assert.equal(readShape(written, 'items/1/circle')?.attrs.cx, '1.5');
assert.match(written, /x: 1\.5/);
assert.equal(written.includes('cx:'), false);
assert.match(written, /ball: \{ x: 0, y: 0 \}/);
const roundTrip = readShape(rect, 'items/1/rect')!.attrs;
assert.equal(roundTrip.x, '-1.6');
assert.equal(roundTrip.y, '-0.42');
const restored = parse(writeShape(rect, 'items/1/rect', roundTrip)) as { items: [unknown, { rect: { x: number; y: number } }] };
assert.equal(restored.items[1].rect.x, -1);
assert.equal(restored.items[1].rect.y, 0);

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
const turnedBox = rotateShape('rect', { x: '0', y: '0', width: '2', height: '1' }, 90);
const along = fitShape('rect', turnedBox, 0, 0.5, 2, 1);
assert.equal(along.attrs.width, '4');
assert.equal(along.attrs.height, '1');
assert.equal(along.attrs.x, '-1');
assert.equal(along.attrs.y, '1');
assert.equal(along.attrs.transform, 'rotate(90 1 1.5)');

const retagged = retagShape('version: fccn-schema:1\nitems:\n  - circle: { cx: 0, cy: 0, r: 1, fill: "#fff" }\n', 'items/0/circle', 'ellipse', wide.attrs);
assert.equal(retagged.ref, 'items/0/ellipse');
assert.match(retagged.source, /ellipse:/);
assert.equal(retagged.source.includes('r:'), false);
assert.equal((parse(retagged.source) as { items: { ellipse: { rx: number; fill: string } }[] }).items[0].ellipse.fill, '#fff');

console.log('draw ok');
