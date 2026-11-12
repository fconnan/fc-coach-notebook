import { moveShapeKnot, rotateShape, shapeCenter, shapeKnots, translateShape, type ShapeAttrs } from './shapeModel';

const NS = 'http://www.w3.org/2000/svg';

export type ShapeBinding = {
  root: SVGSVGElement;
  node: SVGGraphicsElement;
  /** Groupe où poser les poignées, dans le repère du svg racine. */
  group: SVGGElement;
  tag: string;
  attrs: ShapeAttrs;
  onSelect?: () => void;
  /** `commit` est faux pendant le geste, vrai au relâchement. */
  onEdit: (attrs: ShapeAttrs, commit: boolean) => void;
};

function unitOf(root: SVGSVGElement, pixels: number): number {
  const scale = root.getScreenCTM()?.a;
  return scale ? pixels / Math.abs(scale) : pixels;
}

function toRoot(node: SVGGraphicsElement, root: SVGSVGElement, x: number, y: number): DOMPoint | null {
  const from = node.getScreenCTM();
  const to = root.getScreenCTM();
  if (!from || !to) return null;
  return new DOMPoint(x, y).matrixTransform(to.inverse().multiply(from));
}

function localPoint(node: SVGGraphicsElement, matrix: DOMMatrix, event: PointerEvent): { x: number; y: number } | null {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
  return { x: point.x, y: point.y };
}

function parentPlane(node: SVGGraphicsElement): { matrix: DOMMatrix; yDown: boolean } | null {
  const parent = node.parentElement instanceof SVGGraphicsElement ? node.parentElement : node;
  const matrix = parent.getScreenCTM();
  if (!matrix) return null;
  const origin = new DOMPoint(0, 0).matrixTransform(matrix);
  const yAxis = new DOMPoint(0, 1).matrixTransform(matrix);
  return { matrix, yDown: yAxis.y > origin.y };
}

function screenAngle(plane: { matrix: DOMMatrix; yDown: boolean }, cx: number, cy: number, event: PointerEvent): number {
  const center = new DOMPoint(cx, cy).matrixTransform(plane.matrix);
  const screen = Math.atan2(event.clientX - center.x, -(event.clientY - center.y)) * 180 / Math.PI;
  return plane.yDown ? screen : -screen;
}

function applyAttrs(node: SVGElement, attrs: ShapeAttrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value) node.setAttribute(key, value);
  }
}

export type ShapeControls = {
  /** Démarre une translation à partir d’un pointerdown déjà reçu. */
  grab: (event: PointerEvent) => void;
  dispose: () => void;
};

