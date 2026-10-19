import { get } from 'svelte/store';
import {
  selectedIds,
  selectElement,
  currentPage,
  pushHistory,
  moveElements,
  updateElement,
  type ComponentElement
} from '$lib/stores/workspace';
import { worldToDisplay } from '$lib/utils/field3d';
import * as THREE from 'three';

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const hit = new THREE.Vector3();

/** Raycast from NDC coords to ground plane; returns display SVG position. */
export function raycastGround(
  camera: THREE.Camera,
  ndcX: number,
  ndcY: number,
  template: 'Complet' | 'Demi' | 'DemiBas' = 'Complet'
): { x: number; y: number } | null {
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const pt = raycaster.ray.intersectPlane(groundPlane, hit);
  if (!pt) return null;
  return worldToDisplay(pt.x, pt.z, template);
}

function clientToNdc(clientX: number, clientY: number, dom: HTMLElement) {
  const rect = dom.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1
  };
}

let dragCamera: THREE.Camera | null = null;
let dragDom: HTMLElement | null = null;

export function beginElementDrag3d(
  e: PointerEvent,
  element: { id: string; locked?: boolean },
  camera?: THREE.Camera,
  dom?: HTMLElement
) {
  e.stopPropagation();
  if (camera) dragCamera = camera;
  if (dom) dragDom = dom;

  if (e.shiftKey) selectElement(element.id, true);
  else if (!get(selectedIds).includes(element.id)) selectElement(element.id, false);

  if (element.locked) return;

  const ids = get(selectedIds).filter((id) => {
    const el = get(currentPage).elements.find((e2) => e2.id === id);
    return el && !el.locked;
  });
  if (ids.length === 0 || !dragCamera || !dragDom) return;

  const page = get(currentPage);
  const template = page.fieldTemplate;
  const base: Record<string, { x: number; y: number }> = {};
  page.elements.forEach((el) => {
    if (ids.includes(el.id)) base[el.id] = { ...el.position };
  });

  const ndc0 = clientToNdc(e.clientX, e.clientY, dragDom);
  const startDisplay = raycastGround(dragCamera, ndc0.x, ndc0.y, template);
  if (!startDisplay) return;
  const start = startDisplay;

  let historyPushed = false;

  function move(ev: PointerEvent) {
    if (!dragCamera || !dragDom) return;
    const ndc = clientToNdc(ev.clientX, ev.clientY, dragDom);
    const curDisplay = raycastGround(dragCamera, ndc.x, ndc.y, template);
    if (!curDisplay) return;
    const dx = curDisplay.x - start.x;
    const dy = curDisplay.y - start.y;
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

/** Place element at client coords on ground (DnD). */
export function placeAtClient3d(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  dom: HTMLElement,
  elementId: string
) {
  const page = get(currentPage);
  const ndc = clientToNdc(clientX, clientY, dom);
  const pos = raycastGround(camera, ndc.x, ndc.y, page.fieldTemplate);
  if (!pos) return;
  updateElement(elementId, { position: pos });
}

export function register3dDragContext(camera: THREE.Camera, dom: HTMLElement) {
  dragCamera = camera;
  dragDom = dom;
}
