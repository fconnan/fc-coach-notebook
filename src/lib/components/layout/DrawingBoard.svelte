<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte';
  import {
    fitCamera,
    fitExtent,
    formatMeter,
    lensPoint,
    limitPan,
    rulerStep,
    viewOf,
    wheelPixels,
    worldInLens,
    worldPoint,
    type Camera,
    type Frame,
    type Solid
  } from '$lib/editor/board';

  type Pin = { lx: number; ly: number; worldX: number; worldY: number };

  let {
    ruled = false,
    compact = false,
    editing = false,
    grabbing = false,
    resetKey = '',
    frameOf,
    preset = undefined as ((root: SVGSVGElement, lensW: number, lensH: number) => Camera | null) | undefined,
    onlook = undefined as ((point: { x: number; y: number }) => void) | undefined,
    onview = undefined as (() => void) | undefined,
    onpointerdown = undefined as ((event: PointerEvent) => void) | undefined,
    onpointermove = undefined as ((event: PointerEvent) => void) | undefined,
    onpointerup = undefined as ((event: PointerEvent) => void) | undefined,
    onpointercancel = undefined as ((event: PointerEvent) => void) | undefined,
    ondblclick = undefined as ((event: MouseEvent) => void) | undefined,
    oncontextmenu = undefined as ((event: MouseEvent) => void) | undefined,
    onclick = undefined as ((event: MouseEvent) => void) | undefined,
    sheet = $bindable<HTMLDivElement | null>(null),
    lens = $bindable<HTMLDivElement | null>(null),
    home = $bindable(true),
    fitZoom = $bindable<(() => void) | undefined>(undefined),
    children,
    overlay
  }: {
    ruled?: boolean;
    compact?: boolean;
    editing?: boolean;
    grabbing?: boolean;
    resetKey?: string;
    frameOf: (root: SVGSVGElement) => Frame | null;
    preset?: (root: SVGSVGElement, lensW: number, lensH: number) => Camera | null;
    onlook?: (point: { x: number; y: number }) => void;
    onview?: () => void;
    onpointerdown?: (event: PointerEvent) => void;
    onpointermove?: (event: PointerEvent) => void;
    onpointerup?: (event: PointerEvent) => void;
    onpointercancel?: (event: PointerEvent) => void;
    ondblclick?: (event: MouseEvent) => void;
    oncontextmenu?: (event: MouseEvent) => void;
    onclick?: (event: MouseEvent) => void;
    sheet?: HTMLDivElement | null;
    lens?: HTMLDivElement | null;
    /** Vrai quand le cadrage est déjà celui de Fit Zoom. */
    home?: boolean;
    /** Zoom pour voir tous les objets. La barre d’outils l’appelle. */
    fitZoom?: () => void;
    children?: Snippet;
    overlay?: Snippet;
  } = $props();

  let rulerXEl = $state<HTMLCanvasElement | null>(null);
  let rulerYEl = $state<HTMLCanvasElement | null>(null);
  let zoom = $state(1);
  let fitted = $state<{ w: number; h: number } | null>(null);
  let camera: Camera | null = null;
  let basePpm: number | null = null;
  let seenKey = '';
  let told = '';
  let cursor: { x: number; y: number } | null = null;

  function rootOf(): SVGSVGElement | null {
    const root = sheet?.querySelector('svg');
    return root instanceof SVGSVGElement ? root : null;
  }

  function liveBox(root: SVGSVGElement) {
    const box = root.viewBox.baseVal;
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  function publishLook() {
    const cam = camera;
    const tell = untrack(() => onlook);
    if (!cam || !tell) return;
    const x = Math.round(cam.worldX * 100) / 100;
    const y = Math.round(cam.worldY * 100) / 100;
    const key = `${x},${y}`;
    if (key === told) return;
    told = key;
    tell({ x, y });
  }

  function applyCamera(root: SVGSVGElement, host: HTMLElement, frame: Frame) {
    const cam = camera;
    if (!cam) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!(width > 20) || !(height > 20)) return;
    const box = viewOf(frame, cam, width, height);
    root.setAttribute('preserveAspectRatio', 'none');
    root.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
    publishLook();
  }

  function adoptCamera(root: SVGSVGElement, host: HTMLElement, frame: Frame) {
    const box = root.viewBox.baseVal;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!(box.width > 0) || !(box.height > 0) || !(width > 20) || !(height > 20)) return;
    const chosen = preset?.(root, width, height) ?? fitCamera(frame, liveBox(root), width, height);
    camera = chosen;
    basePpm = chosen.ppm;
  }

  export function nudge(mark: Pin) {
    const host = lens;
    const root = rootOf();
    const cam = camera;
    const frame = root ? frameOf(root) : null;
    if (!host || !root || !cam || !frame) return;
    const box = liveBox(root);
    const at = lensPoint(frame, box, host.clientWidth, host.clientHeight, mark.worldX, mark.worldY);
    const dx = at.x - mark.lx;
    const dy = at.y - mark.ly;
    if (Math.hypot(dx, dy) < 0.5) return;
    cam.worldX += dx / cam.ppm;
    cam.worldY -= dy / cam.ppm;
    applyCamera(root, host, frame);
    paintRulers();
    rememberHome();
  }

  export function settle(retry = true) {
    if (resetKey !== seenKey) {
      seenKey = resetKey;
      camera = null;
      basePpm = null;
      told = '';
      zoom = 1;
      fitted = null;
      cursor = null;
    }
    const host = lens;
    const root = rootOf();
    if (!ruled || !host || !root) return;
    const frame = frameOf(root);
    if (!frame) {
      camera = null;
      basePpm = null;
      home = true;
      return;
    }
    if (host.clientWidth < 20 || host.clientHeight < 20) {
      if (retry) requestAnimationFrame(() => settle(false));
      return;
    }
    if (!camera) adoptCamera(root, host, frame);
    if (!camera) return;
    applyCamera(root, host, frame);
    paintRulers();
    rememberHome();
    untrack(() => onview?.());
  }

  function rulerContext(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D | null {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function paintRulers() {
    const host = lens;
    const root = rootOf();
    const horizontal = rulerXEl;
    const vertical = rulerYEl;
    const frame = root ? frameOf(root) : null;
    if (!ruled || !camera || !host || !root || !frame || !horizontal || !vertical) return;
    const width = horizontal.clientWidth;
    const height = vertical.clientHeight;
    const bandX = horizontal.clientHeight;
    const bandY = vertical.clientWidth;
    const ctxX = rulerContext(horizontal, width, bandX);
    const ctxY = rulerContext(vertical, bandY, height);
    if (!ctxX || !ctxY || !(width > 0) || !(height > 0)) return;
    const box = liveBox(root);
    const { step, minor } = rulerStep(camera.ppm);
    const majors = Math.round(step / minor);
    const major = (index: number) => ((index % majors) + majors) % majors === 0;
    const left = worldInLens(frame, box, width, height, 0, 0);
    const right = worldInLens(frame, box, width, height, width, 0);
    const top = worldInLens(frame, box, width, height, 0, 0);
    const bottom = worldInLens(frame, box, width, height, 0, height);
    ctxX.fillStyle = '#f3f4f6';
    ctxX.fillRect(0, 0, width, bandX);
    ctxY.fillStyle = '#f3f4f6';
    ctxY.fillRect(0, 0, bandY, height);
    ctxX.strokeStyle = '#9ca3af';
    ctxX.fillStyle = '#4b5563';
    ctxX.font = '10px sans-serif';
    ctxX.textAlign = 'center';
    ctxX.textBaseline = 'top';
    ctxX.lineWidth = 1;
    ctxY.strokeStyle = '#9ca3af';
    ctxY.fillStyle = '#4b5563';
    ctxY.font = '10px sans-serif';
    ctxY.textAlign = 'right';
    ctxY.textBaseline = 'middle';
    ctxY.lineWidth = 1;
    const at = (worldX: number, worldY: number) => lensPoint(frame, box, width, height, worldX, worldY);
    if (left && right) {
      const i0 = Math.floor(Math.min(left.x, right.x) / minor);
      const i1 = Math.ceil(Math.max(left.x, right.x) / minor);
      for (let i = i0; i <= i1; i += 1) {
        const meter = i * minor;
        const spot = at(meter, left.y);
        const isMajor = major(i);
        ctxX.beginPath();
        ctxX.moveTo(spot.x + 0.5, bandX);
        ctxX.lineTo(spot.x + 0.5, isMajor ? 11 : bandX - 5);
        ctxX.stroke();
        if (isMajor) ctxX.fillText(formatMeter(meter), spot.x, 1);
      }
    }
    if (top && bottom) {
      const i0 = Math.floor(Math.min(top.y, bottom.y) / minor);
      const i1 = Math.ceil(Math.max(top.y, bottom.y) / minor);
      for (let i = i0; i <= i1; i += 1) {
        const meter = i * minor;
        const spot = at(top.x, meter);
        const isMajor = major(i);
        ctxY.beginPath();
        ctxY.moveTo(bandY, spot.y + 0.5);
        ctxY.lineTo(isMajor ? 2 : bandY - 5, spot.y + 0.5);
        ctxY.stroke();
        if (isMajor) ctxY.fillText(formatMeter(meter), bandY - 8, spot.y);
      }
    }
    if (cursor) {
      ctxX.strokeStyle = '#1d4ed8';
      ctxX.beginPath();
      ctxX.moveTo(cursor.x + 0.5, 0);
      ctxX.lineTo(cursor.x + 0.5, bandX);
      ctxX.stroke();
      ctxY.strokeStyle = '#1d4ed8';
      ctxY.beginPath();
      ctxY.moveTo(0, cursor.y + 0.5);
      ctxY.lineTo(bandY, cursor.y + 0.5);
      ctxY.stroke();
    }
    ctxX.strokeStyle = '#d1d5db';
    ctxX.beginPath();
    ctxX.moveTo(0, bandX - 0.5);
    ctxX.lineTo(width, bandX - 0.5);
    ctxX.stroke();
    ctxY.strokeStyle = '#d1d5db';
    ctxY.beginPath();
    ctxY.moveTo(bandY - 0.5, 0);
    ctxY.lineTo(bandY - 0.5, height);
    ctxY.stroke();
  }

  function trackCursor(event: PointerEvent) {
    const host = lens;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    paintRulers();
  }

  function clearCursor() {
    cursor = null;
    paintRulers();
  }

  function objectNodes(root: SVGSVGElement): SVGGraphicsElement[] {
    const picked = [...root.querySelectorAll('[data-pick]')]
      .filter((node): node is SVGGraphicsElement => node instanceof SVGGraphicsElement && !node.closest('#svg-edit, #svg-selection'));
    if (picked.length) return picked;
    const pitch = root.querySelector('.fc-pitch');
    if (pitch instanceof SVGGraphicsElement) return [pitch];
    return [...root.querySelectorAll('path, circle, ellipse, rect, line, polyline, polygon, text, image, use')]
      .filter((node): node is SVGGraphicsElement => node instanceof SVGGraphicsElement && !node.closest('defs, #svg-edit, #svg-selection, .fc-ground'));
  }

  function objectExtent(root: SVGSVGElement, frame: Frame): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const into = root.getScreenCTM()?.inverse();
    if (!into) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of objectNodes(root)) {
      const from = node.getScreenCTM();
      if (!from) continue;
      let box: DOMRect;
      try { box = node.getBBox(); }
      catch { continue; }
      if (!(box.width > 0) && !(box.height > 0)) continue;
      for (const [x, y] of [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]) {
        const point = new DOMPoint(x, y).matrixTransform(from).matrixTransform(into);
        const world = worldPoint(frame, point.x, point.y);
        minX = Math.min(minX, world.x);
        minY = Math.min(minY, world.y);
        maxX = Math.max(maxX, world.x);
        maxY = Math.max(maxY, world.y);
      }
    }
    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }

  export function fitObjects() {
    const host = lens;
    const root = rootOf();
    const frame = root ? frameOf(root) : null;
    if (!host || !root || !frame) return;
    const extent = objectExtent(root, frame);
    if (!extent) return;
    const chosen = fitExtent(frame, extent, host.clientWidth, host.clientHeight);
    if (!chosen) return;
    camera = chosen;
    basePpm = chosen.ppm;
    applyCamera(root, host, frame);
    paintRulers();
    home = true;
    untrack(() => onview?.());
  }

  $effect(() => {
    fitZoom = fitObjects;
  });

  function nearCamera(current: Camera, chosen: Camera): boolean {
    const shift = 3 / Math.max(chosen.ppm, 0.001);
    return Math.abs(current.worldX - chosen.worldX) < shift
      && Math.abs(current.worldY - chosen.worldY) < shift
      && Math.abs(current.ppm - chosen.ppm) <= Math.max(0.05, chosen.ppm * 0.02);
  }

  function rememberHome() {
    const host = lens;
    const root = rootOf();
    const frame = root ? frameOf(root) : null;
    const cam = camera;
    if (!host || !root || !frame || !cam) {
      home = true;
      return;
    }
    const extent = objectExtent(root, frame);
    const chosen = extent ? fitExtent(frame, extent, host.clientWidth, host.clientHeight) : null;
    home = !chosen || nearCamera(cam, chosen);
  }

  function contentNodes(root: SVGSVGElement): SVGGraphicsElement[] {
    const marked = [...root.querySelectorAll('.fc-pitch, .fc-line, .fc-zone, [data-pick], [data-zone]')]
      .filter((node): node is SVGGraphicsElement => node instanceof SVGGraphicsElement && !node.closest('#svg-edit, #svg-selection'));
    if (marked.length) return marked;
    return [...root.querySelectorAll('path, circle, ellipse, rect, line, polyline, polygon, text, image, use')]
      .filter((node): node is SVGGraphicsElement => node instanceof SVGGraphicsElement && !node.closest('defs, #svg-edit, #svg-selection, .fc-ground'));
  }

  function contentSolids(root: SVGSVGElement, frame: Frame): Solid[] {
    const into = root.getScreenCTM()?.inverse();
    if (!into) return [];
    const solids: Solid[] = [];
    for (const node of contentNodes(root)) {
      const from = node.getScreenCTM();
      if (!from) continue;
      let box: DOMRect;
      try { box = node.getBBox(); }
      catch { continue; }
      if (!(box.width > 0) || !(box.height > 0)) continue;
      const at = (x: number, y: number) => {
        const point = new DOMPoint(x, y).matrixTransform(from).matrixTransform(into);
        return worldPoint(frame, point.x, point.y);
      };
      if (node instanceof SVGCircleElement || node instanceof SVGEllipseElement) {
        const center = at(box.x + box.width / 2, box.y + box.height / 2);
        const east = at(box.x + box.width, box.y + box.height / 2);
        const north = at(box.x + box.width / 2, box.y);
        solids.push({
          kind: 'disk',
          cx: center.x,
          cy: center.y,
          rx: Math.hypot(east.x - center.x, east.y - center.y),
          ry: Math.hypot(north.x - center.x, north.y - center.y)
        });
        continue;
      }
      const corners = [
        at(box.x, box.y),
        at(box.x + box.width, box.y),
        at(box.x, box.y + box.height),
        at(box.x + box.width, box.y + box.height)
      ];
      const minX = Math.min(...corners.map(corner => corner.x));
      const maxX = Math.max(...corners.map(corner => corner.x));
      const minY = Math.min(...corners.map(corner => corner.y));
      const maxY = Math.max(...corners.map(corner => corner.y));
      if (node instanceof SVGRectElement) solids.push({ kind: 'box', minX, minY, maxX, maxY });
      else solids.push({ kind: 'disk', cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 });
    }
    return solids;
  }

  function worldAt(event: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const host = lens;
    const root = rootOf();
    const frame = root ? frameOf(root) : null;
    if (!host || !root || !frame) return null;
    const rect = host.getBoundingClientRect();
    const box = liveBox(root);
    if (!(box.width > 0) || !(box.height > 0) || !(rect.width > 0)) return null;
    return worldInLens(frame, box, rect.width, rect.height, event.clientX - rect.left, event.clientY - rect.top);
  }

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      zoomAt(event);
      return;
    }
    if (!ruled || !camera) return;
    const host = lens;
    const root = rootOf();
    const frame = root ? frameOf(root) : null;
    if (!host || !root || !frame) return;
    event.preventDefault();
    const delta = wheelPixels(event, host.clientWidth, host.clientHeight);
    if (!delta.x && !delta.y) return;
    const next = limitPan(camera, {
      worldX: camera.worldX + delta.x / camera.ppm,
      worldY: camera.worldY - delta.y / camera.ppm,
      ppm: camera.ppm
    }, host.clientWidth, host.clientHeight, contentSolids(root, frame), 24 / camera.ppm);
    if (Math.abs(next.worldX - camera.worldX) < 1e-6 && Math.abs(next.worldY - camera.worldY) < 1e-6) return;
    camera.worldX = next.worldX;
    camera.worldY = next.worldY;
    applyCamera(root, host, frame);
    paintRulers();
    rememberHome();
    untrack(() => onview?.());
  }

  function zoomAt(event: WheelEvent) {
    event.preventDefault();
    const host = lens;
    if (!host || !sheet) return;
    if (ruled && camera && basePpm) {
      const root = rootOf();
      const frame = root ? frameOf(root) : null;
      const world = worldAt(event);
      if (!root || !frame || !world) return;
      let delta = event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
      else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= host.clientHeight;
      const next = Math.min(basePpm * 8, Math.max(basePpm * 0.4, camera.ppm * Math.exp(-delta * 0.0018)));
      if (Math.abs(next - camera.ppm) < 0.01) return;
      const rect = host.getBoundingClientRect();
      const fx = (event.clientX - rect.left) / rect.width;
      const fy = (event.clientY - rect.top) / rect.height;
      camera.ppm = next;
      const vw = rect.width / camera.ppm;
      const vh = rect.height / camera.ppm;
      camera.worldX = world.x - (fx - 0.5) * vw;
      camera.worldY = world.y + (fy - 0.5) * vh;
      applyCamera(root, host, frame);
      paintRulers();
      rememberHome();
      untrack(() => onview?.());
      return;
    }
    const origin = fitted ?? { w: sheet.clientWidth, h: sheet.clientHeight };
    if (!origin.w || !origin.h) return;
    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= host.clientHeight;
    const next = Math.min(8, Math.max(0.4, zoom * Math.exp(-delta * 0.0018)));
    if (Math.abs(next - zoom) < 0.001) return;
    const ratio = next / zoom;
    const rect = host.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const anchorX = offsetX + host.scrollLeft;
    const anchorY = offsetY + host.scrollTop;
    if (!fitted) fitted = origin;
    zoom = next;
    void tick().then(() => {
      host.scrollLeft = anchorX * ratio - offsetX;
      host.scrollTop = anchorY * ratio - offsetY;
      untrack(() => onview?.());
    });
  }

  $effect(() => {
    resetKey;
    lens;
    sheet;
    rulerXEl;
    rulerYEl;
    settle();
  });

  $effect(() => {
    const host = lens;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      if (ruled && camera) settle(false);
    });
    observer.observe(host);
    return () => observer.disconnect();
  });

  $effect(() => {
    const host = lens;
    if (!host) return;
    const listen = (event: WheelEvent) => onWheel(event);
    host.addEventListener('wheel', listen, { passive: false });
    return () => host.removeEventListener('wheel', listen);
  });
