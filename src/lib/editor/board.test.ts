import assert from 'node:assert/strict';
import { fileFrame, fitCamera, fitExtent, formatMeter, limitPan, schemaFrame, showsSolid, svgPoint, viewOf, wheelPixels, worldPoint } from './board';

const schema = schemaFrame({
  hasAttribute: () => true,
  dataset: { left: '2', top: '3', length: '10' }
} as unknown as SVGSVGElement);
assert.ok(schema);
assert.deepEqual(svgPoint(schema, 4, 6), { x: 6, y: 7 });
assert.deepEqual(worldPoint(schema, 6, 7), { x: 4, y: 6 });

const camera = { worldX: 4, worldY: 6, ppm: 10 };
const box = viewOf(schema, camera, 100, 80);
assert.equal(box.width, 10);
assert.equal(box.height, 8);
assert.equal(box.x, 1);
assert.equal(box.y, 3);

const file = fileFrame({
  getAttribute(name: string) {
    if (name === 'data-frame') return '-100 -100 200 200';
    if (name === 'data-real-w') return '0.22';
    return null;
  }
} as SVGSVGElement);
assert.ok(file);
assert.deepEqual(worldPoint(file, 0, 0), { x: 0, y: 0 });
assert.ok(Math.abs(worldPoint(file, 100, 0).x - 0.11) < 1e-9);
assert.ok(Math.abs(worldPoint(file, 0, -100).y - 0.11) < 1e-9);

const fitted = fitCamera(file, { x: -110, y: -110, width: 220, height: 220 }, 400, 400);
assert.ok(Math.abs(fitted.worldX) < 1e-9);
assert.ok(Math.abs(fitted.worldY) < 1e-9);

const tight = fitExtent(schema, { minX: 0, minY: 0, maxX: 10, maxY: 4 }, 200, 100, 0);
assert.ok(tight);
assert.ok(Math.abs(tight.worldX - 5) < 1e-9);
assert.ok(Math.abs(tight.worldY - 2) < 1e-9);
assert.ok(Math.abs(tight.ppm - 20) < 1e-9);
const shown = viewOf(schema, tight, 200, 100);
assert.ok(Math.abs(shown.width - 10) < 1e-9);
assert.ok(Math.abs(shown.height - 5) < 1e-9);

const field = [{ kind: 'box' as const, minX: 0, minY: 0, maxX: 10, maxY: 6 }];
const kept = limitPan({ worldX: 5, worldY: 3, ppm: 10 }, { worldX: 100, worldY: -40, ppm: 10 }, 100, 80, field, 0.5);
assert.ok(Math.abs(kept.worldX - 14.5) < 0.02);
assert.ok(Math.abs(kept.worldY - -1.3) < 0.02);
assert.equal(showsSolid(kept, 100, 80, field, 0.5), true);
assert.deepEqual(limitPan({ worldX: 4, worldY: 3, ppm: 10 }, { worldX: 4, worldY: 3, ppm: 10 }, 100, 80, field, 0.5), { worldX: 4, worldY: 3, ppm: 10 });
const disk = [{ kind: 'disk' as const, cx: 0, cy: 0, rx: 1, ry: 1 }];
const round = limitPan({ worldX: 0, worldY: 0, ppm: 10 }, { worldX: 30, worldY: 40, ppm: 10 }, 100, 80, disk, 0);
assert.ok(Math.abs(round.worldX - 3.75) < 0.05);
assert.ok(Math.abs(round.worldY - 5) < 0.05);
assert.equal(showsSolid(round, 100, 80, disk, 0), true);
assert.equal(showsSolid({ worldX: 6.2, worldY: 5.2, ppm: 10 }, 100, 80, disk, 0), false);

assert.equal(formatMeter(-0), '0');
assert.deepEqual(wheelPixels({ deltaX: 0, deltaY: 40, deltaMode: 0, shiftKey: true }, 100, 80), { x: 40, y: 0 });
assert.deepEqual(wheelPixels({ deltaX: 0, deltaY: 40, deltaMode: 0, shiftKey: false }, 100, 80), { x: 0, y: 40 });

console.log('board ok');
