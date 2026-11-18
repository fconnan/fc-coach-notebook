<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from 'flowbite-svelte';
  import { registerEditorGate } from '$lib/workspace/editorLeave';
  import { applyParams, hexForInput, isColorValue, paramsOf } from '$lib/schema/params';
  import { readSvg } from '$lib/schema/svg';
  import { layoutAxis, parseStretch, stretchSvg, viewBoxOf as stretchBox } from '$lib/schema/stretch';
  import { insertAnchor, nearestSegment, pathHint, pathKind, removeAnchor, setPathKind, stampPath, type PathKind } from '$lib/editor/pathEdit';
  import { bindShapeControls } from '$lib/editor/shapeHandles';
  import ShapeMenu from './ShapeMenu.svelte';
  import { attrOf, graphicTags, insertMarkup, insertTrackPoint, knotsOf, moveKnot, moveTrackPoint, removeTag, removeTrackPoint, setAttr, setViewBox, shapeMarkup, tagAt, tagAttrs, trackAnchors, viewBoxOf, viewBoxRange } from '$lib/schema/svgEdit';
  import { get } from 'svelte/store';
  import { elementRel } from '$lib/workspace/catalog';
  import LoadingIcon from './LoadingIcon.svelte';
  import RawWait from './RawWait.svelte';
  import SplitPane from './SplitPane.svelte';
  import { libraryDraft, openNavItem, rememberLibraryFile } from '$lib/workspace/state';
  import { fileFrame } from '$lib/editor/board';
  import { DRAW_SHAPES, TEXT_SHAPE } from '$lib/editor/drawShapes';
  import DrawTools from './DrawTools.svelte';
  import DrawingBoard from './DrawingBoard.svelte';
  import DrawingStage from './DrawingStage.svelte';

  let { file }: { file: string } = $props();

  let fileMeta = $state<{ realW?: number; realH?: number; min?: number; stretchX?: string; stretchY?: string; fixed?: boolean }>({});
  let source = $state('');
  let disk = $state('');
  let opened = $state('');
  let error = $state('');
  let status = $state('');
  let loaded = $state(false);
  let editorReady = $state(false);
  let saving = $state(false);
  let selected = $state(-1);
  let host = $state<HTMLDivElement | null>(null);
  let lens = $state<HTMLDivElement | null>(null);
  let sheet = $state<HTMLDivElement | null>(null);
  let board = $state<{ settle(retry?: boolean): void } | null>(null);
  let fitHome = $state(true);
  let fitZoom = $state<(() => void) | undefined>(undefined);
  let viewFocus = $state(false);
  let shapeMenu = $state<{
    x: number;
    y: number;
    index: number;
    track: boolean;
    fill: string;
    stroke: string;
    scope: 'shape' | 'path' | 'point';
    kind: PathKind | null;
    canAdd: boolean;
    canRemove: boolean;
    addLabel: string;
    removeLabel: string;
    addAt: number;
    addX: number;
    addY: number;
    remove: number | null;
  } | null>(null);
  let bandFocus = $state<'x' | 'y' | null>(null);
  let growX = $state(1);
  let growY = $state(1);
  let paramValues = $state<Record<string, string>>({});
  let layout = $state(0);

  function refreshOverlay() {
    layout += 1;
  }
  type XmlRange = { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
  type XmlModel = {
    dispose(): void;
    getPositionAt(offset: number): { lineNumber: number; column: number };
    getOffsetAt(position: { lineNumber: number; column: number }): number;
    getFullModelRange(): XmlRange;
    getLineCount(): number;
    getLineMaxColumn(line: number): number;
  };
  type XmlEditor = {
    setValue(value: string): void;
    getValue(): string;
    dispose(): void;
    focus(): void;
    pushUndoStop(): void;
    trigger(source: string, handlerId: string, payload: null): void;
    executeEdits(source: string, edits: { range: XmlRange; text: string }[]): void;
    onDidChangeCursorPosition(listener: () => void): { dispose(): void };
    getModel(): XmlModel | null;
    getPosition(): { lineNumber: number; column: number } | null;
    setPosition(position: { lineNumber: number; column: number }): void;
    revealPositionInCenter(position: { lineNumber: number; column: number }): void;
  };
  let editor: XmlEditor | null = null;
  let releaseShape: (() => void) | null = null;

  function canon(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  }

  const dirty = $derived(loaded && canon(source) !== canon(disk));
  const shown = $derived(source.replace(/<script\b[\s\S]*?<\/script>/gi, ''));
  const drawnAsset = $derived.by(() => {
    const parsed = readSvg(shown);
    const stretch = fileMeta.stretchX || fileMeta.stretchY ? { x: fileMeta.stretchX, y: fileMeta.stretchY } : undefined;
    const size = fileMeta.realW !== undefined || fileMeta.realH !== undefined
      ? { realW: fileMeta.realW, realH: fileMeta.realH, min: fileMeta.min }
      : undefined;
    return { ...parsed, stretch, size };
  });
  const stretchOn = $derived(Boolean(drawnAsset.stretch?.x || drawnAsset.stretch?.y));
  const fields = $derived(paramsOf(shown));
  const ordered = $derived([...fields].sort((a, b) => Number(isColorValue(b.fallback)) - Number(isColorValue(a.fallback))));
  /** L'encre du trait est déjà le contour de la barre d'outils. */
  const tuned = $derived(ordered.filter(field => !((/(^|\/)arrow\.svg$/).test(file) && field.name === 'ink')));
  const preview = $derived.by(() => {
    const chosen: Record<string, string> = {};
    for (const field of fields) chosen[field.name] = paramValues[field.name] ?? field.fallback;
    const filled = applyParams(shown, chosen);
    if (!stretchOn) return withFrameMargin(filled);
    const asset = readSvg(filled);
    const box = stretchBox(asset.viewBox);
    if (!box) return withFileMeta(withFrameMargin(filled));
    const length = box.w * growX;
    const height = box.h * growY;
    const out = stretchSvg(
      { markup: asset.markup, viewBox: asset.viewBox, stretch: drawnAsset.stretch },
      length,
      height
    );
    return withFileMeta(withFrameMargin(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${out.viewBox}">${out.markup}</svg>`));
  });
  const frameKey = $derived(`${file}\n${readSvg(preview).viewBox}\n${drawnAsset.size?.realW ?? ''}\n${drawnAsset.size?.realH ?? ''}`);

  function withFileMeta(markup: string): string {
    const bits: string[] = [];
    if (fileMeta.realW !== undefined) bits.push(`data-real-w="${fileMeta.realW}"`);
    if (fileMeta.realH !== undefined) bits.push(`data-real-h="${fileMeta.realH}"`);
    if (fileMeta.min !== undefined) bits.push(`data-min-size="${fileMeta.min}"`);
    if (fileMeta.fixed) bits.push('data-fixed="1"');
    if (!bits.length) return markup;
    return markup.replace(/<svg\b/i, `<svg ${bits.join(' ')}`);
  }

  /** Marge d’affichage autour du viewBox. Le cadre jaune reste celui du fichier. */
  function withFrameMargin(markup: string): string {
    const box = stretchBox(readSvg(markup).viewBox);
    if (!box) return markup;
    const share = 0.06;
    const padX = box.w * share;
    const padY = box.h * share;
    const frame = `${fmt(box.x)} ${fmt(box.y)} ${fmt(box.w)} ${fmt(box.h)}`;
    const shown = `${fmt(box.x - padX)} ${fmt(box.y - padY)} ${fmt(box.w + padX * 2)} ${fmt(box.h + padY * 2)}`;
    const tagged = markup.replace(/<svg\b/i, `<svg data-frame="${frame}"`);
    return setViewBox(tagged, shown);
  }

  function setParam(name: string, value: string) {
    paramValues = { ...paramValues, [name]: value };
  }

  const paramsDirty = $derived(fields.some((field) => {
    const value = paramValues[field.name];
    return value !== undefined && value !== field.fallback;
  }));
  const stretchDirty = $derived(stretchOn && (Math.abs(growX - 1) > 1e-6 || Math.abs(growY - 1) > 1e-6));

  function resetPreview() {
    paramValues = {};
    growX = 1;
    growY = 1;
  }

  function onText(text: string) {
    source = text;
  }

  function write(next: string) {
    const current = editor?.getValue() ?? source;
    const model = editor?.getModel();
    if (!editor || !model || next === current) {
      source = next;
      return;
    }
    const position = editor.getPosition();
    editor.pushUndoStop();
    editor.executeEdits('svg', [{ range: model.getFullModelRange(), text: next }]);
    editor.pushUndoStop();
    if (position) {
      const line = Math.min(position.lineNumber, model.getLineCount());
      editor.setPosition({ lineNumber: line, column: Math.min(position.column, model.getLineMaxColumn(line)) });
    }
    source = editor.getValue();
  }

  function stretchSpan(text: string, axis: 'x' | 'y'): { start: number; end: number } | null {
    const found = new RegExp(`data-stretch-${axis}\\s*=\\s*"([^"]*)"`, 'i').exec(text);
    if (!found || found[1] === undefined) return null;
    const start = found.index + found[0].indexOf(found[1]);
    return { start, end: start + found[1].length };
  }

  function followCursor() {
    const model = editor?.getModel();
    const position = editor?.getPosition();
    if (!model || !position) return;
    const text = editor?.getValue() || source;
    const offset = model.getOffsetAt(position);
    const range = viewBoxRange(text);
    selected = tagAt(text, offset);
    viewFocus = !!range && offset >= range.start && offset <= range.end;
    const alongX = stretchSpan(text, 'x');
    const alongY = stretchSpan(text, 'y');
    if (alongX && offset >= alongX.start && offset <= alongX.end) bandFocus = 'x';
    else if (alongY && offset >= alongY.start && offset <= alongY.end) bandFocus = 'y';
    else bandFocus = null;
  }

  function cursorOffset(): number {
    const model = editor?.getModel();
    const position = editor?.getPosition();
    if (!model || !position) return source.length;
    return model.getOffsetAt(position);
  }

  function reveal(offset: number) {
    const model = editor?.getModel();
    if (!editor || !model) return;
    const position = model.getPositionAt(offset);
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
  }

  async function loadMeta() {
    fileMeta = {};
    try {
      const response = await fetch(`/api/schema?part=svg-meta&file=${encodeURIComponent(file)}`);
      if (!response.ok) return;
      fileMeta = await response.json() as typeof fileMeta;
    } catch { /* métadonnées absentes */ }
  }

  async function load() {
    loaded = false;
    error = '';
    await loadMeta();
    const draft = get(libraryDraft);
    if (draft && draft.path === file) {
      source = opened = draft.source;
      disk = '';
      selected = -1;
      growX = 1;
      growY = 1;
      paramValues = {};
      bandFocus = null;
      loaded = true;
      status = '';
      return;
    }
    const response = await fetch(`/api/elements?file=${encodeURIComponent(file)}`);
    const body = await response.json() as { source?: string; error?: string };
    if (!response.ok) {
      error = body.error || 'Lecture impossible';
      return;
    }
    source = disk = opened = body.source || '';
    selected = -1;
    growX = 1;
    growY = 1;
    paramValues = {};
    bandFocus = null;
    loaded = true;
    status = '';
  }

  let epoch = 0;
  let tail: Promise<boolean> = Promise.resolve(true);

  function discard() {
    epoch += 1;
    source = disk;
    editor?.setValue(disk);
  }

  function revert() {
    epoch += 1;
    source = opened;
    editor?.setValue(opened);
    paramValues = {};
    growX = 1;
    growY = 1;
    selected = -1;
    shapeMenu = null;
    status = '';
  }

  async function persist(): Promise<boolean> {
    const token = epoch;
    if (!loaded || token !== epoch || canon(source) === canon(disk)) return true;
    const snapshot = source;
    const next = snapshot.replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n';
    saving = true;
    status = 'Enregistrement…';
    try {
      const response = await fetch('/api/elements', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file, source: next })
      });
      if (token !== epoch) return true;
      if (!response.ok) {
        status = 'Échec de l’enregistrement';
        return false;
      }
      if (source === snapshot) disk = snapshot;
      rememberLibraryFile(file);
      status = 'Enregistré';
      return true;
    } catch {
      if (token !== epoch) return true;
      status = 'Échec de l’enregistrement';
      return false;
    } finally {
      saving = false;
    }
  }

  function save(): Promise<boolean> {
    const run = tail.then(persist, persist);
    tail = run.then(() => true, () => false);
    return run;
  }

  function insert(kind: string) {
    const markup = shapeMarkup(kind, viewBoxOf(source));
    const offset = cursorOffset();
    write(insertMarkup(source, offset, markup));
    const tags = graphicTags(editor?.getValue() || source);
    selected = Math.max(0, tags.length - 1);
    const tag = tags[selected];
    if (tag) reveal(tag.start);
  }

  function paint(name: 'fill' | 'stroke', value: string) {
    if (selected < 0 || !value) return;
    const next = setAttr(source, selected, name, value);
    if (next === source) return;
    write(next);
  }

  function removeSelected() {
    if (selected < 0) return;
    write(removeTag(source, selected));
    selected = -1;
  }

  function fit() {
    const node = sheet?.querySelector('svg');
    if (!(node instanceof SVGSVGElement)) return;
    const box = node.getBBox();
    const pad = Math.max(box.width, box.height, 0.2) * 0.08;
    const round = (value: number) => String(Math.round(value * 1000) / 1000);
    write(setViewBox(source, `${round(box.x - pad)} ${round(box.y - pad)} ${round(box.width + pad * 2)} ${round(box.height + pad * 2)}`));
  }

  function shapeNodes(root: SVGSVGElement): Element[] {
    return [...root.querySelectorAll('*')].filter(node => node.id !== 'svg-edit' && !node.closest('#svg-edit'));
  }

  function pick(event: MouseEvent) {
    if (stretchOn) return;
    const node = event.target;
    const root = sheet?.querySelector('svg');
    if (!(node instanceof Element) || !(root instanceof SVGSVGElement) || node === root || node.closest('#svg-edit')) return;
    const index = shapeNodes(root).indexOf(node);
    if (index < 0) return;
    selected = index;
    const tag = graphicTags(source)[index];
    if (tag) reveal(tag.start);
  }

  function applyLive(node: Element, text: string, index: number) {
    const name = graphicTags(text)[index]?.name.toLowerCase();
    const put = (...names: string[]) => {
      for (const attr of names) {
        const value = attrOf(text, index, attr);
        if (value) node.setAttribute(attr, value);
      }
    };
    if (name === 'path') put('d');
    else if (name === 'polygon' || name === 'polyline') put('points');
    else if (name === 'line') put('x1', 'y1', 'x2', 'y2');
    else if (name === 'rect') put('x', 'y', 'width', 'height');
    else if (name === 'circle') put('cx', 'cy', 'r');
    else if (name === 'ellipse') put('cx', 'cy', 'rx', 'ry');
    else if (name === 'text') put('x', 'y');
  }

  function beginDrag(event: PointerEvent, index: number, knot: number, track = false) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const root = sheet?.querySelector('svg');
    const node = root ? shapeNodes(root)[index] : undefined;
    if (!(root instanceof SVGSVGElement) || !(node instanceof SVGGraphicsElement)) return;
    const start = editor?.getValue() || source;
    const placed = markerKnots(node, root);
    let working = start;
    const move = (pointer: PointerEvent) => {
      const matrix = (placed ? placed.host : node).getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(pointer.clientX, pointer.clientY).matrixTransform(matrix.inverse());
      const local = placed ? placed.local(point.x, point.y) : point;
      if (!local) return;
      working = track ? moveTrackPoint(start, index, knot, local.x, local.y) : moveKnot(start, index, knot, local.x, local.y);
      applyLive(node, working, index);
      paintOverlay(root, index, working);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (working !== start) write(working);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function close() {
    const parent = elementRel(file).split('/').slice(0, -1).join('/');
    void openNavItem(parent);
  }

  onMount(() => {
    const stopGate = registerEditorGate({ dirty: () => dirty, save, discard });
    const editors: XmlEditor[] = [];
    const stops: { dispose(): void }[] = [];
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled || !host) return;
      try {
        const monaco = await import('$lib/schema/monaco');
        if (cancelled || !host) return;
        const next = monaco.mountXml(host, source, onText);
        editor = next;
        editors.push(next);
        stops.push(next.onDidChangeCursorPosition(followCursor));
        followCursor();
      } catch (err) {
        error = err instanceof Error ? err.message : 'Éditeur indisponible';
      }
      if (!cancelled) editorReady = true;
    })();
    return () => {
      cancelled = true;
      stopGate();
      for (const stop of stops) stop.dispose();
      for (const item of editors) {
        item.getModel()?.dispose();
        item.dispose();
      }
      editor = null;
    };
  });

  function rootUnit(root: SVGSVGElement, pixels: number): number {
    const scale = root.getScreenCTM()?.a;
    return scale ? pixels / scale : pixels;
  }

  function toRoot(node: SVGGraphicsElement, root: SVGSVGElement, x: number, y: number): DOMPoint | null {
    const from = node.getScreenCTM();
    const to = root.getScreenCTM();
    if (!from || !to) return null;
    return new DOMPoint(x, y).matrixTransform(to.inverse().multiply(from));
  }

  /** Poignées d’un tracé de marqueur, posées sur la pointe réellement dessinée. */
  function markerKnots(node: SVGGraphicsElement, root: SVGSVGElement): { host: SVGGraphicsElement; at(x: number, y: number): DOMPoint | null; local(x: number, y: number): { x: number; y: number } | null } | null {
    const marker = node.closest('marker');
    if (!(marker instanceof SVGMarkerElement) || !marker.id) return null;
    const uses = (attr: string) => [...root.querySelectorAll(`[${attr}]`)].find(el => (el.getAttribute(attr) || '').includes(`#${marker.id})`));
    const host = uses('marker-end') || uses('marker-start');
    if (!(host instanceof SVGGraphicsElement) || host === node) return null;
    const where = uses('marker-end') ? 'end' : 'start';
    const spot = markerSpot(host, where);
    if (!spot) return null;
    const orient = marker.getAttribute('orient') || '0';
    let angle = Number(orient) * Math.PI / 180;
    if (orient === 'auto' || orient === 'auto-start-reverse') {
      angle = spot.angle;
      if (orient === 'auto-start-reverse' && where === 'start') angle += Math.PI;
    }
    const stroke = Number(host.getAttribute('stroke-width'));
    const unit = marker.getAttribute('markerUnits') === 'userSpaceOnUse' || !(stroke > 0) ? 1 : stroke;
    const box = marker.viewBox.baseVal;
    const sx = box.width > 0 ? Number(marker.getAttribute('markerWidth') || 3) * unit / box.width : unit;
    const sy = box.height > 0 ? Number(marker.getAttribute('markerHeight') || 3) * unit / box.height : unit;
    if (!(sx > 0) || !(sy > 0)) return null;
    const refX = marker.refX.baseVal.value;
    const refY = marker.refY.baseVal.value;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      host,
      at(x: number, y: number) {
        const dx = (x - refX) * sx;
        const dy = (y - refY) * sy;
        return toRoot(host, root, spot.x + dx * cos - dy * sin, spot.y + dx * sin + dy * cos);
      },
      local(x: number, y: number) {
        const dx = x - spot.x;
        const dy = y - spot.y;
        return { x: (dx * cos + dy * sin) / sx + refX, y: (-dx * sin + dy * cos) / sy + refY };
      }
    };
  }

  function markerSpot(host: SVGGraphicsElement, where: 'start' | 'end'): { x: number; y: number; angle: number } | null {
    if (host instanceof SVGPathElement) {
      const len = host.getTotalLength();
      if (!(len > 0)) return null;
      const step = Math.min(0.5, len / 2);
      const at = host.getPointAtLength(where === 'end' ? len : 0);
      const other = host.getPointAtLength(where === 'end' ? len - step : step);
      const angle = where === 'end' ? Math.atan2(at.y - other.y, at.x - other.x) : Math.atan2(other.y - at.y, other.x - at.x);
      return { x: at.x, y: at.y, angle };
    }
    if (host instanceof SVGLineElement) {
      const x1 = host.x1.baseVal.value;
      const y1 = host.y1.baseVal.value;
      const x2 = host.x2.baseVal.value;
      const y2 = host.y2.baseVal.value;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      return where === 'end' ? { x: x2, y: y2, angle } : { x: x1, y: y1, angle };
    }
    return null;
  }

  const NS = 'http://www.w3.org/2000/svg';

  function svgNode(parent: Element, name: string, attrs: Record<string, string | number>): SVGElement {
    const node = document.createElementNS(NS, name);
    for (const [attr, value] of Object.entries(attrs)) node.setAttribute(attr, String(value));
    parent.appendChild(node);
    return node;
  }

  function fmt(value: number): string {
    const n = Math.round(value * 1000) / 1000;
    return String(Object.is(n, -0) ? 0 : n);
  }

  type Box = { x: number; y: number; width: number; height: number };
  type Anchor = 'start' | 'middle' | 'end';

  function overlap(a: Box, b: Box): number {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }

  function badge(parent: Element, unit: number, x: number, y: number, label: string, anchor: Anchor): { box: Box; remove(): void } {
    const pill = svgNode(parent, 'rect', { rx: 3 * unit, fill: 'rgba(17, 24, 39, 0.85)' });
    const text = svgNode(parent, 'text', {
      x, y,
      'text-anchor': anchor,
      'dominant-baseline': 'central',
      'font-size': 11 * unit,
      'font-family': 'ui-monospace, SFMono-Regular, Consolas, monospace',
      fill: '#fde047'
    }) as SVGTextElement;
    text.textContent = label;
    const box = text.getBBox();
    const pad = 3 * unit;
    const placed = { x: box.x - pad, y: box.y - pad / 2, width: box.width + pad * 2, height: box.height + pad };
    pill.setAttribute('x', String(placed.x));
    pill.setAttribute('y', String(placed.y));
    pill.setAttribute('width', String(placed.width));
    pill.setAttribute('height', String(placed.height));
    return { box: placed, remove: () => { pill.remove(); text.remove(); } };
  }

  type Spot = [number, number, Anchor];

  /** Première position candidate qui reste dans le viewBox sans toucher les obstacles, sinon la moins gênante. */
  function place(parent: Element, unit: number, label: string, spots: Spot[], view: Box, taken: Box[]) {
    const margin = 2 * unit;
    let best: { spot: Spot; cost: number } | null = null;
    for (const spot of spots) {
      const trial = badge(parent, unit, spot[0], spot[1], label, spot[2]);
      const { box } = trial;
      trial.remove();
      const grown = { x: box.x - margin, y: box.y - margin, width: box.width + margin * 2, height: box.height + margin * 2 };
      const cost = taken.reduce((sum, other) => sum + overlap(grown, other), 0) + (box.width * box.height - overlap(box, view));
      if (!best || cost < best.cost) best = { spot, cost };
      if (cost < unit * unit) break;
    }
    if (best) taken.push(badge(parent, unit, best.spot[0], best.spot[1], label, best.spot[2]).box);
  }

  function authoredBox(root: SVGSVGElement): { x: number; y: number; w: number; h: number } | null {
    const stamped = root.getAttribute('data-frame');
    const parsed = stamped ? stretchBox(stamped) : null;
    if (parsed) return parsed;
    const view = root.viewBox.baseVal;
    if (!view || view.width <= 0 || view.height <= 0) return null;
    return { x: view.x, y: view.y, w: view.width, h: view.height };
  }

  function paintFrame(group: Element, root: SVGSVGElement) {
    const frameBox = authoredBox(root);
    if (!viewFocus || !frameBox) return;
    const unit = rootUnit(root, 1);
    const layer = svgNode(group, 'g', { 'pointer-events': 'none' });
    const { x, y, w, h } = frameBox;
    const weight = 2 * unit;
    svgNode(layer, 'rect', {
      x: x + weight / 2,
      y: y + weight / 2,
      width: Math.max(0, w - weight),
      height: Math.max(0, h - weight),
      fill: 'rgba(253, 224, 71, 0.12)',
      stroke: '#fde047',
      'stroke-width': weight
    });
    const axis = { stroke: '#fde047', 'stroke-width': unit, 'stroke-dasharray': `${5 * unit} ${4 * unit}`, opacity: 0.8 };
    const originX = x <= 0 && 0 <= x + w;
    const originY = y <= 0 && 0 <= y + h;
    if (originX) svgNode(layer, 'line', { x1: 0, y1: y, x2: 0, y2: y + h, ...axis });
    if (originY) svgNode(layer, 'line', { x1: x, y1: 0, x2: x + w, y2: 0, ...axis });
    const frame = { x, y, width: w, height: h };
    const taken: Box[] = [];
    const origin = originX && originY;
    if (origin) {
      taken.push({ x: -5 * unit, y: -5 * unit, width: 10 * unit, height: 10 * unit });
      const around: Spot[] = [
        [0, 16, 'middle'], [0, -16, 'middle'], [12, 0, 'start'], [-12, 0, 'end'],
        [9, 16, 'start'], [9, -16, 'start'], [-9, 16, 'end'], [-9, -16, 'end']
      ];
      place(layer, unit, '(0,0)', around.map(([dx, dy, anchor]) => [dx * unit, dy * unit, anchor]), frame, taken);
    }
    const inset = 8 * unit;
    const along = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
    const top = y + inset + 4 * unit;
    const bottom = y + h - inset - 4 * unit;
    place(layer, unit, `x ${fmt(x)}`, along.map(f => [x + inset, y + h * f, 'start']), frame, taken);
    place(layer, unit, `x ${fmt(x + w)}`, along.map(f => [x + w - inset, y + h * f, 'end']), frame, taken);
    place(layer, unit, `y ${fmt(y)}`, along.map(f => [x + w * f, top, 'middle']), frame, taken);
    place(layer, unit, `y ${fmt(y + h)}`, along.map(f => [x + w * f, bottom, 'middle']), frame, taken);
    if (origin) svgNode(layer, 'circle', { r: 4 * unit, fill: '#fde047', stroke: '#111827', 'stroke-width': unit });
  }

  function paintBands(group: Element, root: SVGSVGElement) {
    if (!bandFocus) return;
    const box = stretchBox(drawnAsset.viewBox);
    const spec = bandFocus === 'x' ? drawnAsset.stretch?.x : drawnAsset.stretch?.y;
    if (!box || !spec) return;
    const start = bandFocus === 'x' ? box.x : box.y;
    const end = bandFocus === 'x' ? box.x + box.w : box.y + box.h;
    const bands = parseStretch(spec, start, end);
    const frame = authoredBox(root);
    if (!frame) return;
    const target = bandFocus === 'x' ? frame.w : frame.h;
    const layout = layoutAxis(spec, start, end, target);
    if (!bands || layout.uniform) return;
    const unit = rootUnit(root, 1);
    for (const band of bands) {
      const a = layout.map(band.from);
      const b = layout.map(band.to);
      const node = document.createElementNS(NS, 'rect');
      const tint = band.mode === 'fixed' ? '#3b82f6' : band.mode === 'repeat' ? '#f59e0b' : '#22c55e';
      if (bandFocus === 'x') {
        node.setAttribute('x', String(Math.min(a, b)));
        node.setAttribute('y', String(frame.y));
        node.setAttribute('width', String(Math.abs(b - a)));
        node.setAttribute('height', String(frame.h));
      } else {
        node.setAttribute('x', String(frame.x));
        node.setAttribute('y', String(Math.min(a, b)));
        node.setAttribute('width', String(frame.w));
        node.setAttribute('height', String(Math.abs(b - a)));
      }
      node.setAttribute('fill', tint);
      node.setAttribute('fill-opacity', '0.28');
      node.setAttribute('stroke', tint);
      node.setAttribute('stroke-width', String(unit));
      node.setAttribute('pointer-events', 'none');
      group.appendChild(node);
    }
  }

  function paintOverlay(root: SVGSVGElement, index: number, text: string) {
    root.querySelector('#svg-edit')?.remove();
    const group = document.createElementNS(NS, 'g');
    group.id = 'svg-edit';
    root.appendChild(group);
    paintFrame(group, root);
    paintBands(group, root);
    if (!stretchOn) paintKnots(group, root, index, text);
    if (!group.childNodes.length) group.remove();
  }

  function commitShape(index: number, attrs: Record<string, string>) {
    let next = editor?.getValue() || source;
    const before = tagAttrs(next, index);
    for (const [key, value] of Object.entries(attrs)) {
      if ((before[key] ?? '') !== value) next = setAttr(next, index, key, value);
    }
    if (next !== (editor?.getValue() || source)) write(next);
  }

  function paintKnots(group: Element, root: SVGSVGElement, index: number, text: string) {
    releaseShape?.();
    releaseShape = null;
    const node = shapeNodes(root)[index];
    const knots = knotsOf(text, index);
    if (!(node instanceof SVGGraphicsElement) || !knots.length) return;
    const marker = node.closest('marker') ? markerKnots(node, root) : null;
    if (node.closest('marker') && !marker) return;
    const track = node.getAttribute('data-track') === '1';
    if (!track && group instanceof SVGGElement) {
      const tag = graphicTags(text)[index];
      if (!tag) return;
      releaseShape = bindShapeControls({
        root,
        node,
        group,
        tag: tag.name,
        attrs: tagAttrs(text, index),
        onSelect: () => {
          selected = index;
          if (tag) reveal(tag.start);
        },
        onEdit: (attrs, commit) => {
          if (commit) commitShape(index, attrs);
        }
      }).dispose;
      return;
    }
    const placed = knots.map(knot => ({ ...knot, at: marker ? marker.at(knot.x, knot.y) : toRoot(node, root, knot.x, knot.y) })).filter(knot => knot.at);
    if (!placed.length) return;
    const unit = rootUnit(root, 1);
    for (const knot of placed) {
      if (track || knot.role !== 'control' || !knot.at) continue;
      const anchor = placed.find(item => item.seg === knot.seg && item.role === 'anchor' && item.at);
      if (!anchor?.at) continue;
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(knot.at.x));
      line.setAttribute('y1', String(knot.at.y));
      line.setAttribute('x2', String(anchor.at.x));
      line.setAttribute('y2', String(anchor.at.y));
      line.setAttribute('stroke', '#fde047');
      line.setAttribute('stroke-width', String(unit));
      line.setAttribute('pointer-events', 'none');
      group.appendChild(line);
    }
    const shown = track ? placed.filter(knot => knot.role === 'anchor') : placed;
    shown.forEach((knot, knotIndex) => {
      if (!knot.at) return;
      const handle = document.createElementNS(NS, 'circle');
      const radius = rootUnit(root, knot.role === 'control' ? 4 : 6);
      handle.setAttribute('cx', String(knot.at.x));
      handle.setAttribute('cy', String(knot.at.y));
      handle.setAttribute('r', String(radius));
      handle.setAttribute('fill', knot.role === 'control' ? '#fde047' : '#ffffff');
      handle.setAttribute('stroke', '#111827');
      handle.setAttribute('stroke-width', String(unit));
      handle.setAttribute('cursor', 'grab');
      if (track) handle.setAttribute('data-track-knot', String(knotIndex));
      handle.addEventListener('pointerdown', event => beginDrag(event, index, knotIndex, track));
      handle.addEventListener('click', event => event.stopPropagation());
      if (track) handle.addEventListener('contextmenu', event => openShapeMenu(event, index, knotIndex));
      group.appendChild(handle);
    });
  }

  function pathLocal(node: SVGGraphicsElement, event: MouseEvent): { x: number; y: number } | null {
    const matrix = node.getScreenCTM();
    if (!matrix) return null;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const round = (value: number) => Math.round(value * 1000) / 1000;
    return { x: round(local.x), y: round(local.y) };
  }

  function openShapeMenu(event: MouseEvent, index: number, anchor: number | null) {
    const root = sheet?.querySelector('svg');
    const node = root ? shapeNodes(root)[index] : undefined;
    if (!(node instanceof SVGGraphicsElement)) return;
    const local = pathLocal(node, event);
    if (!local) return;
    event.preventDefault();
    event.stopPropagation();
    const text = editor?.getValue() || source;
    const tag = graphicTags(text)[index];
    const attrs = tagAttrs(text, index);
    const track = node.getAttribute('data-track') === '1';
    const isPath = tag?.name.toLowerCase() === 'path';
    const kind = isPath && !track ? pathKind(attrs.d || '', pathHint(attrs)) : null;
    const anchors = isPath ? trackAnchors(attrs.d || '') : [];
    const onPoint = anchor != null;
    selected = index;
    if (tag) reveal(tag.start);
    shapeMenu = {
      x: event.clientX,
      y: event.clientY,
      index,
      track,
      fill: attrs.fill || '',
      stroke: attrs.stroke || '',
      scope: onPoint && (track || isPath) ? 'point' : track || isPath ? 'path' : 'shape',
      kind,
      canAdd: !onPoint && (track || kind != null) && anchors.length >= 2,
      canRemove: onPoint && (track ? anchor > 0 && anchor < anchors.length - 1 : anchors.length > 2),
      addLabel: track ? 'Ajouter une poignée' : 'Ajouter un point',
      removeLabel: track ? 'Enlever cette poignée' : 'Enlever ce point',
      addAt: nearestSegment(anchors, local) + 1,
      addX: local.x,
      addY: local.y,
      remove: anchor
    };
  }

  function onShapeContext(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('[role="menu"]')) return;
    const knot = target.closest('[data-track-knot], [data-path-anchor]');
    if (knot && selected >= 0) {
      const anchor = Number(knot.getAttribute('data-track-knot') ?? knot.getAttribute('data-path-anchor'));
      openShapeMenu(event, selected, Number.isFinite(anchor) ? anchor : null);
      return;
    }
    if (target.closest('#svg-edit')) {
      if (selected >= 0) openShapeMenu(event, selected, null);
      else event.preventDefault();
      return;
    }
    const root = sheet?.querySelector('svg');
    const graphic = target.closest('path, polygon, polyline, rect, circle, ellipse, line, text');
    if (!(graphic instanceof Element) || !(root instanceof SVGSVGElement)) {
      event.preventDefault();
      return;
    }
    const index = shapeNodes(root).indexOf(graphic);
    if (index < 0) {
      event.preventDefault();
      return;
    }
    openShapeMenu(event, index, null);
  }

  function paintFromMenu(name: 'fill' | 'stroke', value: string) {
    const menu = shapeMenu;
    if (!menu) return;
    shapeMenu = { ...menu, [name]: value };
    selected = menu.index;
    paint(name, value);
  }

  function deleteFromMenu() {
    const menu = shapeMenu;
    shapeMenu = null;
    if (!menu) return;
    selected = menu.index;
    removeSelected();
  }

  function addFromMenu() {
    const menu = shapeMenu;
    shapeMenu = null;
    if (!menu) return;
    const text = editor?.getValue() || source;
    if (menu.track) {
      write(insertTrackPoint(text, menu.index, menu.addAt, menu.addX, menu.addY));
      return;
    }
    const attrs = tagAttrs(text, menu.index);
    const kind = menu.kind || 'smooth';
    commitShape(menu.index, stampPath(attrs, insertAnchor(attrs.d || '', kind, menu.addAt, menu.addX, menu.addY), kind));
  }

  function removeFromMenu() {
    const menu = shapeMenu;
    shapeMenu = null;
    if (!menu || menu.remove == null) return;
    const text = editor?.getValue() || source;
    if (menu.track) {
      write(removeTrackPoint(text, menu.index, menu.remove));
      return;
    }
    const attrs = tagAttrs(text, menu.index);
    const kind = menu.kind || 'smooth';
    commitShape(menu.index, stampPath(attrs, removeAnchor(attrs.d || '', kind, menu.remove), kind));
  }

  function kindFromMenu(kind: PathKind) {
    const menu = shapeMenu;
    if (!menu) return;
    const text = editor?.getValue() || source;
    const attrs = tagAttrs(text, menu.index);
    commitShape(menu.index, stampPath(attrs, setPathKind(attrs.d || '', kind), kind));
    shapeMenu = { ...menu, kind };
  }

  $effect(() => {
    preview;
    frameKey;
    board?.settle();
  });

  $effect(() => {
    const text = source;
    const index = selected;
    viewFocus;
    bandFocus;
    growX;
    growY;
    preview;
    layout;
    const root = sheet?.querySelector('svg');
    if (!(root instanceof SVGSVGElement)) return;
    const frame = requestAnimationFrame(() => {
      const live = sheet?.querySelector('svg');
      if (live instanceof SVGSVGElement) paintOverlay(live, index, text);
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
  <div class="flex shrink-0 items-center gap-3">
    <p class="text-sm text-body">{status}</p>
    <div class="ms-auto flex items-center gap-2">
      <Button size="sm" color="alternative" disabled={!loaded || saving || canon(source) === canon(opened)} onclick={revert}>Annuler</Button>
      <Button size="sm" color="brand" disabled={!dirty || saving} onclick={() => { void save(); }}>Sauver</Button>
      <Button size="sm" color="alternative" onclick={close}>Fermer</Button>
    </div>
  </div>
  {#if error}<p class="text-sm text-red-700">{error}</p>{/if}
  <SplitPane view="svg" class="min-h-0 flex-1">
    {#snippet left()}
    <div class="panel">
      <RawWait ready={editorReady} {error}>
        <div class="monaco" bind:this={host}></div>
      </RawWait>
    </div>
    {/snippet}
    {#snippet right()}
    <DrawingStage>
      {#snippet tools()}
        <DrawTools
          shapes={[...DRAW_SHAPES, TEXT_SHAPE]}
          fittable
          {fitHome}
          oninsert={insert}
          onfit={fit}
          onzoom={fitZoom}
        />
      {/snippet}
      {#snippet extra()}
      {#if tuned.length || stretchOn}
        <div class="params">
          {#each tuned as field (field.name)}
            {@const current = paramValues[field.name] ?? field.fallback}
            {#if isColorValue(field.fallback) || isColorValue(current)}
              <label class="param" title={field.name}>
                <span>{field.name}</span>
                <span class="swatch">
                  <span class="chip" style:background={hexForInput(current)}></span>
                  <input type="color" aria-label={field.name} value={hexForInput(current)} oninput={(event) => setParam(field.name, event.currentTarget.value)} />
                </span>
              </label>
            {:else if field.name === 'width'}
              <label class="param" title="Épaisseur du trait, en mètres">
                <span>width</span>
                <input type="range" min="0.04" max="0.4" step="0.01" value={current} aria-label="width" oninput={(event) => setParam(field.name, String(Math.round(Number(event.currentTarget.value) * 100) / 100))} />
              </label>
            {:else}
              <label class="param" title={field.name}>
                <span>{field.name}</span>
                <input type="text" aria-label={field.name} value={current} oninput={(event) => setParam(field.name, event.currentTarget.value)} />
              </label>
            {/if}
          {/each}
          {#if stretchOn}
            <label class="param" title="Largeur d'étirement">
              <span>largeur</span>
              <input type="range" min="0.5" max="4" step="0.05" value={growX} aria-label="Largeur d'étirement" oninput={(event) => { growX = Number(event.currentTarget.value); }} />
            </label>
            <label class="param" title="Hauteur d'étirement">
              <span>hauteur</span>
              <input type="range" min="0.5" max="4" step="0.05" value={growY} aria-label="Hauteur d'étirement" oninput={(event) => { growY = Number(event.currentTarget.value); }} />
            </label>
          {/if}
          <button type="button" class="reset" disabled={!paramsDirty && !stretchDirty} onclick={resetPreview}>Reset</button>
        </div>
      {/if}
      {/snippet}
      {#if !loaded}
        <div class="flex flex-1 items-center justify-center text-body"><LoadingIcon /></div>
      {/if}
      {#if loaded}
        <DrawingBoard
          bind:this={board}
          bind:sheet
          bind:lens
          bind:home={fitHome}
          bind:fitZoom
          ruled
          editing
          resetKey={frameKey}
          frameOf={fileFrame}
          onview={refreshOverlay}
          onclick={pick}
          oncontextmenu={onShapeContext}
        >{@html preview}</DrawingBoard>
      {/if}
    </DrawingStage>
    {/snippet}
  </SplitPane>
</div>

{#if shapeMenu}
  <ShapeMenu
    x={shapeMenu.x}
    y={shapeMenu.y}
    fill={shapeMenu.fill}
    stroke={shapeMenu.stroke}
    scope={shapeMenu.scope}
    kind={shapeMenu.kind}
    canAdd={shapeMenu.canAdd}
    canRemove={shapeMenu.canRemove}
    addLabel={shapeMenu.addLabel}
    removeLabel={shapeMenu.removeLabel}
    onpaint={paintFromMenu}
    ondelete={deleteFromMenu}
    onadd={addFromMenu}
    onremove={removeFromMenu}
    onkind={kindFromMenu}
  />
{/if}

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape') shapeMenu = null;
    const target = event.target;
    if (!(target instanceof Element) || !editor) return;
    if (target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor')) return;
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    const undo = key === 'z' && !event.shiftKey;
    const redo = key === 'y' || (key === 'z' && event.shiftKey);
    if (!undo && !redo) return;
    event.preventDefault();
    editor.trigger('keyboard', undo ? 'undo' : 'redo', null);
  }}
  onpointerdown={(event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[role="menu"]')) return;
    shapeMenu = null;
  }}
/>

<style>
  .panel {
    display: flex;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--color-default-medium);
    border-radius: var(--radius-base);
    background: var(--color-neutral-primary);
  }
  .monaco { flex: 1 1 auto; min-width: 0; min-height: 0; }
  .params {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    border-bottom: 1px solid var(--color-default-medium);
    background: var(--color-neutral-primary);
    padding: 0.3rem 0.45rem;
  }
  .param {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--color-heading);
    font-size: 0.75rem;
  }
  .reset {
    margin-left: auto;
    height: 1.6rem;
    border: 1px solid var(--color-default-medium);
    border-radius: 0.25rem;
    background: transparent;
    padding: 0 0.5rem;
    color: var(--color-heading);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .reset:hover:not(:disabled) { background: var(--color-neutral-secondary-medium); }
  .reset:disabled { color: var(--color-body); cursor: default; }
  .param input[type='range'] {
    width: 5.5rem;
    height: auto;
    border: 0;
    padding: 0;
    accent-color: #ca8a04;
  }
  .param input {
    width: 4.5rem;
    height: 1.6rem;
    border: 1px solid var(--color-default-medium);
    border-radius: 0.25rem;
    background: var(--color-neutral-primary);
    padding: 0 0.35rem;
    color: var(--color-heading);
    font-size: 0.8rem;
  }
  .swatch {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
  }
  .chip {
    width: 1.05rem;
    height: 1.05rem;
    border: 1px solid rgba(17, 24, 39, 0.35);
    border-radius: 0.2rem;
  }
  .chip.ring { border-width: 4px; background: transparent; }
  .swatch input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  .swatch input:disabled { cursor: default; }
</style>
