<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Button } from 'flowbite-svelte';
  import { registerEditorGate, unsavedAsk } from '$lib/workspace/editorLeave';
  import { applyParams, hexForInput, isColorValue, paramsOf } from '$lib/schema/params';
  import { readSvg } from '$lib/schema/svg';
  import { layoutAxis, parseStretch, stretchSvg, viewBoxOf as stretchBox } from '$lib/schema/stretch';
  import { attrOf, graphicTags, insertMarkup, knotsOf, moveKnot, removeTag, setAttr, setViewBox, shapeMarkup, tagAt, viewBoxOf, viewBoxRange } from '$lib/schema/svgEdit';
  import { elementRel } from '$lib/workspace/catalog';
  import LoadingIcon from './LoadingIcon.svelte';
  import RawWait from './RawWait.svelte';
  import SplitPane from './SplitPane.svelte';
  import { openNavItem } from '$lib/workspace/state';

  const SHAPES = [
    { kind: 'rect', label: 'Rectangle', d: 'M4 6h16v12H4z' },
    { kind: 'circle', label: 'Cercle', d: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z' },
    { kind: 'ellipse', label: 'Ellipse', d: 'M12 6.5a9 5.5 0 1 0 0 11a9 5.5 0 1 0 0-11z' },
    { kind: 'line', label: 'Ligne', d: 'M5 19 19 5' },
    { kind: 'polygon', label: 'Polygone', d: 'M12 4.5 20 18.5H4z' },
    { kind: 'path', label: 'Chemin', d: 'M4 18C8 3 16 21 20 6' },
    { kind: 'text', label: 'Texte', d: 'M6 5h12M12 5v14M9 19h6' }
  ];

  let { file }: { file: string } = $props();

  let source = $state('');
  let disk = $state('');
  let error = $state('');
  let status = $state('');
  let loaded = $state(false);
  let editorReady = $state(false);
  let saving = $state(false);
  let selected = $state(-1);
  let host = $state<HTMLDivElement | null>(null);
  let lens = $state<HTMLDivElement | null>(null);
  let sheet = $state<HTMLDivElement | null>(null);
  let zoom = $state(1);
  let fitted = $state<{ w: number; h: number } | null>(null);
  let viewFocus = $state(false);
  let bandFocus = $state<'x' | 'y' | null>(null);
  let growX = $state(1);
  let growY = $state(1);
  let paramValues = $state<Record<string, string>>({});
  let layout = $state(0);
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
    executeEdits(source: string, edits: { range: XmlRange; text: string }[]): void;
    onDidChangeCursorPosition(listener: () => void): { dispose(): void };
    getModel(): XmlModel | null;
    getPosition(): { lineNumber: number; column: number } | null;
    setPosition(position: { lineNumber: number; column: number }): void;
    revealPositionInCenter(position: { lineNumber: number; column: number }): void;
  };
  let editor: XmlEditor | null = null;

  function canon(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  }

  const dirty = $derived(loaded && canon(source) !== canon(disk));
  const fill = $derived(selected >= 0 ? attrOf(source, selected, 'fill') : '');
  const stroke = $derived(selected >= 0 ? attrOf(source, selected, 'stroke') : '');
  const shown = $derived(source.replace(/<script\b[\s\S]*?<\/script>/gi, ''));
  const drawnAsset = $derived(readSvg(shown));
  const stretchOn = $derived(Boolean(drawnAsset.stretch?.x || drawnAsset.stretch?.y));
  const fields = $derived(paramsOf(shown));
  const preview = $derived.by(() => {
    const chosen: Record<string, string> = {};
    for (const field of fields) chosen[field.name] = paramValues[field.name] ?? field.fallback;
    const filled = applyParams(shown, chosen);
    if (!stretchOn) return filled;
    const asset = readSvg(filled);
    const box = stretchBox(asset.viewBox);
    if (!box) return filled;
    const out = stretchSvg(
      { markup: asset.markup, viewBox: asset.viewBox, stretch: asset.stretch },
      box.w * growX,
      box.h * growY
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${out.viewBox}">${out.markup}</svg>`;
  });

  function setParam(name: string, value: string) {
    paramValues = { ...paramValues, [name]: value };
  }

  const paramsDirty = $derived(fields.some((field) => {
    const value = paramValues[field.name];
    return value !== undefined && value !== field.fallback;
  }));

  function resetParams() {
    paramValues = {};
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

  async function load() {
    loaded = false;
    error = '';
    const response = await fetch(`/api/elements?file=${encodeURIComponent(file)}`);
    const body = await response.json() as { source?: string; error?: string };
    if (!response.ok) {
      error = body.error || 'Lecture impossible';
      return;
    }
    source = disk = body.source || '';
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

  function beginDrag(event: PointerEvent, index: number, knot: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const root = sheet?.querySelector('svg');
    const node = root ? shapeNodes(root)[index] : undefined;
    if (!(root instanceof SVGSVGElement) || !(node instanceof SVGGraphicsElement)) return;
    const start = editor?.getValue() || source;
    let working = start;
    const move = (pointer: PointerEvent) => {
      const matrix = node.getScreenCTM();
      if (!matrix) return;
      const local = new DOMPoint(pointer.clientX, pointer.clientY).matrixTransform(matrix.inverse());
      working = moveKnot(start, index, knot, local.x, local.y);
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

  $effect(() => {
    const text = source;
    const asking = $unsavedAsk;
    if (!loaded || asking || canon(text) === canon(disk)) return;
    const timer = setTimeout(() => { void save(); }, 600);
    return () => clearTimeout(timer);
  });

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

  function paintFrame(group: Element, root: SVGSVGElement) {
    const view = root.viewBox.baseVal;
    if (!viewFocus || !view || view.width <= 0 || view.height <= 0) return;
    const unit = rootUnit(root, 1);
    const layer = svgNode(group, 'g', { 'pointer-events': 'none' });
    const { x, y, width: w, height: h } = view;
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
    const view = root.viewBox.baseVal;
    const target = bandFocus === 'x' ? view.width : view.height;
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
        node.setAttribute('y', String(view.y));
        node.setAttribute('width', String(Math.abs(b - a)));
        node.setAttribute('height', String(view.height));
      } else {
        node.setAttribute('x', String(view.x));
        node.setAttribute('y', String(Math.min(a, b)));
        node.setAttribute('width', String(view.width));
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

  function paintKnots(group: Element, root: SVGSVGElement, index: number, text: string) {
    const node = shapeNodes(root)[index];
    const knots = knotsOf(text, index);
    if (!(node instanceof SVGGraphicsElement) || !knots.length) return;
    const placed = knots.map(knot => ({ ...knot, at: toRoot(node, root, knot.x, knot.y) })).filter(knot => knot.at);
    if (!placed.length) return;
    const unit = rootUnit(root, 1);
    for (const knot of placed) {
      if (knot.role !== 'control' || !knot.at) continue;
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
    placed.forEach((knot, knotIndex) => {
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
      handle.addEventListener('pointerdown', event => beginDrag(event, index, knotIndex));
      handle.addEventListener('click', event => event.stopPropagation());
      group.appendChild(handle);
    });
  }

  $effect(() => {
    const node = lens;
    if (!node) return;
    const onWheel = (event: WheelEvent) => { void zoomAt(event); };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  });

  function zoomAt(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const node = lens;
    const board = sheet;
    if (!node || !board) return;
    const origin = fitted ?? { w: board.clientWidth, h: board.clientHeight };
    if (!origin.w || !origin.h) return;
    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= node.clientHeight;
    const next = Math.min(8, Math.max(0.4, zoom * Math.exp(-delta * 0.0018)));
    if (Math.abs(next - zoom) < 0.001) return;
    const ratio = next / zoom;
    const before = board.getBoundingClientRect();
    const pointX = event.clientX - before.left;
    const pointY = event.clientY - before.top;
    if (!fitted) fitted = origin;
    zoom = next;
    void tick().then(() => {
      const after = board.getBoundingClientRect();
      node.scrollLeft += after.left + pointX * ratio - event.clientX;
      node.scrollTop += after.top + pointY * ratio - event.clientY;
    });
  }

  $effect(() => {
    const node = lens;
    if (!node) return;
    const observer = new ResizeObserver(() => { layout += 1; });
    observer.observe(node);
    return () => observer.disconnect();
  });

  $effect(() => {
    const text = source;
    const index = selected;
    zoom;
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
    <div class="stage">
      <div class="tools">
        {#each SHAPES as shape (shape.kind)}
          <button type="button" title={shape.label} aria-label={shape.label} onclick={() => insert(shape.kind)}>
            {@render icon(shape.d)}
          </button>
        {/each}
        <span class="sep"></span>
        <label class="swatch" class:off={selected < 0} title="Remplissage">
          <span class="chip" style:background={fill || '#f59e0b'}></span>
          <input type="color" aria-label="Remplissage" value={fill || '#f59e0b'} disabled={selected < 0} oninput={(event) => paint('fill', event.currentTarget.value)} />
        </label>
        <label class="swatch" class:off={selected < 0} title="Contour">
          <span class="chip ring" style:border-color={stroke || '#b45309'}></span>
          <input type="color" aria-label="Contour" value={stroke || '#b45309'} disabled={selected < 0} oninput={(event) => paint('stroke', event.currentTarget.value)} />
        </label>
        <span class="sep"></span>
        <button type="button" title="Supprimer" aria-label="Supprimer" disabled={selected < 0} onclick={removeSelected}>
          {@render icon('M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3')}
        </button>
        <button type="button" title="Ajuster le viewBox" aria-label="Ajuster le viewBox" onclick={fit}>
          {@render icon('M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M9 9h6v6H9z')}
        </button>
        {#if stretchOn}
          <span class="sep"></span>
          <label class="range" title="Largeur d'étirement">
            <span>L</span>
            <input type="range" min="0.5" max="4" step="0.05" value={growX} aria-label="Largeur d'étirement" oninput={(event) => { growX = Number(event.currentTarget.value); }} />
          </label>
          <label class="range" title="Hauteur d'étirement">
            <span>H</span>
            <input type="range" min="0.5" max="4" step="0.05" value={growY} aria-label="Hauteur d'étirement" oninput={(event) => { growY = Number(event.currentTarget.value); }} />
          </label>
        {/if}
      </div>
      {#if fields.length}
        <div class="params">
          {#each fields as field (field.name)}
            {@const current = paramValues[field.name] ?? field.fallback}
            {#if isColorValue(field.fallback) || isColorValue(current)}
              <label class="param" title={field.name}>
                <span>{field.name}</span>
                <span class="swatch">
                  <span class="chip" style:background={hexForInput(current)}></span>
                  <input type="color" aria-label={field.name} value={hexForInput(current)} oninput={(event) => setParam(field.name, event.currentTarget.value)} />
                </span>
              </label>
            {:else}
              <label class="param" title={field.name}>
                <span>{field.name}</span>
                <input type="text" aria-label={field.name} value={current} oninput={(event) => setParam(field.name, event.currentTarget.value)} />
              </label>
            {/if}
          {/each}
          <button type="button" class="reset" disabled={!paramsDirty} onclick={resetParams}>Reset</button>
        </div>
      {/if}
      {#if !loaded}
        <div class="flex flex-1 items-center justify-center text-body"><LoadingIcon /></div>
      {/if}
      <div class="lens" class:hidden={!loaded} bind:this={lens}>
        <div
          class="sheet"
          style:width={fitted ? `${fitted.w * zoom}px` : '100%'}
          style:height={fitted ? `${fitted.h * zoom}px` : '100%'}
          bind:this={sheet}
          role="presentation"
          onclick={pick}
          onkeydown={() => {}}
        >{@html preview}</div>
      </div>
    </div>
    {/snippet}
  </SplitPane>
</div>

{#snippet icon(d: string)}
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path {d} /></svg>
{/snippet}

<style>
  .panel, .stage {
    display: flex;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--color-default-medium);
    border-radius: var(--radius-base);
    background: var(--color-neutral-primary);
  }
  .monaco { flex: 1 1 auto; min-width: 0; min-height: 0; }
  .stage { flex-direction: column; background: #166534; }
  .lens {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }
  .sheet {
    display: flex;
    flex: none;
    margin: auto;
    min-width: 0;
    min-height: 0;
  }
  .sheet :global(svg) { display: block; width: 100%; height: 100%; }
  .tools {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.2rem;
    overflow: auto;
    border-bottom: 1px solid var(--color-default-medium);
    background: var(--color-neutral-primary);
    padding: 0.3rem;
  }
  .tools button, .swatch {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border: 1px solid transparent;
    border-radius: 0.3rem;
    background: transparent;
    color: var(--color-heading);
  }
  .tools button:hover:not(:disabled), .swatch:not(.off):hover {
    border-color: var(--color-default-medium);
    background: var(--color-neutral-secondary-medium);
  }
  .tools button:disabled, .swatch.off { opacity: 0.4; }
  .sep {
    flex-shrink: 0;
    width: 1px;
    height: 1.2rem;
    margin: 0 0.15rem;
    background: var(--color-default-medium);
  }
  .range {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #f8fafc;
    font-size: 11px;
    font-weight: 600;
  }
  .range input { width: 72px; accent-color: #fde047; }
  .params {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.45rem;
    overflow: auto;
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