</script>

<div class="board" class:ruled>
  {#if ruled}
    <div class="ruler-corner" title="Mètres" aria-hidden="true">m</div>
    <canvas class="ruler-x" bind:this={rulerXEl} aria-label="Règle horizontale, en mètres"></canvas>
    <canvas class="ruler-y" bind:this={rulerYEl} aria-label="Règle verticale, en mètres"></canvas>
  {/if}
  <div
    class="lens"
    class:compact
    bind:this={lens}
    role="presentation"
    onpointermove={ruled ? trackCursor : undefined}
    onpointerleave={ruled ? clearCursor : undefined}
  >
    <div
      class="sheet"
      class:editing
      class:grabbing
      style:width={ruled || !fitted ? '100%' : `${fitted.w * zoom}px`}
      style:height={ruled || !fitted ? '100%' : `${fitted.h * zoom}px`}
      bind:this={sheet}
      role="presentation"
      {onpointerdown}
      {onpointermove}
      {onpointerup}
      {onpointercancel}
      {ondblclick}
      {oncontextmenu}
      {onclick}
      onkeydown={() => {}}
    >{@render children?.()}</div>
    {@render overlay?.()}
  </div>
</div>

<style>
  .board {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }
  .board.ruled {
    display: grid;
    grid-template-columns: 1.75rem minmax(0, 1fr);
    grid-template-rows: 1.35rem minmax(0, 1fr);
  }
  .ruler-corner {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    color: #6b7280;
    font-size: 0.65rem;
    border-right: 1px solid #d1d5db;
    border-bottom: 1px solid #d1d5db;
  }
  .ruler-x { grid-column: 2; grid-row: 1; width: 100%; height: 100%; }
  .ruler-y { grid-column: 1; grid-row: 2; width: 100%; height: 100%; }
  .board.ruled .lens { grid-column: 2; grid-row: 2; overflow: hidden; }
  .lens {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }
  .lens.compact { flex: none; height: 7.5rem; }
  .sheet { width: 100%; height: 100%; }
  .sheet :global(svg) { display: block; width: 100%; height: 100%; }
  .sheet.editing { touch-action: none; user-select: none; }
  .sheet.editing :global([data-box-handle="nw"]),
  .sheet.editing :global([data-box-handle="se"]) { cursor: nwse-resize; }
  .sheet.editing :global([data-box-handle="ne"]),
  .sheet.editing :global([data-box-handle="sw"]) { cursor: nesw-resize; }
  .sheet.editing :global([data-box-handle="n"]),
  .sheet.editing :global([data-box-handle="s"]) { cursor: ns-resize; }
  .sheet.editing :global([data-box-handle="e"]),
  .sheet.editing :global([data-box-handle="w"]) { cursor: ew-resize; }
  .sheet.editing :global(circle[data-handle]),
  .sheet.editing :global(rect[data-handle]),
  .sheet.editing :global([data-knot]),
  .sheet.editing :global([data-rotate]) { cursor: grab; }
  .sheet.editing :global([data-resize="x"]) { cursor: ew-resize; }
  .sheet.editing :global([data-resize="y"]) { cursor: ns-resize; }
  .sheet.editing :global([data-resize="xy"]) { cursor: nwse-resize; }
  .sheet.grabbing :global(svg) { cursor: grabbing; }
</style>
