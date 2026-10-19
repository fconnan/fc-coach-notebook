import { get } from 'svelte/store';
import {
  selectedIds,
  selectElement,
  currentPage,
  pushHistory,
  moveElements,
  type Position
} from '$lib/stores/workspace';

/** Convert client (screen) coordinates to the SVG user space. */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Position {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/**
 * Shared pointer-down handler for translate-based elements (players, ball,
 * equipment). Handles additive selection (shift) and group dragging in SVG space.
 */
export function beginElementDrag(e: PointerEvent, element: { id: string; locked?: boolean }) {
  const svg = (e.currentTarget as SVGElement).ownerSVGElement;
  if (!svg) return;
  e.stopPropagation();

  // Selection logic
  if (e.shiftKey) {
    selectElement(element.id, true);
  } else if (!get(selectedIds).includes(element.id)) {
    selectElement(element.id, false);
  }

  if (element.locked) return; // locked elements are selectable but not draggable

  const ids = get(selectedIds).filter(id => {
    const el = get(currentPage).elements.find(e2 => e2.id === id);
    return el && !el.locked;
  });
  if (ids.length === 0) return;

  const page = get(currentPage);
  const base: Record<string, any> = {};
  page.elements.forEach(el => {
    if (ids.includes(el.id)) {
      base[el.id] = { ...el.position };
      if (el.pathPoints) base[el.id + ':path'] = el.pathPoints.map(p => ({ ...p }));
    }
  });

  const start = svgPoint(svg, e.clientX, e.clientY);
  let historyPushed = false;

  function move(ev: PointerEvent) {
    const cur = svgPoint(svg!, ev.clientX, ev.clientY);
    const dx = cur.x - start.x;
    const dy = cur.y - start.y;
    if (!historyPushed && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
      pushHistory(true);
      historyPushed = true;
    }
    moveElements(ids, dx, dy, base);
  }
  function up() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
