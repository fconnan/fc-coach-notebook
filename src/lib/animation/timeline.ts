import type { ComponentElement, Frame, Page, Position } from '$lib/stores/workspace';
import { contentBox } from '$lib/utils/fieldBounds';
import type { Projector } from '$lib/utils/projection';

const MIN_SEG = 0.15;

function segDur(frame: Frame): number {
  return Math.max(MIN_SEG, (frame.durationMs || 1000) / 1000);
}

export function totalSeconds(frames: Frame[]): number {
  let s = 0;
  for (let i = 0; i < frames.length - 1; i++) s += segDur(frames[i]);
  return s;
}

export function boundaries(frames: Frame[]): number[] {
  const b = [0];
  let acc = 0;
  for (let i = 0; i < frames.length - 1; i++) {
    acc += segDur(frames[i]);
    b.push(acc);
  }
  return b;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function lerpPos(a: Position, b: Position, t: number): Position {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function lerpAngle(a = 0, b = 0, t: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

function lerpElements(a: Frame, b: Frame, t: number): ComponentElement[] {
  const prev = new Map(a.elements.map(e => [e.id, e]));
  return b.elements.map(eb => {
    const ea = prev.get(eb.id);
    if (!ea) return eb;
    const out: ComponentElement = {
      ...eb,
      position: lerpPos(ea.position, eb.position, t),
      angle: lerpAngle(ea.angle, eb.angle, t)
    };
    if (ea.endPosition && eb.endPosition) out.endPosition = lerpPos(ea.endPosition, eb.endPosition, t);
    if (ea.pathPoints && eb.pathPoints && ea.pathPoints.length === eb.pathPoints.length) {
      out.pathPoints = eb.pathPoints.map((pt, i) => lerpPos(ea.pathPoints![i], pt, t));
    }
    return out;
  });
}

/** Pose and phase label at a document time, in seconds. */
export function sampleAt(frames: Frame[], time: number): { elements: ComponentElement[]; phase: string } {
  if (frames.length === 0) return { elements: [], phase: '' };
  if (frames.length === 1) return { elements: frames[0].elements, phase: frames[0].name };
  let acc = 0;
  for (let i = 0; i < frames.length - 1; i++) {
    const dur = segDur(frames[i]);
    const last = i === frames.length - 2;
    if (time < acc + dur || last) {
      const u = Math.min(1, Math.max(0, (time - acc) / dur));
      const phase = u >= 1 && last ? frames[i + 1].name : frames[i].name;
      return { elements: lerpElements(frames[i], frames[i + 1], u), phase };
    }
    acc += dur;
  }
  const last = frames[frames.length - 1];
  return { elements: last.elements, phase: last.name };
}

function r(n: number) { return Math.round(n * 10) / 10; }

function arrowPoints(el: ComponentElement): Position[] {
  if (el.pathPoints && el.pathPoints.length >= 2) return el.pathPoints;
  return [el.position, el.endPosition || { x: el.position.x + 40, y: el.position.y }];
}

function pathD(points: Position[], projector: Projector | null): string {
  const pts = projector ? projector.projectPoints(points) : points;
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r(p.x)} ${r(p.y)}`).join(' ');
}

function transformFor(el: ComponentElement, projector: Projector | null): string {
  const p = projector ? projector.projectGround(el.position.x, el.position.y) : null;
  const x = p ? p.x : el.position.x;
  const y = p ? p.y : el.position.y;
  const angle = el.angle || 0;
  if (el.type === 'ball') {
    return p ? `translate(${r(x)} ${r(y)}) scale(${r(p.scale)})` : `translate(${r(x)} ${r(y)})`;
  }
  if (el.type === 'player' || el.type === 'callout') return `translate(${r(x)} ${r(y)})`;
  if (el.type === 'text' || el.type === 'rect' || el.type === 'ellipse' || el.type === 'zone') {
    return `translate(${r(x)} ${r(y)}) rotate(${r(angle)})`;
  }
  return `translate(${r(x)} ${r(y)}) rotate(${r(angle)})`;
}

function keyTimes(frames: Frame[]): string {
  const total = totalSeconds(frames) || 1;
  const ts = [0];
  let acc = 0;
  for (let i = 0; i < frames.length - 1; i++) {
    acc += segDur(frames[i]);
    ts.push(acc / total);
  }
  return ts.map(t => Math.min(1, t).toFixed(4)).join(';');
}

function appendAnimate(node: Element, attributeName: string, values: string[], times: string, dur: number) {
  const doc = node.ownerDocument;
  const anim = doc.createElementNS('http://www.w3.org/2000/svg', 'animate');
  anim.setAttribute('attributeName', attributeName);
  anim.setAttribute('dur', `${dur}s`);
  anim.setAttribute('begin', '0s');
  anim.setAttribute('fill', 'freeze');
  anim.setAttribute('calcMode', 'linear');
  anim.setAttribute('keyTimes', times);
  anim.setAttribute('values', values.join(';'));
  node.appendChild(anim);
}

/**
 * Writes a SMIL timeline into a standalone SVG so it plays when opened alone.
 * The in-app transport does not use these nodes: it reads the same clock and samples `sampleAt`.
 */
export function injectSmil(svg: SVGSVGElement, page: Page) {
  const frames = page.frames;
  if (frames.length < 2) return;
  const dur = totalSeconds(frames);
  const times = keyTimes(frames);
  const projector = null;

  const ids = new Set<string>();
  for (const frame of frames) for (const el of frame.elements) ids.add(el.id);

  for (const id of ids) {
    const node = svg.querySelector(`[data-id="${id}"]`);
    if (!node) continue;
    const samples = frames.map(frame => frame.elements.find(el => el.id === id) || null);
    const first = samples.find((el): el is ComponentElement => !!el);
    if (!first) continue;
    if (first.type === 'arrow') {
      const path = node.querySelector('path.main-path');
      if (!path) continue;
      const values = samples.map(el => pathD(arrowPoints(el || first), projector));
      appendAnimate(path, 'd', values, times, dur);
    } else {
      const values = samples.map(el => transformFor(el || first, projector));
      appendAnimate(node, 'transform', values, times, dur);
    }
  }

  const box = contentBox(page.fieldTemplate);
  const cuts = boundaries(frames);
  const total = dur || 1;
  frames.forEach((frame, i) => {
    const text = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(box.cx));
    text.setAttribute('y', String(box.cy - box.H / 2 + 22));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '16');
    text.setAttribute('font-weight', '700');
    text.setAttribute('pointer-events', 'none');
    text.textContent = frame.name || `Phase ${i + 1}`;
    const anim = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'animate');
    const start = cuts[i] / total;
    const end = i < frames.length - 1 ? cuts[i + 1] / total : 1;
    anim.setAttribute('attributeName', 'opacity');
    anim.setAttribute('dur', `${dur}s`);
    anim.setAttribute('begin', '0s');
    anim.setAttribute('fill', 'freeze');
    anim.setAttribute('calcMode', 'discrete');
    if (i === 0) {
      const e = Math.min(0.9999, Math.max(0.0001, end));
      anim.setAttribute('keyTimes', `0;${e.toFixed(4)};1`);
      anim.setAttribute('values', '1;0;0');
    } else if (i === frames.length - 1) {
      const s = Math.min(0.9999, Math.max(0.0001, start));
      anim.setAttribute('keyTimes', `0;${s.toFixed(4)};1`);
      anim.setAttribute('values', '0;1;1');
    } else {
      const s = Math.max(0.0001, start);
      const e = Math.min(0.9999, Math.max(s + 0.0001, end));
      anim.setAttribute('keyTimes', `0;${s.toFixed(4)};${e.toFixed(4)};1`);
      anim.setAttribute('values', '0;1;0;0');
    }
    text.appendChild(anim);
    svg.appendChild(text);
  });
}