/** Poignées de déplacement, d’étirement et de rotation. Le même geste pour le SVG et le YAML. */
export function bindShapeControls(binding: ShapeBinding): ShapeControls {
  const { root, node, group, tag, onSelect, onEdit } = binding;
  let attrs = { ...binding.attrs };
  let body: ((event: PointerEvent) => void) | null = null;

  const paint = () => {
    group.querySelectorAll('[data-shape-ui]').forEach(item => item.remove());
    const knots = shapeKnots(tag, attrs);
    const unit = unitOf(root, 1);
    let anchorAt = 0;
    knots.forEach((knot, index) => {
      const at = toRoot(node, root, knot.x, knot.y);
      if (!at) return;
      if (knot.role === 'control') {
        const anchor = knots.find(item => item.seg === knot.seg && item.role === 'anchor');
        const from = anchor ? toRoot(node, root, anchor.x, anchor.y) : null;
        if (from) {
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('data-shape-ui', '1');
          line.setAttribute('x1', String(at.x));
          line.setAttribute('y1', String(at.y));
          line.setAttribute('x2', String(from.x));
          line.setAttribute('y2', String(from.y));
          line.setAttribute('stroke', '#fde047');
          line.setAttribute('stroke-width', String(unit));
          line.setAttribute('pointer-events', 'none');
          group.appendChild(line);
        }
      }
      const handle = document.createElementNS(NS, 'circle');
      handle.setAttribute('data-shape-ui', '1');
      handle.setAttribute('cx', String(at.x));
      handle.setAttribute('cy', String(at.y));
      handle.setAttribute('r', String(unitOf(root, knot.role === 'control' ? 4 : 6)));
      handle.setAttribute('fill', knot.role === 'control' ? '#fde047' : '#ffffff');
      handle.setAttribute('stroke', '#111827');
      handle.setAttribute('stroke-width', String(unit));
      handle.setAttribute('cursor', 'grab');
      if (tag.toLowerCase() === 'path' && knot.role === 'anchor') {
        handle.setAttribute('data-path-anchor', String(anchorAt));
        anchorAt += 1;
      }
      handle.addEventListener('pointerdown', (event) => beginKnot(event, index));
      handle.addEventListener('click', (event) => event.stopPropagation());
      group.appendChild(handle);
    });
    const center = shapeCenter(tag, attrs);
    const at = center ? toRoot(node, root, center.x, center.y) : null;
    if (center && at && tag.toLowerCase() !== 'circle') {
      const matrix = root.getScreenCTM();
      const screen = matrix ? new DOMPoint(at.x, at.y).matrixTransform(matrix) : null;
      const lifted = screen && matrix ? new DOMPoint(screen.x, screen.y - 28).matrixTransform(matrix.inverse()) : null;
      if (lifted) {
        const stem = document.createElementNS(NS, 'line');
        stem.setAttribute('data-shape-ui', '1');
        stem.setAttribute('x1', String(at.x));
        stem.setAttribute('y1', String(at.y));
        stem.setAttribute('x2', String(lifted.x));
        stem.setAttribute('y2', String(lifted.y));
        stem.setAttribute('stroke', '#111827');
        stem.setAttribute('stroke-width', String(unit));
        stem.setAttribute('pointer-events', 'none');
        group.appendChild(stem);
        const knob = document.createElementNS(NS, 'circle');
        knob.setAttribute('data-shape-ui', '1');
        knob.setAttribute('data-shape-rotate', '1');
        knob.setAttribute('cx', String(lifted.x));
        knob.setAttribute('cy', String(lifted.y));
        knob.setAttribute('r', String(unitOf(root, 6)));
        knob.setAttribute('fill', '#fde047');
        knob.setAttribute('stroke', '#111827');
        knob.setAttribute('stroke-width', String(unit));
        knob.setAttribute('cursor', 'grab');
        knob.addEventListener('pointerdown', beginRotate);
        knob.addEventListener('click', (event) => event.stopPropagation());
        group.appendChild(knob);
      }
    }
  };

  const preview = (next: ShapeAttrs) => {
    attrs = next;
    applyAttrs(node, next);
    paint();
    onEdit(next, false);
  };

  const gesture = (event: PointerEvent, update: (pointer: PointerEvent) => ShapeAttrs | null) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.();
    const origin = { ...attrs };
    let moved = false;
    let latest = origin;
    const move = (pointer: PointerEvent) => {
      if (!moved && Math.hypot(pointer.clientX - event.clientX, pointer.clientY - event.clientY) < 3) return;
      moved = true;
      const next = update(pointer);
      if (next) {
        latest = next;
        preview(next);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) onEdit(latest, true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  function frozenParent() {
    const plane = parentPlane(node);
    return plane ? plane.matrix.inverse() : null;
  }

  /** Le centre se translate dans le repère du parent : la rotation de l’élément ne doit pas dévier le geste. */
  function translateBy(event: PointerEvent) {
    const frozen = frozenParent();
    if (!frozen) return;
    const start = localPoint(node, frozen, event);
    if (!start) return;
    const origin = { ...attrs };
    gesture(event, (pointer) => {
      const now = localPoint(node, frozen, pointer);
      if (!now) return null;
      return translateShape(tag, origin, now.x - start.x, now.y - start.y);
    });
  }

  function beginKnot(event: PointerEvent, index: number) {
    const name = tag.toLowerCase();
    if ((name === 'circle' || name === 'ellipse') && index === 0) {
      translateBy(event);
      return;
    }
    gesture(event, (pointer) => {
      const matrix = node.getScreenCTM()?.inverse();
      if (!matrix) return null;
      const local = localPoint(node, matrix, pointer);
      if (!local) return null;
      return moveShapeKnot(tag, attrs, index, local.x, local.y);
    });
  }

  function beginRotate(event: PointerEvent) {
    if (tag.toLowerCase() === 'circle') return;
    const plane = parentPlane(node);
    if (!plane) return;
    gesture(event, (pointer) => {
      const center = shapeCenter(tag, attrs);
      if (!center) return null;
      return rotateShape(tag, attrs, screenAngle(plane, center.x, center.y, pointer));
    });
  }

  function grab(event: PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest('[data-shape-ui]')) return;
    translateBy(event);
  }
  body = grab;
  node.addEventListener('pointerdown', body);
  paint();

  return {
    grab,
    dispose() {
      if (body) node.removeEventListener('pointerdown', body);
      group.querySelectorAll('[data-shape-ui]').forEach(item => item.remove());
    }
  };
}
