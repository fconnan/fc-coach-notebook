<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { schemaFrame, spanCamera, type Camera } from '$lib/editor/board';
  import { insertAnchor, nearestSegment, pathAnchors, pathHint, pathKind, removeAnchor, setPathKind, stampPath, type PathKind } from '$lib/editor/pathEdit';
  import { bindShapeControls } from '$lib/editor/shapeHandles';
  import { fitShape, translateShape, type FittedShape, type ShapeAttrs } from '$lib/editor/shapeModel';
  import { ratioBox, type FitMode } from '$lib/schema/fit';
  import { readShape } from '$lib/schema/edit';
  import ShapeMenu from './ShapeMenu.svelte';
  import AnimationBar from './AnimationBar.svelte';
  import DrawingBoard from './DrawingBoard.svelte';
  import { ballRadius, ballTransform, playerTokenRadius } from '$lib/schema/ball';
  import { crispStrokes } from '$lib/schema/crisp';
  import { chrome } from '$lib/schema/scene';
  import { curvePath, type Point } from '$lib/trajectory';
  import { frameOfSize, stretchSvg } from '$lib/schema/stretch';
  import { parse } from 'yaml';
  import { draftOf, type TrajectoryDraft } from '$lib/schema/arrowDraft';
  import { liveElementPreview, liveExercisePreview, loadExercisePreview, type ExercisePreview, type TrajectoryOverlay } from '$lib/schema/preview';
  import type { SchemaDoc, TrajectorySpec } from '$lib/schema/types';
  import TrajectoryControls from './TrajectoryControls.svelte';

  let {
    at = '',
    exerciseId = '',
    element = false,
    elementId = '',
    compact = false,
    source = undefined as string | undefined,
    editable = false,
    selected = '',
    onpick = undefined as ((ref: string, focus?: boolean) => void) | undefined,
    onmove = undefined as ((ref: string, x: number, y: number) => void) | undefined,
    onmoves = undefined as ((
      moves: { ref: string; x: number; y: number }[],
      slides: { ref: string; dx: number; dy: number }[],
      shapes?: { ref: string; attrs: Record<string, string> }[]
    ) => void) | undefined,
    onknot = undefined as ((ref: string, role: 'start' | 'via' | 'end', index: number, x: number, y: number) => void) | undefined,
    onvia = undefined as ((ref: string, action: 'add' | 'remove', index: number, x?: number, y?: number) => void) | undefined,
    ontune = undefined as ((ref: string, key: 'wave' | 'amp', value: number) => void) | undefined,
    onrotate = undefined as ((ref: string, angle: number) => void) | undefined,
    onresize = undefined as ((ref: string, w: number | null, h: number | null, x?: number | null, y?: number | null) => void) | undefined,
    onlook = undefined as ((point: { x: number; y: number }) => void) | undefined,
    onfooter = undefined as ((bar: Snippet | undefined) => void) | undefined,
    onshape = undefined as ((ref: string, attrs: Record<string, string>, tag?: string) => void) | undefined,
    onpaint = undefined as ((ref: string, name: 'fill' | 'stroke', value: string) => void) | undefined,
    onforget = undefined as ((ref: string | string[]) => void) | undefined,
    fitHome = $bindable(true),
    fitZoom = $bindable<(() => void) | undefined>(undefined)
  }: {
    at?: string;
    exerciseId?: string;
    element?: boolean;
    elementId?: string;
    compact?: boolean;
    source?: string;
    editable?: boolean;
    selected?: string;
    onpick?: (ref: string, focus?: boolean) => void;
    onmove?: (ref: string, x: number, y: number) => void;
    onmoves?: (
      moves: { ref: string; x: number; y: number }[],
      slides: { ref: string; dx: number; dy: number }[],
      shapes?: { ref: string; attrs: Record<string, string> }[]
    ) => void;
    onknot?: (ref: string, role: 'start' | 'via' | 'end', index: number, x: number, y: number) => void;
    onvia?: (ref: string, action: 'add' | 'remove', index: number, x?: number, y?: number) => void;
    ontune?: (ref: string, key: 'wave' | 'amp', value: number) => void;
    onrotate?: (ref: string, angle: number) => void;
    onresize?: (ref: string, w: number | null, h: number | null, x?: number | null, y?: number | null) => void;
    onlook?: (point: { x: number; y: number }) => void;
    /** Publie la barre d’animation pour qu’elle se place sous la zone de dessin. */
    onfooter?: (bar: Snippet | undefined) => void;
    onshape?: (ref: string, attrs: Record<string, string>, tag?: string) => void;
    onpaint?: (ref: string, name: 'fill' | 'stroke', value: string) => void;
    onforget?: (ref: string | string[]) => void;
    fitHome?: boolean;
    fitZoom?: () => void;
  } = $props();

  let preview = $state<ExercisePreview | null>(null);
  let shownFor = $state('');
  let error = $state('');
  let phase = $state(0);
  let progress = $state(0);
  let playing = $state(false);
  let grabbing = $state(false);
  let lensEl = $state<HTMLDivElement | null>(null);
  let sheetEl = $state<HTMLDivElement | null>(null);
  let board = $state<{ settle(retry?: boolean): void; nudge(pin: { lx: number; ly: number; worldX: number; worldY: number }): void } | null>(null);
  /** Point du monde qui doit rester sous le curseur après le prochain dessin. */
  let hold: { lx: number; ly: number; worldX: number; worldY: number; at: number } | null = null;
  type Spot = { role: string; index: number; x: number; y: number };
  type Member = {
    ref: string;
    arrow: boolean;
    x: number;
    y: number;
    ox: number;
    oy: number;
    sx: number;
    sy: number;
    relative: boolean;
    spots: Spot[];
  };
  type ShapeMove = {
    ref: string;
    tag: string;
    node: SVGGraphicsElement;
    attrs: ShapeAttrs;
  };
  let drag: {
    ref: string;
    canMove: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
    sx: number;
    sy: number;
    relative: boolean;
    mode: 'move' | 'rotate' | 'resize' | 'knot' | 'band' | 'box';
    edge?: string;
    box?: { minX: number; minY: number; maxX: number; maxY: number };
    fitted?: {
      kind: 'shape' | 'player' | 'ball' | 'mark';
      node: SVGGraphicsElement;
      tag: string;
      attrs: ShapeAttrs;
      ux: number;
      uy: number;
      fit: FitMode;
    };
    role: 'start' | 'via' | 'end';
    index: number;
    axis: 'x' | 'y' | 'xy';
    ax: number;
    ay: number;
    angle: number;
    vx: number;
    vy: number;
    vw: number;
    vh: number;
    mw: number;
    mh: number;
    grabX: number;
    grabY: number;
    worldX: number;
    worldY: number;
    members: Member[];
    shapes: ShapeMove[];
    /** Réf du ballon inclus dans le bloc, pour que son dessin suive le geste. */
    art: string;
  } | null = null;
  /** Sélection du dessin. Le premier est celui que le YAML suit. */
  let marks = $state<string[]>([]);
  let primary = '';
  let band = $state<{ left: number; top: number; width: number; height: number } | null>(null);

  const token = $derived(source === undefined ? (exerciseId || at) : `live:${exerciseId || at}`);
  const active = $derived(preview && shownFor === token ? preview : null);
  const arrowOn = $derived(element && elementId.startsWith('arrow.'));
  let track = $state<TrajectoryDraft | null>(null);
  let tunedFor = $state('');
  const trackBase = $derived.by(() => {
    if (!arrowOn) return null;
    try {
      const doc = source ? parse(source) as SchemaDoc : null;
      return draftOf(doc && typeof doc === 'object' ? doc : null);
    } catch {
      return draftOf(null);
    }
  });
  const trackShown = $derived(track ?? trackBase);
  const svg = $derived(active ? active.render(phase, progress, editable, arrowOn && track && trackBase ? overlayOf(track, trackBase) : undefined) : '');
  const phases = $derived(active?.phases || []);

  $effect(() => {
    if (elementId === tunedFor) return;
    tunedFor = elementId;
    track = null;
  });

  function overlayOf(value: TrajectoryDraft, base: TrajectoryDraft): TrajectoryOverlay {
    const trajectory: TrajectorySpec = {};
    const params: Record<string, string | number> = {};
    if (value.motif !== base.motif) trajectory.motif = value.motif;
    if (Math.abs(value.wave - base.wave) > 1e-6) trajectory.wave = value.wave;
    if (Math.abs(value.amp - base.amp) > 1e-6) trajectory.amp = value.amp;
    if (Math.abs(value.phase - base.phase) > 1e-6) trajectory.phase = value.phase;
    if (value.side !== base.side) trajectory.side = value.side;
    if (Math.abs(value.taper - base.taper) > 1e-6) trajectory.taper = value.taper;
    if (value.ink !== base.ink) params.ink = value.ink;
    if (Math.abs(value.width - base.width) > 1e-6) params.width = value.width;
    if (value.dash !== base.dash) params.dash = value.dash;
    return { trajectory, params };
  }

  $effect(() => {
    const path = at;
    const id = exerciseId;
    const live = source;
    const key = live === undefined ? (id || path) : `live:${id || path}`;
    if (!key) return;
    let cancelled = false;
    const task = element ? liveElementPreview(live || '', elementId) : live === undefined ? loadExercisePreview(path, id) : liveExercisePreview(live, path, id);
    void task.then(next => {
      if (cancelled) return;
      preview = next;
      shownFor = key;
      error = '';
      if (live === undefined || phase >= next.phases.length) {
        phase = 0;
        progress = 0;
        playing = false;
      }
    }).catch(err => {
      if (cancelled) return;
      if (live === undefined && shownFor === key) return;
      preview = null;
      shownFor = '';
      error = err instanceof Error ? err.message : 'Schéma illisible';
    });
    return () => { cancelled = true; };
  });

  $effect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const steps = phases;
      if (!steps.length) {
        last = now;
        return;
      }
      const duration = (steps[phase]?.duration || 4) * 1000;
      const delta = last ? now - last : 0;
      last = now;
      const next = progress + delta / duration;
      if (next >= 1) {
        progress = 0;
        phase = (phase + 1) % steps.length;
      } else {
        progress = next;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  function showPhase(index: number) {
    playing = false;
    phase = index;
    progress = 1;
  }

  function togglePlay() {
    if (!phases.length) return;
    playing = !playing;
    if (playing) progress = 0;
  }

  function resetAnimation() {
    playing = false;
    phase = 0;
    progress = 0;
  }

  $effect(() => {
    const publish = onfooter;
    if (!publish) return;
    publish(compact ? undefined : animationBar);
    return () => publish(undefined);
  });

  function worldAt(event: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const svgNode = sheetEl?.querySelector('svg');
    if (!(svgNode instanceof SVGSVGElement)) return null;
    const point = svgNode.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svgNode.getScreenCTM();
    if (!matrix) return null;
    const local = point.matrixTransform(matrix.inverse());
    const left = Number(svgNode.dataset.left || 0);
    const top = Number(svgNode.dataset.top || 0);
    const length = Number(svgNode.dataset.length || 0);
    return { x: local.x - left, y: top + length - local.y };
  }

  function samplePreset(root: SVGSVGElement, lensW: number, lensH: number): Camera | null {
    if (elementId.startsWith('sample.') && !root.querySelector('.fc-pitch')) return spanCamera(10, lensW, lensH);
    return null;
  }

  function refreshInk() {
    const root = sheetEl?.querySelector('svg');
    if (root instanceof SVGSVGElement) crispStrokes(root);
    if (marks.length >= 1) placeSelection();
  }

  function shift(ref: string, x: number, y: number, stick = true) {
    const root = sheetEl;
    if (!root) return;
    const nodes = [...root.querySelectorAll(`[data-ref="${CSS.escape(ref)}"]`)];
    const handle = nodes.find(node => node.hasAttribute('data-handle'));
    const ball = root.querySelector('[data-ball]');
    if (stick && handle && ball instanceof SVGElement && handle.hasAttribute('cx')) {
      const bx = Number(ball.getAttribute('data-x') ?? ball.getAttribute('cx'));
      const by = Number(ball.getAttribute('data-y') ?? ball.getAttribute('cy'));
      const cx = Number(handle.getAttribute('cx'));
      const cy = Number(handle.getAttribute('cy'));
      const dx = bx - cx;
      const dy = by - cy;
      const near = Math.hypot(dx, dy);
      let closest = near;
      for (const node of root.querySelectorAll('circle[data-handle]')) {
        const distance = Math.hypot(bx - Number(node.getAttribute('cx')), by - Number(node.getAttribute('cy')));
        if (distance < closest) closest = distance;
      }
      const token = root.querySelector(`[data-kind="player"][data-pick="${CSS.escape(handle.getAttribute('data-ref') || '')}"]`);
      const playerR = Number(token?.getAttribute('data-radius')) || playerTokenRadius;
      const ballR = Number(ball.getAttribute('data-radius')) || ballRadius;
      const gap = playerR + ballR * 0.4;
      if (near <= closest + playerR * 0.05 && near < gap + playerR * 0.35) {
        const nextX = x + dx;
        const nextY = y + dy;
        ball.setAttribute('data-x', String(nextX));
        ball.setAttribute('data-y', String(nextY));
        ball.setAttribute('transform', ballTransform(nextX, nextY, Number(ball.getAttribute('data-radius')) || undefined, Number(ball.getAttribute('data-radius-y')) || undefined));
      }
    }
    for (const node of nodes) {
      if (!(node instanceof SVGElement)) continue;
      if (node.tagName === 'circle') {
        node.setAttribute('cx', String(x));
        node.setAttribute('cy', String(y));
      } else if (node.tagName === 'rect') {
        node.setAttribute('x', String(x + Number(node.getAttribute('data-dx') || 0)));
        node.setAttribute('y', String(y + Number(node.getAttribute('data-dy') || 0)));
      } else if (node.getAttribute('data-kind') === 'mark') {
        const angle = node.getAttribute('data-angle') || '0';
        node.setAttribute('data-x', String(x));
        node.setAttribute('data-y', String(y));
        node.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
      } else {
        node.setAttribute('transform', `translate(${x} ${y})`);
      }
    }
  }

  function localOf(angle: number, ax: number, ay: number, world: { x: number; y: number }): { x: number; y: number } {
    const t = angle * Math.PI / 180;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const dx = world.x - ax;
    const dy = world.y - ay;
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  }

  function lengthFrom(edge: number, origin: number, extent: number, horizontal: boolean): number {
    const floor = Math.max(extent * 0.15, 0.05);
    if (horizontal) {
      const far = origin + extent;
      if (Math.abs(far) < 1e-4) return Math.max(floor, Math.abs(edge));
      return Math.max(floor, edge * extent / far);
    }
    const share = extent ? (0 - origin) / extent : 0;
    if (Math.abs(share) < 1e-4) return Math.max(floor, Math.abs(edge));
    return Math.max(floor, edge / share);
  }

  function paintSize(group: SVGElement, w: number, h: number) {
    const vx = Number(group.getAttribute('data-vx'));
    const vy = Number(group.getAttribute('data-vy'));
    const vw = Number(group.getAttribute('data-vw'));
    const vh = Number(group.getAttribute('data-vh'));
    const mold = group.querySelector('[data-mold]');
    const ink = group.querySelector('[data-ink]');
    if (!(mold instanceof SVGElement) || !(ink instanceof SVGElement) || !(vw > 0) || !(vh > 0)) return;
    const xRule = group.getAttribute('data-stretch-x') || undefined;
    const yRule = group.getAttribute('data-stretch-y') || undefined;
    const ux = Number(group.getAttribute('data-ux')) || 1;
    const uy = Number(group.getAttribute('data-uy')) || 1;
    const drawn = stretchSvg({
      markup: mold.innerHTML,
      viewBox: `${vx} ${vy} ${vw} ${vh}`,
      stretch: { x: xRule, y: yRule }
    }, w / ux, h / uy);
    ink.innerHTML = drawn.markup;
    const min = Number(group.getAttribute('data-min')) || 0;
    const span = Number(group.getAttribute('data-span')) || 0;
    const factor = min > 0 && span > 0 ? Math.max(1, (min * span) / Math.max(w, h)) : 1;
    const u = Number(group.getAttribute('data-u')) || 1;
    group.setAttribute('data-glyph', String(factor));
    const draw = group.querySelector('[data-draw]');
    if (draw instanceof SVGElement) draw.setAttribute('transform', `scale(${factor * ux} ${-factor * uy})`);
    const pad = chrome.pad * u;
    const frame = frameOfSize({ x: vx, y: vy, w: vw, h: vh }, w, h);
    const rect = group.querySelector('[data-frame]');
    const left = frame.x * factor - pad;
    const bottom = frame.y * factor - pad;
    const width = frame.w * factor + pad * 2;
    const height = frame.h * factor + pad * 2;
    if (rect instanceof SVGElement) {
      rect.setAttribute('x', String(left));
      rect.setAttribute('y', String(bottom));
      rect.setAttribute('width', String(width));
      rect.setAttribute('height', String(height));
    }
    const size = chrome.handle * u;
    const place = (axis: string, cx: number, cy: number) => {
      const node = group.querySelector(`[data-resize="${axis}"]`);
      if (!(node instanceof SVGElement)) return;
      node.setAttribute('x', String(cx - size / 2));
      node.setAttribute('y', String(cy - size / 2));
    };
    place('x', left + width, bottom + height / 2);
    place('y', left + width / 2, bottom + height);
    place('xy', left + width, bottom + height);
    const knob = group.querySelector('[data-rotate] circle[cy]');
    if (knob instanceof SVGElement) knob.setAttribute('cy', String(bottom + height + (chrome.knob + chrome.knobGap) * u));
    group.setAttribute('data-mw', String(w));
    group.setAttribute('data-mh', String(h));
  }

  function knotGroup(ref: string): Element | null {
    return sheetEl?.querySelector(`[data-knots="${CSS.escape(ref)}"]`) ?? null;
  }

  function knotPoints(group: Element): Point[] {
    const nodes = [...group.querySelectorAll('[data-role]')];
    const start = nodes.find(node => node.getAttribute('data-role') === 'start');
    const end = nodes.find(node => node.getAttribute('data-role') === 'end');
    const vias = nodes
      .filter(node => node.getAttribute('data-role') === 'via')
      .sort((a, b) => Number(a.getAttribute('data-index')) - Number(b.getAttribute('data-index')));
    return [start, ...vias, end].flatMap(node => {
      if (!(node instanceof Element)) return [];
      return [{ x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')) }];
    });
  }

  function pointSegment(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = dx * dx + dy * dy;
    const t = len > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
  }

  function segmentNear(points: Point[], world: Point): number {
    let best = 0;
    let dist = Infinity;
    for (let i = 0; i < points.length - 1; i += 1) {
      const gap = pointSegment(world, points[i], points[i + 1]);
      if (gap < dist) {
        dist = gap;
        best = i;
      }
    }
    return best;
  }

  function storedAt(ref: string, world: Point): Point {
    const group = knotGroup(ref);
    const ox = Number(group?.getAttribute('data-ox') || 0);
    const oy = Number(group?.getAttribute('data-oy') || 0);
    const sx = Number(group?.getAttribute('data-sx') || 0);
    const sy = Number(group?.getAttribute('data-sy') || 0);
    if (group?.getAttribute('data-rel') !== '1') return { x: world.x - ox, y: world.y - oy };
    return { x: sx ? (world.x - ox) / sx : 0, y: sy ? (world.y - oy) / sy : 0 };
  }

  function paintKnot(ref: string, role: string, index: number, world: Point) {
    const group = knotGroup(ref);
    if (!(group instanceof SVGGElement)) return;
    const circle = [...group.querySelectorAll('[data-knot]')].find(node =>
      node.getAttribute('data-role') === role && Number(node.getAttribute('data-index')) === index
    );
    if (circle instanceof SVGCircleElement) {
      circle.setAttribute('cx', String(world.x));
      circle.setAttribute('cy', String(world.y));
    }
    let ghost = group.querySelector('[data-ghost]');
    if (!(ghost instanceof SVGPathElement)) {
      ghost = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      ghost.setAttribute('data-ghost', '1');
      ghost.setAttribute('fill', 'none');
      ghost.setAttribute('class', 'fc-picked');
      ghost.setAttribute('stroke', '#ccff00');
      ghost.setAttribute('stroke-dasharray', '0.35 0.22');
      ghost.setAttribute('stroke-width', '0.12');
      ghost.setAttribute('pointer-events', 'none');
      group.insertBefore(ghost, group.firstChild);
    }
    ghost.setAttribute('d', curvePath(knotPoints(group)));
  }

  function down(event: PointerEvent) {
    if (!editable || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    const grip = target?.closest('[data-box-handle]');
    if (grip instanceof SVGElement && marks.length === 1) {
      event.preventDefault();
      try { sheetEl?.setPointerCapture(event.pointerId); } catch { /* le pointeur n’est plus actif */ }
      startBox(event, grip.getAttribute('data-box-handle') || '', marks[0]);
      return;
    }
    const knot = target?.closest('[data-knot]');
    if (knot) {
      const role = knot.getAttribute('data-role');
      const ref = knot.closest('[data-knots]')?.getAttribute('data-knots') || '';
      if (!ref || (role !== 'start' && role !== 'via' && role !== 'end')) return;
      event.preventDefault();
      try { sheetEl?.setPointerCapture(event.pointerId); } catch { /* le pointeur n’est plus actif */ }
      playing = false;
      progress = 0;
      drag = {
        ref,
        canMove: true,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
        ox: 0,
        oy: 0,
        sx: 0,
        sy: 0,
        relative: false,
        mode: 'knot',
        role,
        index: Number(knot.getAttribute('data-index') || 0),
        axis: 'xy',
        ax: 0,
        ay: 0,
        angle: 0,
        vx: 0,
        vy: 0,
        vw: 0,
        vh: 0,
        mw: 0,
        mh: 0,
        grabX: 0,
        grabY: 0,
        worldX: 0,
        worldY: 0,
        members: [],
        shapes: [],
        art: ''
      };
      onpick?.(ref, false);
      return;
    }
    if (target?.closest('[data-selection]') && marks.length > 1) {
      startBlock(event);
      return;
    }
    const node = target?.closest('[data-pick], [data-ref]');
    const ref = node?.getAttribute('data-pick') || node?.getAttribute('data-ref') || '';
    const drawn = target?.closest('[data-kind="svg"]');
    const grouped = !!ref && marks.includes(ref) && marks.length > 1;
    if (drawn instanceof SVGGraphicsElement && ref && drawn.getAttribute('data-pick') === ref && !grouped) {
      event.preventDefault();
      playing = false;
      progress = 0;
      primary = ref;
      marks = [ref];
      onpick?.(ref, false);
      shapeEpoch += 1;
      mountShape(ref, source || '', sheetEl);
      boundShape?.grab(event);
      return;
    }
    if (!ref) {
      event.preventDefault();
      try { sheetEl?.setPointerCapture(event.pointerId); } catch { /* le pointeur n’est plus actif */ }
      drag = {
        ref: '',
        canMove: false,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
        ox: 0,
        oy: 0,
        sx: 0,
        sy: 0,
        relative: false,
        mode: 'band',
        role: 'end',
        index: 0,
        axis: 'xy',
        ax: 0,
        ay: 0,
        angle: 0,
        vx: 0,
        vy: 0,
        vw: 0,
        vh: 0,
        mw: 0,
        mh: 0,
        grabX: 0,
        grabY: 0,
        worldX: 0,
        worldY: 0,
        members: [],
        shapes: [],
        art: ''
      };
      return;
    }
    event.preventDefault();
    try { sheetEl?.setPointerCapture(event.pointerId); } catch { /* le pointeur n’est plus actif */ }
    playing = false;
    if (!target?.closest('[data-kind="arrow"]')) phase = 0;
    progress = 0;
    const rotating = !!target?.closest('[data-rotate]');
    const resizing = target?.closest('[data-resize]')?.getAttribute('data-resize') || '';
    const handle = node?.hasAttribute('data-handle')
      ? node
      : sheetEl?.querySelector(`[data-handle][data-ref="${CSS.escape(ref)}"]`);
    const group = sheetEl?.querySelector(`[data-kind="mark"][data-ref="${CSS.escape(ref)}"]`);
    const ax = Number(group?.getAttribute('data-x') || handle?.getAttribute('data-x') || 0);
    const ay = Number(group?.getAttribute('data-y') || handle?.getAttribute('data-y') || 0);
    const angle = Number(group?.getAttribute('data-angle') || 0);
    const world = worldAt(event);
    const local = world ? localOf(angle, ax, ay, world) : { x: 0, y: 0 };
    const vx = Number(group?.getAttribute('data-vx') || 0);
    const vy = Number(group?.getAttribute('data-vy') || 0);
    const vw = Number(group?.getAttribute('data-vw') || 0);
    const vh = Number(group?.getAttribute('data-vh') || 0);
    const mw = Number(group?.getAttribute('data-mw') || vw);
    const mh = Number(group?.getAttribute('data-mh') || vh);
    const glyph = Number(group?.getAttribute('data-glyph')) || 1;
    const edge = vw > 0 && vh > 0 ? frameOfSize({ x: vx, y: vy, w: vw, h: vh }, mw, mh) : null;
    const localReal = { x: local.x / glyph, y: local.y / glyph };
    drag = {
      ref,
      canMove: !!handle && !rotating && !resizing,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      ox: Number(handle?.getAttribute('data-ox') || 0),
      oy: Number(handle?.getAttribute('data-oy') || 0),
      sx: Number(group?.getAttribute('data-sx') || handle?.getAttribute('data-sx') || 0),
      sy: Number(group?.getAttribute('data-sy') || handle?.getAttribute('data-sy') || 0),
      relative: (group?.getAttribute('data-rel') || handle?.getAttribute('data-rel')) === '1',
      mode: rotating ? 'rotate' : resizing === 'x' || resizing === 'y' || resizing === 'xy' ? 'resize' : 'move',
      role: 'end',
      index: 0,
      axis: resizing === 'x' || resizing === 'y' || resizing === 'xy' ? resizing : 'xy',
      ax,
      ay,
      angle,
      vx,
      vy,
      vw,
      vh,
      mw,
      mh,
      grabX: edge ? localReal.x - (edge.x + edge.w) : 0,
      grabY: edge ? localReal.y - (edge.y + edge.h) : 0,
      worldX: world?.x ?? 0,
      worldY: world?.y ?? 0,
      members: [],
      shapes: [],
      art: ''
    };
    const block = !rotating && !resizing && marks.includes(ref) && marks.length > 1 ? collectBlock(marks) : null;
    if (block && (block.members.length || block.shapes.length)) {
      drag.mode = 'move';
      drag.canMove = true;
      drag.members = block.members;
      drag.shapes = block.shapes;
      drag.art = ballIn(block.members);
    } else if (drag.mode === 'move' && drag.canMove) {
      primary = ref;
      marks = [ref];
    }
    onpick?.(ref, false);
  }

  function choose(refs: string[]) {
    marks = refs;
    primary = refs[0] || '';
    if ((selected || '') !== primary) onpick?.(primary, false);
  }

  function memberOf(ref: string): Member | null {
    const root = sheetEl;
    if (!root) return null;
    const arrow = root.querySelector(`[data-kind="arrow"][data-pick="${CSS.escape(ref)}"]`);
    if (arrow) {
      const knots = root.querySelector(`[data-knots="${CSS.escape(ref)}"]`);
      const spots = [...(knots?.querySelectorAll('[data-role]') ?? [])].flatMap(node => {
        const x = Number(node.getAttribute('cx'));
        const y = Number(node.getAttribute('cy'));
        if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
        return [{ role: node.getAttribute('data-role') || '', index: Number(node.getAttribute('data-index') || 0), x, y }];
      });
      return {
        ref,
        arrow: true,
        x: 0,
        y: 0,
        ox: Number(knots?.getAttribute('data-ox') || 0),
        oy: Number(knots?.getAttribute('data-oy') || 0),
        sx: Number(knots?.getAttribute('data-sx') || 0),
        sy: Number(knots?.getAttribute('data-sy') || 0),
        relative: knots?.getAttribute('data-rel') === '1',
        spots
      };
    }
    const handle = root.querySelector(`[data-handle][data-ref="${CSS.escape(ref)}"]`);
    const group = root.querySelector(`[data-kind="mark"][data-ref="${CSS.escape(ref)}"], [data-kind="player"][data-ref="${CSS.escape(ref)}"]`);
    if (!handle && !(group instanceof SVGElement)) return null;
    const translated = group instanceof SVGElement ? group.getAttribute('transform')?.match(/translate\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/) : null;
    return {
      ref,
      arrow: false,
      x: Number(group?.getAttribute('data-x') || handle?.getAttribute('cx') || translated?.[1] || 0),
      y: Number(group?.getAttribute('data-y') || handle?.getAttribute('cy') || translated?.[2] || 0),
      ox: Number(handle?.getAttribute('data-ox') || 0),
      oy: Number(handle?.getAttribute('data-oy') || 0),
      sx: Number(group?.getAttribute('data-sx') || handle?.getAttribute('data-sx') || 0),
      sy: Number(group?.getAttribute('data-sy') || handle?.getAttribute('data-sy') || 0),
      relative: (group?.getAttribute('data-rel') || handle?.getAttribute('data-rel')) === '1',
      spots: []
    };
  }

  function collectBlock(refs: string[]): { members: Member[]; shapes: ShapeMove[] } {
    const members: Member[] = [];
    const shapes: ShapeMove[] = [];
    const text = source || '';
    const root = sheetEl;
    for (const id of refs) {
      const node = root?.querySelector(`[data-kind="svg"][data-pick="${CSS.escape(id)}"]`);
      if (node instanceof SVGGraphicsElement) {
        const shape = readShape(text, id);
        if (!shape) continue;
        shapes.push({ ref: id, tag: shape.tag, node, attrs: { ...shape.attrs } });
        continue;
      }
      const member = memberOf(id);
      if (member) members.push(member);
    }
    return { members, shapes };
  }

  function startBlock(event: PointerEvent) {
    const world = worldAt(event);
    const block = collectBlock(marks);
    if (!world || (!block.members.length && !block.shapes.length)) return;
    event.preventDefault();
    try { sheetEl?.setPointerCapture(event.pointerId); } catch { /* le pointeur n’est plus actif */ }
    playing = false;
    progress = 0;
    clearShape();
    drag = {
      ref: marks[0] || '',
      canMove: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      ox: 0,
      oy: 0,
      sx: 0,
      sy: 0,
      relative: false,
      mode: 'move',
      role: 'end',
      index: 0,
      axis: 'xy',
      ax: 0,
      ay: 0,
      angle: 0,
      vx: 0,
      vy: 0,
      vw: 0,
      vh: 0,
      mw: 0,
      mh: 0,
      grabX: 0,
      grabY: 0,
      worldX: world.x,
      worldY: world.y,
      members: block.members,
      shapes: block.shapes,
      art: ballIn(block.members)
    };
  }

  function ballIn(members: Member[]): string {
    const ball = sheetEl?.querySelector('[data-ball]');
    if (!(ball instanceof SVGElement)) return '';
    const x = Number(ball.getAttribute('data-x'));
    const y = Number(ball.getAttribute('data-y'));
    const found = members.find(member => !member.arrow && Math.hypot(member.x - x, member.y - y) < 0.05);
    return found?.ref || '';
  }

  function placeBallArt(x: number, y: number) {
    const ball = sheetEl?.querySelector('[data-ball]');
    if (!(ball instanceof SVGElement)) return;
    const radius = Number(ball.getAttribute('data-radius')) || undefined;
    const radiusY = Number(ball.getAttribute('data-radius-y')) || radius;
    ball.setAttribute('data-x', String(x));
    ball.setAttribute('data-y', String(y));
    ball.setAttribute('transform', ballTransform(x, y, radius, radiusY));
  }

  function paintShapeAttrs(node: SVGElement, attrs: ShapeAttrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'curve' || key === 'fit' || !value) continue;
      node.setAttribute(key, value);
    }
  }

  function rootBounds(node: SVGGraphicsElement, root: SVGSVGElement): { minX: number; minY: number; maxX: number; maxY: number } | null {
    let box: DOMRect;
    try { box = node.getBBox(); }
    catch { return null; }
    if (!(box.width > 0) || !(box.height > 0)) return null;
    const from = node.getScreenCTM();
    const to = root.getScreenCTM();
    if (!from || !to) return null;
    const into = to.inverse().multiply(from);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]) {
      const point = new DOMPoint(x, y).matrixTransform(into);
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return { minX, minY, maxX, maxY };
  }

  const BOX_CURSOR: Record<string, string> = {
    nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
    se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize'
  };

  function graphicOf(root: ParentNode, ref: string): SVGGraphicsElement | null {
    const nodes = [...root.querySelectorAll(`[data-pick="${CSS.escape(ref)}"]`)]
      .filter((node): node is SVGGraphicsElement => node instanceof SVGGraphicsElement);
    const drawn = nodes.find(node => node.getAttribute('data-kind') === 'svg' || node.getAttribute('data-kind') === 'arrow' || node.getAttribute('data-kind') === 'mark' || node.tagName === 'g');
    if (drawn) return drawn;
    const ball = root.querySelector('[data-ball]');
    const ring = nodes.find(node => node.tagName === 'circle');
    if (ball instanceof SVGGraphicsElement && ring) {
      const near = Math.hypot(Number(ball.getAttribute('data-x')) - Number(ring.getAttribute('cx')), Number(ball.getAttribute('data-y')) - Number(ring.getAttribute('cy')));
      if (near < 0.2) return ball;
    }
    return nodes[0] ?? null;
  }

  function worldBoxOf(node: SVGGraphicsElement): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const root = sheetEl?.querySelector('svg');
    if (!(root instanceof SVGSVGElement)) return null;
    const box = rootBounds(node, root);
    if (!box) return null;
    const left = Number(root.dataset.left || 0);
    const top = Number(root.dataset.top || 0);
    const length = Number(root.dataset.length || 0);
    return {
      minX: box.minX - left,
      maxX: box.maxX - left,
      minY: top + length - box.maxY,
      maxY: top + length - box.minY
    };
  }

  function resizedBox(
    start: { minX: number; minY: number; maxX: number; maxY: number },
    edge: string,
    world: { x: number; y: number }
  ) {
    const min = 0.08;
    const next = { ...start };
    if (edge.includes('e')) next.maxX = Math.max(start.minX + min, world.x);
    if (edge.includes('w')) next.minX = Math.min(start.maxX - min, world.x);
    if (edge.includes('n')) next.maxY = Math.max(start.minY + min, world.y);
    if (edge.includes('s')) next.minY = Math.min(start.maxY - min, world.y);
    return next;
  }

  function paintFitted(node: SVGGraphicsElement, fitted: FittedShape): SVGGraphicsElement {
    let host = node;
    if (host.tagName.toLowerCase() !== fitted.tag) {
      const next = document.createElementNS('http://www.w3.org/2000/svg', fitted.tag) as SVGGraphicsElement;
      for (const attr of host.attributes) {
        if (attr.name === 'cx' || attr.name === 'cy' || attr.name === 'r' || attr.name === 'rx' || attr.name === 'ry') continue;
        next.setAttribute(attr.name, attr.value);
      }
      host.replaceWith(next);
      host = next;
    }
    paintShapeAttrs(host, fitted.attrs);
    return host;
  }

  function applyBox(
    current: NonNullable<typeof drag>,
    next: { minX: number; minY: number; maxX: number; maxY: number }
  ): FittedShape | null {
    const fitted = current.fitted;
    const start = current.box;
    if (!fitted || !start || !(start.maxX - start.minX) || !(start.maxY - start.minY)) return null;
    let sx = (next.maxX - next.minX) / (start.maxX - start.minX);
    let sy = (next.maxY - next.minY) / (start.maxY - start.minY);
    const edge = current.edge || '';
    if (fitted.tag === 'circle' || fitted.fit !== 'free') {
      const scale = (edge.includes('n') || edge.includes('s')) && !edge.includes('e') && !edge.includes('w') ? sy : sx;
      sx = scale;
      sy = scale;
    }
    const cx = (next.minX + next.maxX) / 2;
    const cy = (next.minY + next.maxY) / 2;
    if (fitted.kind === 'shape') {
      let anchorX = start.minX;
      let anchorY = start.minY;
      if (edge.includes('w')) anchorX = start.maxX;
      else if (!edge.includes('e')) anchorX = (start.minX + start.maxX) / 2;
      if (edge.includes('s')) anchorY = start.maxY;
      else if (!edge.includes('n')) anchorY = (start.minY + start.maxY) / 2;
      const shaped = fitShape(fitted.tag, fitted.attrs, anchorX, anchorY, sx, sy);
      fitted.node = paintFitted(fitted.node, shaped);
      return shaped;
    }
    if (fitted.kind === 'ball') {
      const rx = fitted.ux * sx;
      const ry = fitted.uy * sy;
      fitted.node.setAttribute('data-x', String(cx));
      fitted.node.setAttribute('data-y', String(cy));
      fitted.node.setAttribute('data-radius', String(rx));
      fitted.node.setAttribute('data-radius-y', String(ry));
      fitted.node.setAttribute('transform', ballTransform(cx, cy, rx, ry));
    } else {
      const angle = fitted.node.getAttribute('data-angle');
      fitted.node.setAttribute('data-x', String(cx));
      fitted.node.setAttribute('data-y', String(cy));
      fitted.node.setAttribute('transform', angle != null ? `translate(${cx} ${cy}) rotate(${angle})` : `translate(${cx} ${cy})`);
      const inner = fitted.node.querySelector(':scope > g');
      if (inner instanceof SVGElement) inner.setAttribute('transform', `scale(${fitted.ux * sx} ${fitted.uy * sy})`);
    }
    const ring = sheetEl?.querySelector(`circle[data-pick="${CSS.escape(current.ref)}"]`);
    if (ring instanceof SVGElement) {
      ring.setAttribute('cx', String(cx));
      ring.setAttribute('cy', String(cy));
      ring.setAttribute('r', String(Math.max(next.maxX - next.minX, next.maxY - next.minY) / 2));
    }
    return null;
  }

  function startBox(event: PointerEvent, edge: string, ref: string) {
    const root = sheetEl;
    const graphic = root ? graphicOf(root, ref) : null;
    if (!graphic || graphic.getAttribute('data-kind') === 'arrow') return;
    const fit = selectionFit(graphic);
    if (fit === 'none') return;
    const box = worldBoxOf(graphic);
    if (!box) return;
    const kindAttr = graphic.getAttribute('data-kind');
    const kind = graphic.hasAttribute('data-ball') ? 'ball' : kindAttr === 'svg' ? 'shape' : kindAttr === 'player' ? 'player' : 'mark';
    const read = kind === 'shape' && source ? readShape(source, ref) : null;
    const attrs = read?.attrs ?? {};
    let ux = 1;
    let uy = 1;
    if (kind === 'ball') {
      ux = Number(graphic.getAttribute('data-radius')) || (box.maxX - box.minX) / 2;
      uy = Number(graphic.getAttribute('data-radius-y')) || ux;
    } else if (kind !== 'shape') {
      const transform = graphic.querySelector(':scope > g')?.getAttribute('transform') || '';
      const match = /scale\(\s*([-\d.eE+]+)(?:[\s,]+([-\d.eE+]+))?\s*\)/.exec(transform);
      ux = match ? Number(match[1]) || 1 : 1;
      uy = match ? Number(match[2] ?? match[1]) || 1 : -1;
    }
    playing = false;
    progress = 0;
    drag = {
      ref,
      canMove: false,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      ox: 0, oy: 0, sx: 0, sy: 0, relative: false,
      mode: 'box',
      role: 'end',
      index: 0,
      axis: 'xy',
      ax: 0, ay: 0, angle: 0,
      vx: 0, vy: 0, vw: 0, vh: 0, mw: 0, mh: 0, grabX: 0, grabY: 0,
      worldX: 0, worldY: 0,
      members: [], shapes: [], art: '',
      edge,
      box,
      fitted: { kind, node: graphic, tag: read?.tag || graphic.tagName.toLowerCase(), attrs, ux, uy, fit }
    };
  }

  /** Cercle dessiné : toujours étirable, jamais déformable. Les autres objets suivent data-fit, absent vaut none. */
  function selectionFit(node: SVGGraphicsElement): FitMode {
    if (node.tagName.toLowerCase() === 'circle' && node.getAttribute('data-kind') === 'svg') return 'ratio';
    const value = node.getAttribute('data-fit');
    return value === 'free' || value === 'ratio' ? value : 'none';
  }

  function nextBox(
    current: NonNullable<typeof drag>,
    world: { x: number; y: number }
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (!current.box || !current.edge) return current.box ?? null;
    const lock = current.fitted?.tag === 'circle' || current.fitted?.fit !== 'free';
    return lock ? ratioBox(current.box, current.edge, world) : resizedBox(current.box, current.edge, world);
  }

  /** Rectangle autour de la sélection, dans le repère du svg. Une sélection seule porte les huit poignées. */
  function placeSelection() {
    const root = sheetEl?.querySelector('svg');
    if (!(root instanceof SVGSVGElement) || !sheetEl) return;
    const host = root.querySelector('#svg-selection');
    if (!marks.length) {
      host?.remove();
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ref of marks) {
      const node = graphicOf(sheetEl, ref);
      if (!node) continue;
      const box = rootBounds(node, root);
      if (!box) continue;
      minX = Math.min(minX, box.minX);
      minY = Math.min(minY, box.minY);
      maxX = Math.max(maxX, box.maxX);
      maxY = Math.max(maxY, box.maxY);
    }
    if (!Number.isFinite(minX)) {
      host?.remove();
      return;
    }
    const scale = Math.abs(root.getScreenCTM()?.a || 1) || 1;
    const pad = 8 / scale;
    const group = host instanceof SVGGElement ? host : document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = 'svg-selection';
    group.setAttribute('data-selection', '1');
    const lone = marks.length === 1 ? graphicOf(sheetEl, marks[0]) : null;
    const handles = lone && lone.getAttribute('data-kind') !== 'arrow' && selectionFit(lone) !== 'none';
    const multi = marks.length > 1;
    group.replaceChildren();
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', multi ? 'rgba(204, 255, 0, 0.18)' : 'none');
    rect.setAttribute('stroke', '#ccff00');
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('vector-effect', 'non-scaling-stroke');
    rect.setAttribute('pointer-events', multi ? 'all' : 'none');
    if (multi) rect.setAttribute('cursor', 'move');
    rect.setAttribute('x', String(minX - pad));
    rect.setAttribute('y', String(minY - pad));
    rect.setAttribute('width', String(maxX - minX + pad * 2));
    rect.setAttribute('height', String(maxY - minY + pad * 2));
    group.appendChild(rect);
    if (handles) {
      const left = minX - pad;
      const right = maxX + pad;
      const top = minY - pad;
      const bottom = maxY + pad;
      const midX = (left + right) / 2;
      const midY = (top + bottom) / 2;
      const size = 8 / scale;
      const spots: [string, number, number][] = [
        ['nw', left, top], ['n', midX, top], ['ne', right, top], ['e', right, midY],
        ['se', right, bottom], ['s', midX, bottom], ['sw', left, bottom], ['w', left, midY]
      ];
      for (const [edge, x, y] of spots) {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        handle.setAttribute('data-box-handle', edge);
        handle.setAttribute('x', String(x - size / 2));
        handle.setAttribute('y', String(y - size / 2));
        handle.setAttribute('width', String(size));
        handle.setAttribute('height', String(size));
        handle.setAttribute('fill', '#ccff00');
        handle.setAttribute('stroke', '#111827');
        handle.setAttribute('stroke-width', '1.25');
        handle.setAttribute('vector-effect', 'non-scaling-stroke');
        handle.setAttribute('style', `cursor:${BOX_CURSOR[edge]}`);
        group.appendChild(handle);
      }
    }
    root.appendChild(group);
  }

  function slideArrow(member: Member, dx: number, dy: number) {
    const group = sheetEl?.querySelector(`[data-kind="arrow"][data-pick="${CSS.escape(member.ref)}"]`);
    if (group instanceof SVGElement) group.setAttribute('transform', `translate(${dx} ${dy})`);
    const knots = knotGroup(member.ref);
    if (!knots) return;
    for (const spot of member.spots) {
      const node = [...knots.querySelectorAll('[data-role]')].find(item =>
        item.getAttribute('data-role') === spot.role && Number(item.getAttribute('data-index')) === spot.index
      );
      if (!node) continue;
      node.setAttribute('cx', String(spot.x + dx));
      node.setAttribute('cy', String(spot.y + dy));
    }
  }

  function picksInside(x0: number, y0: number, x1: number, y1: number): string[] {
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);
    const found: string[] = [];
    const root = sheetEl;
    if (!root) return found;
    for (const node of root.querySelectorAll('[data-pick]')) {
      const ref = node.getAttribute('data-pick') || '';
      if (!ref || found.includes(ref)) continue;
      const box = node.getBoundingClientRect();
      if (box.width < 1 && box.height < 1) continue;
      if (box.right < left || box.left > right || box.bottom < top || box.top > bottom) continue;
      found.push(ref);
    }
    return found;
  }

  function paintBand(x: number, y: number) {
    const lens = lensEl?.getBoundingClientRect();
    if (!lens) return;
    const left = Math.min(drag?.startX ?? x, x) - lens.left;
    const top = Math.min(drag?.startY ?? y, y) - lens.top;
    band = {
      left,
      top,
      width: Math.abs(x - (drag?.startX ?? x)),
      height: Math.abs(y - (drag?.startY ?? y))
    };
  }

  function aim(ax: number, ay: number, x: number, y: number): number {
    const dx = x - ax;
    const dy = y - ay;
    if (Math.hypot(dx, dy) < 0.15) return 0;
    let angle = Math.atan2(-dx, dy) * 180 / Math.PI;
    for (const card of [0, 90, 180, -90]) {
      let delta = angle - card;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      if (Math.abs(delta) <= 8) return card;
    }
    return Math.round(angle * 10) / 10;
  }

  function turn(ref: string, x: number, y: number) {
    const current = drag;
    const group = sheetEl?.querySelector(`[data-kind="mark"][data-ref="${CSS.escape(ref)}"]`);
    if (!current || !(group instanceof SVGElement)) return;
    const angle = aim(current.ax, current.ay, x, y);
    group.setAttribute('data-angle', String(angle));
    group.setAttribute('transform', `translate(${current.ax} ${current.ay}) rotate(${angle})`);
  }

  function resize(ref: string, world: { x: number; y: number }, current = drag) {
    const group = sheetEl?.querySelector(`[data-kind="mark"][data-ref="${CSS.escape(ref)}"]`);
    if (!current || !(group instanceof SVGElement)) return null;
    const glyph = Number(group.getAttribute('data-glyph')) || 1;
    const local = localOf(current.angle, current.ax, current.ay, world);
    const x = local.x / glyph;
    const y = local.y / glyph;
    const w = current.axis === 'y' ? current.mw : lengthFrom(x - current.grabX, current.vx, current.vw, true);
    const h = current.axis === 'x' ? current.mh : lengthFrom(y - current.grabY, current.vy, current.vh, false);
    paintSize(group, w, h);
    return { w, h };
  }

  function move(event: PointerEvent) {
    const current = drag;
    if (current?.mode === 'band') {
      if (!current.moved) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 4) return;
        current.moved = true;
      }
      paintBand(event.clientX, event.clientY);
      return;
    }
    if (current?.mode === 'box') {
      if (!current.moved) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 3) return;
        current.moved = true;
        grabbing = true;
      }
      const world = worldAt(event);
      if (!world || !current.box || !current.edge) return;
      const next = nextBox(current, world);
      if (next) applyBox(current, next);
      placeSelection();
      return;
    }
    if (current?.mode === 'knot') {
      if (!current.moved) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 4) return;
        current.moved = true;
        grabbing = true;
      }
      const world = worldAt(event);
      if (!world) return;
      paintKnot(current.ref, current.role, current.index, world);
      return;
    }
    if (current?.mode === 'rotate' || current?.mode === 'resize') {
      if (!current.moved) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 4) return;
        current.moved = true;
        grabbing = true;
      }
      const world = worldAt(event);
      if (!world) return;
      if (current.mode === 'resize') resize(current.ref, world);
      else turn(current.ref, world.x, world.y);
      return;
    }
    if (!current?.canMove) return;
    if (!current.moved) {
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 4) return;
      current.moved = true;
      grabbing = true;
    }
    const world = worldAt(event);
    if (!world) return;
    if (current.members.length || current.shapes.length) {
      const dx = world.x - current.worldX;
      const dy = world.y - current.worldY;
      for (const member of current.members) {
        if (member.arrow) slideArrow(member, dx, dy);
        else shift(member.ref, member.x + dx, member.y + dy, false);
        if (member.ref === current.art) placeBallArt(member.x + dx, member.y + dy);
      }
      for (const shape of current.shapes) paintShapeAttrs(shape.node, translateShape(shape.tag, shape.attrs, dx, dy));
      placeSelection();
      return;
    }
    shift(current.ref, world.x, world.y);
  }

  function up(event: PointerEvent) {
    const current = drag;
    drag = null;
    grabbing = false;
    try {
      if (sheetEl?.hasPointerCapture(event.pointerId)) sheetEl.releasePointerCapture(event.pointerId);
    } catch { /* le pointeur n’est plus actif */ }
    if (!current) return;
    if (current.mode === 'box') {
      if (current.moved && current.box && current.edge && current.fitted) {
        const world = worldAt(event);
        const next = world ? nextBox(current, world) : current.box;
        if (!next) return;
        const shaped = applyBox(current, next);
        if (current.fitted.kind === 'shape' && shaped) {
          if (shaped.tag !== current.fitted.tag) {
            const nextRef = current.ref.replace(/[^/]+$/, shaped.tag);
            primary = nextRef;
            marks = [nextRef];
          }
          onshape?.(current.ref, shaped.attrs, shaped.tag);
        }
        else if (current.fitted.kind !== 'shape') {
          const across = current.edge.includes('e') || current.edge.includes('w');
          const along = current.edge.includes('n') || current.edge.includes('s');
          const moved = current.fitted.kind === 'player' || current.fitted.kind === 'ball';
          onresize?.(
            current.ref,
            across ? next.maxX - next.minX : null,
            along ? next.maxY - next.minY : null,
            moved && across ? (next.minX + next.maxX) / 2 : null,
            moved && along ? (next.minY + next.maxY) / 2 : null
          );
        }
      }
      return;
    }
    if (current.mode === 'band') {
      band = null;
      if (!current.moved) {
        primary = '';
        marks = [];
        onpick?.('');
      } else {
        choose(picksInside(current.startX, current.startY, event.clientX, event.clientY));
      }
      return;
    }
    if (!current.moved) {
      onpick?.(current.ref, true);
      return;
    }
    const world = worldAt(event);
    if (current.mode === 'knot') {
      if (!world) return;
      const stored = storedAt(current.ref, world);
      onknot?.(current.ref, current.role, current.index, stored.x, stored.y);
      return;
    }
    if (current.mode === 'rotate') {
      if (!world) return;
      onrotate?.(current.ref, aim(current.ax, current.ay, world.x, world.y));
      return;
    }
    if (current.mode === 'resize') {
      if (!world) return;
      const sized = resize(current.ref, world, current);
      if (!sized) return;
      const w = current.relative ? (current.sx ? sized.w / current.sx : null) : sized.w;
      const h = current.relative ? (current.sy ? sized.h / current.sy : null) : sized.h;
      onresize?.(current.ref, current.axis === 'y' ? null : w, current.axis === 'x' ? null : h);
      return;
    }
    if (!world) return;
    const lens = lensEl;
    if (lens) {
      const rect = lens.getBoundingClientRect();
      hold = {
        lx: event.clientX - rect.left,
        ly: event.clientY - rect.top,
        worldX: world.x,
        worldY: world.y,
        at: performance.now()
      };
    }
    if (current.members.length || current.shapes.length) {
      const dx = world.x - current.worldX;
      const dy = world.y - current.worldY;
      const moves: { ref: string; x: number; y: number }[] = [];
      const slides: { ref: string; dx: number; dy: number }[] = [];
      for (const member of current.members) {
        if (member.arrow) {
          slides.push({
            ref: member.ref,
            dx: member.relative ? (member.sx ? dx / member.sx : 0) : dx,
            dy: member.relative ? (member.sy ? dy / member.sy : 0) : dy
          });
        } else {
          moves.push({
            ref: member.ref,
            x: member.relative ? (member.sx ? (member.x + dx - member.ox) / member.sx : 0) : member.x + dx - member.ox,
            y: member.relative ? (member.sy ? (member.y + dy - member.oy) / member.sy : 0) : member.y + dy - member.oy
          });
        }
      }
      const shapes = current.shapes.map(shape => ({
        ref: shape.ref,
        attrs: translateShape(shape.tag, shape.attrs, dx, dy)
      }));
      onmoves?.(moves, slides, shapes);
      return;
    }
    const x = current.relative ? (current.sx ? (world.x - current.ox) / current.sx : 0) : world.x - current.ox;
    const y = current.relative ? (current.sy ? (world.y - current.oy) / current.sy : 0) : world.y - current.oy;
    onmove?.(current.ref, x, y);
  }

  function twice(event: MouseEvent) {
    if (!editable) return;
    const target = event.target instanceof Element ? event.target : null;
    const knot = target?.closest('[data-knot]');
    if (knot) {
      if (knot.getAttribute('data-role') !== 'via') return;
      const ref = knot.closest('[data-knots]')?.getAttribute('data-knots') || '';
      if (!ref) return;
      event.preventDefault();
      onvia?.(ref, 'remove', Number(knot.getAttribute('data-index') || 0));
      return;
    }
    const arrow = target?.closest('[data-kind="arrow"]');
    if (!arrow) return;
    const ref = arrow.getAttribute('data-pick') || '';
    const world = worldAt(event);
    const group = ref ? knotGroup(ref) : null;
    if (!ref || !world || !group) return;
    event.preventDefault();
    const stored = storedAt(ref, world);
    onpick?.(ref, true);
    onvia?.(ref, 'add', segmentNear(knotPoints(group), world), stored.x, stored.y);
  }

  function readNum(node: Element, name: string, fallback: number): number {
    const raw = node.getAttribute(name);
    if (raw == null || raw === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  function nearestVia(group: Element, world: Point): number | null {
    let best: number | null = null;
    let dist = Infinity;
    for (const node of group.querySelectorAll('[data-role="via"]')) {
      const gap = Math.hypot(world.x - Number(node.getAttribute('cx')), world.y - Number(node.getAttribute('cy')));
      if (gap < dist) {
        dist = gap;
        best = Number(node.getAttribute('data-index') || 0);
      }
    }
    return best;
  }

  function shapeNodeOf(event: MouseEvent): { node: SVGGraphicsElement; ref: string } | null {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return null;
    const direct = target.closest('[data-kind="svg"]');
    if (direct instanceof SVGGraphicsElement) {
      const ref = direct.getAttribute('data-pick') || '';
      if (ref) return { node: direct, ref };
    }
    if (target.closest('[data-shape-ui]') && boundShape?.node.isConnected) return { node: boundShape.node, ref: boundShape.ref };
    return null;
  }

  function localOn(node: SVGGraphicsElement, event: MouseEvent): { x: number; y: number } | null {
    const matrix = node.getScreenCTM()?.inverse();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    const round = (value: number) => Math.round(value * 1000) / 1000;
    return { x: round(point.x), y: round(point.y) };
  }

  function openShapeMenu(event: MouseEvent) {
    const hit = shapeNodeOf(event);
    const shape = hit ? readShape(source || '', hit.ref) : null;
    if (!hit || !shape) return false;
    event.preventDefault();
    event.stopPropagation();
    primary = hit.ref;
    marks = [hit.ref];
    onpick?.(hit.ref, false);
    const local = localOn(hit.node, event);
    const anchors = shape.tag === 'path' ? pathAnchors(shape.attrs.d || '') : [];
    const kind = shape.tag === 'path' ? pathKind(shape.attrs.d || '', pathHint(shape.attrs)) : null;
    const target = event.target instanceof Element ? event.target : null;
    const anchorAttr = target?.closest('[data-path-anchor]')?.getAttribute('data-path-anchor');
    const onPoint = anchorAttr != null && Number.isFinite(Number(anchorAttr));
    shapeMenu = {
      x: event.clientX,
      y: event.clientY,
      ref: hit.ref,
      fill: shape.attrs.fill || '',
      stroke: shape.attrs.stroke || '',
      scope: kind != null && onPoint ? 'point' : kind != null ? 'path' : 'shape',
      kind,
      canAdd: kind != null && !onPoint && !!local && anchors.length >= 2,
      canRemove: kind != null && onPoint && anchors.length > 2,
      addAt: local && anchors.length ? nearestSegment(anchors, local) + 1 : 1,
      addX: local?.x || 0,
      addY: local?.y || 0,
      remove: onPoint ? Number(anchorAttr) : null
    };
    return true;
  }

  function shapeAttrs() {
    const current = shapeMenu;
    if (!current) return null;
    return readShape(source || '', current.ref);
  }

  function paintFromMenu(name: 'fill' | 'stroke', value: string) {
    const current = shapeMenu;
    if (!current) return;
    shapeMenu = { ...current, [name]: value };
    onpaint?.(current.ref, name, value);
  }

  function forgetFromMenu() {
    const ref = shapeMenu?.ref;
    shapeMenu = null;
    if (ref) onforget?.(ref);
  }

  function dropSelection(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      menu = null;
      shapeMenu = null;
      return;
    }
    if (event.key !== 'Delete' || !editable || !marks.length) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor')) return;
    event.preventDefault();
    const refs = [...marks];
    primary = selected;
    marks = [];
    menu = null;
    shapeMenu = null;
    onpick?.('');
    onforget?.(refs);
  }

  function addFromShape() {
    const current = shapeMenu;
    const shape = shapeAttrs();
    if (!current?.kind || !shape) return;
    const d = insertAnchor(shape.attrs.d || '', current.kind, current.addAt, current.addX, current.addY);
    onshape?.(current.ref, stampPath(shape.attrs, d, current.kind));
    shapeMenu = null;
  }

  function removeFromShape() {
    const current = shapeMenu;
    const shape = shapeAttrs();
    if (!current?.kind || current.remove == null || !shape) return;
    const d = removeAnchor(shape.attrs.d || '', current.kind, current.remove);
    onshape?.(current.ref, stampPath(shape.attrs, d, current.kind));
    shapeMenu = null;
  }

  function kindFromMenu(kind: PathKind) {
    const current = shapeMenu;
    const shape = shapeAttrs();
    if (!current || !shape) return;
    const d = setPathKind(shape.attrs.d || '', kind);
    onshape?.(current.ref, stampPath(shape.attrs, d, kind));
    shapeMenu = { ...current, kind };
  }

  function openMenu(event: MouseEvent) {
    if (!editable) return;
    if (openShapeMenu(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    const knot = target?.closest('[data-knot]');
    const arrow = target?.closest('[data-kind="arrow"]');
    const ref = arrow?.getAttribute('data-pick') || knot?.closest('[data-knots]')?.getAttribute('data-knots') || '';
    const host = arrow || (ref ? sheetEl?.querySelector(`[data-kind="arrow"][data-pick="${CSS.escape(ref)}"]`) : null);
    if (!ref || !(host instanceof Element)) return;
    event.preventDefault();
    const world = worldAt(event);
    const group = knotGroup(ref);
    const stored = world ? storedAt(ref, world) : null;
    const role = knot?.getAttribute('data-role');
    const onVia = role === 'via';
    const motif = host.getAttribute('data-motif') || 'none';
    onpick?.(ref, false);
    menu = {
      x: event.clientX,
      y: event.clientY,
      ref,
      add: stored && group && world ? { index: segmentNear(knotPoints(group), world), x: stored.x, y: stored.y } : null,
      remove: onVia ? Number(knot?.getAttribute('data-index') || 0) : world && group ? nearestVia(group, world) : null,
      removeNear: !onVia,
      wave: motif === 'sine' || motif === 'zigzag',
      waveValue: readNum(host, 'data-wave', 0.7),
      ampValue: readNum(host, 'data-amp', 0.2)
    };
  }

  function closeMenu(event: Event) {
    if (event.target instanceof Node && (menuEl?.contains(event.target) || shapeMenuEl?.contains(event.target))) return;
    menu = null;
    shapeMenu = null;
  }

  function addFromMenu() {
    const current = menu;
    if (!current?.add) return;
    onvia?.(current.ref, 'add', current.add.index, current.add.x, current.add.y);
    menu = null;
  }

  function removeFromMenu() {
    const current = menu;
    if (!current || current.remove == null) return;
    onvia?.(current.ref, 'remove', current.remove);
    menu = null;
  }

  function tune(key: 'wave' | 'amp', event: Event) {
    const current = menu;
    const raw = event.currentTarget instanceof HTMLInputElement ? Number(event.currentTarget.value) : 0;
    const value = Math.round(raw * 100) / 100;
    if (!current) return;
    menu = { ...current, [key === 'wave' ? 'waveValue' : 'ampValue']: value };
    ontune?.(current.ref, key, value);
  }

  $effect(() => {
    const current = menu;
    const node = menuEl;
    if (!current || !node) return;
    const box = node.getBoundingClientRect();
    const x = Math.max(8, Math.min(current.x, window.innerWidth - box.width - 8));
    const y = Math.max(8, Math.min(current.y, window.innerHeight - box.height - 8));
    if (x !== current.x || y !== current.y) menu = { ...current, x, y };
  });

  $effect(() => {
    token;
    hold = null;
  });

  $effect(() => {
    if (!editable) return;
    svg;
    const surface = board;
    if (!surface) return;
    const pending = untrack(() => hold);
    hold = null;
    surface.settle();
    if (pending && performance.now() - pending.at < 800) surface.nudge(pending);
  });

  $effect(() => {
    const host = sheetEl;
    const markup = svg;
    if (!host || !markup) return;
    const root = host.querySelector('svg');
    if (!(root instanceof SVGSVGElement)) return;
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => crispStrokes(root));
    };
    run();
    const observer = new ResizeObserver(run);
    observer.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });

  type ArrowMenu = {
    x: number;
    y: number;
    ref: string;
    add: { index: number; x: number; y: number } | null;
    remove: number | null;
    removeNear: boolean;
    wave: boolean;
    waveValue: number;
    ampValue: number;
  };
  let menu = $state<ArrowMenu | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);
  let shapeMenu = $state<{
    x: number;
    y: number;
    ref: string;
    fill: string;
    stroke: string;
    scope: 'shape' | 'path' | 'point';
    kind: PathKind | null;
    canAdd: boolean;
    canRemove: boolean;
    addAt: number;
    addX: number;
    addY: number;
    remove: number | null;
  } | null>(null);
  let shapeMenuEl = $state<HTMLDivElement | null>(null);

  let shownMark = '';
  let shapeEpoch = 0;
  let boundShape: { ref: string; node: SVGGraphicsElement; grab: (event: PointerEvent) => void; dispose: () => void } | null = null;

  function clearShape() {
    boundShape?.dispose();
    boundShape = null;
    sheetEl?.querySelector('#svg-edit')?.remove();
  }

  function mountShape(ref: string, text: string, host: HTMLElement | null) {
    const root = host?.querySelector('svg');
    if (!(root instanceof SVGSVGElement) || !ref) {
      clearShape();
      return;
    }
    const node = root.querySelector(`[data-kind="svg"][data-pick="${CSS.escape(ref)}"]`);
    const shape = readShape(text, ref);
    if (!(node instanceof SVGGraphicsElement) || !shape) {
      clearShape();
      return;
    }
    if (boundShape?.ref === ref && boundShape.node === node) return;
    clearShape();
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = 'svg-edit';
    root.appendChild(group);
    const controls = bindShapeControls({
      root,
      node,
      group,
      tag: shape.tag,
      attrs: shape.attrs,
      onSelect: () => {
        primary = ref;
        marks = [ref];
        onpick?.(ref, false);
      },
      onEdit: (attrs, commit) => {
        if (commit) onshape?.(ref, attrs);
      }
    });
    boundShape = { ref, node, grab: controls.grab, dispose: controls.dispose };
  }

  $effect(() => {
    if (!editable) return;
    const mark = selected;
    if (mark === primary) return;
    if (mark && marks.includes(mark) && marks.length > 1) {
      primary = mark;
      return;
    }
    primary = mark;
    marks = mark ? [mark] : [];
  });

  $effect(() => {
    if (!editable || source === undefined) return;
    const ref = marks.length > 1 ? '' : (selected || '');
    const text = source;
    svg;
    const host = sheetEl;
    const epoch = ++shapeEpoch;
    const frame = requestAnimationFrame(() => {
      if (epoch !== shapeEpoch) return;
      mountShape(ref, text, host);
    });
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => () => clearShape());

  $effect(() => {
    const root = sheetEl;
    const lens = lensEl;
    const markup = svg;
    const chosen = new Set(editable ? marks : (selected ? [selected] : []));
    const mark = chosen.size === 1 ? [...chosen][0] : '';
    if (!root || !markup) return;
    for (const node of root.querySelectorAll('[data-pick]')) {
      node.classList.toggle('fc-picked', chosen.has(node.getAttribute('data-pick') || ''));
    }
    for (const node of root.querySelectorAll('[data-zone]')) {
      const on = chosen.has(node.getAttribute('data-zone') || '');
      node.classList.toggle('fc-picked', on);
      node.setAttribute('stroke-width', on ? '0.35' : '0.16');
    }
    for (const group of root.querySelectorAll('[data-knots]')) {
      group.setAttribute('display', group.getAttribute('data-knots') === mark ? 'inline' : 'none');
    }
    for (const node of root.querySelectorAll('[data-rotate], [data-resize]')) {
      const host = node.closest('[data-pick]');
      const selected = host?.getAttribute('data-pick') === mark;
      const on = selected && (node.hasAttribute('data-rotate') || host?.getAttribute('data-fit') === 'free');
      node.setAttribute('fill-opacity', on ? '1' : '0');
      node.setAttribute('stroke-opacity', on ? '1' : '0');
      node.setAttribute('pointer-events', on ? 'all' : 'none');
    }
    if (editable && marks.length >= 1) placeSelection();
    else root.querySelector('#svg-selection')?.remove();
    if (!mark) {
      shownMark = '';
      return;
    }
    if (!lens || mark === shownMark) return;
    shownMark = mark;
    const hit = root.querySelector(`[data-pick="${CSS.escape(mark)}"], [data-zone="${CSS.escape(mark)}"]`);
    if (!(hit instanceof Element)) return;
    const box = hit.getBoundingClientRect();
    const view = lens.getBoundingClientRect();
    const pad = 16;
    if (box.bottom > view.bottom - pad) lens.scrollTop += box.bottom - view.bottom + pad;
    else if (box.top < view.top + pad) lens.scrollTop -= view.top - box.top + pad;
    if (box.right > view.right - pad) lens.scrollLeft += box.right - view.right + pad;
    else if (box.left < view.left + pad) lens.scrollLeft -= view.left - box.left + pad;
  });
</script>

<div class="schema">
  {#if arrowOn && trackShown && trackBase && !compact}
    <TrajectoryControls value={trackShown} base={trackBase} onchange={(next) => { track = next; }} onreset={() => { track = null; }} />
  {/if}
  <div class="pitch overflow-hidden bg-[#166534]" oncontextmenu={(event) => event.preventDefault()}>
    {#if svg}
      <DrawingBoard
        bind:this={board}
        bind:sheet={sheetEl}
        bind:lens={lensEl}
        bind:home={fitHome}
        bind:fitZoom
        ruled={editable}
        {compact}
        editing={editable}
        {grabbing}
        resetKey={token}
        frameOf={schemaFrame}
        preset={samplePreset}
        {onlook}
        onview={refreshInk}
        onpointerdown={editable ? down : undefined}
        onpointermove={editable ? move : undefined}
        onpointerup={editable ? up : undefined}
        onpointercancel={editable ? up : undefined}
        ondblclick={editable ? twice : undefined}
        oncontextmenu={editable ? openMenu : undefined}
      >
        {@html svg}
        {#snippet overlay()}
          {#if band}
            <div class="marquee" aria-hidden="true" style:left="{band.left}px" style:top="{band.top}px" style:width="{band.width}px" style:height="{band.height}px"></div>
          {/if}
        {/snippet}
      </DrawingBoard>
    {:else}
      <div class="flex aspect-[3/2] items-center justify-center px-4 text-center text-sm text-white/80">
        {error || 'Schéma…'}
      </div>
    {/if}
  </div>
  {#if !compact && !onfooter}
    {@render animationBar()}
  {/if}
</div>
{#if menu}
  <div class="menu" style:left="{menu.x}px" style:top="{menu.y}px" bind:this={menuEl} role="menu">
    {#if menu.add}
      <button type="button" role="menuitem" onclick={addFromMenu}>Ajouter un point</button>
    {/if}
    {#if menu.remove != null}
      <button type="button" role="menuitem" onclick={removeFromMenu}>{menu.removeNear ? 'Enlever le point le plus proche' : 'Enlever ce point'}</button>
    {/if}
    {#if menu.wave}
      <label class="tune">
        <span>Longueur d'onde</span>
        <input type="range" min="0.3" max="3" step="0.05" value={menu.waveValue} aria-label="Longueur d'onde" oninput={(event) => tune('wave', event)} />
      </label>
      <label class="tune">
        <span>Amplitude</span>
        <input type="range" min="0" max="1.5" step="0.05" value={menu.ampValue} aria-label="Amplitude" oninput={(event) => tune('amp', event)} />
      </label>
    {/if}
  </div>
{/if}
{#if shapeMenu}
  <div bind:this={shapeMenuEl}>
    <ShapeMenu
      x={shapeMenu.x}
      y={shapeMenu.y}
      fill={shapeMenu.fill}
      stroke={shapeMenu.stroke}
      scope={shapeMenu.scope}
      kind={shapeMenu.kind}
      canAdd={shapeMenu.canAdd}
      canRemove={shapeMenu.canRemove}
      onpaint={paintFromMenu}
      ondelete={forgetFromMenu}
      onadd={addFromShape}
      onremove={removeFromShape}
      onkind={kindFromMenu}
    />
  </div>
{/if}
<svelte:window onkeydown={dropSelection} onpointerdown={closeMenu} />

{#snippet animationBar()}
  <AnimationBar {phases} {phase} {playing} onphase={showPhase} onreset={resetAnimation} ontoggle={togglePlay} />
{/snippet}

<style>
  .schema {
    overflow: hidden;
    border: 1px solid var(--color-default-medium);
    border-radius: 0;
  }
  .pitch { display: flex; min-width: 0; min-height: 0; }
  .marquee {
    position: absolute;
    z-index: 3;
    box-sizing: border-box;
    border: 1px solid #ccff00;
    background: rgba(204, 255, 0, 0.18);
    pointer-events: none;
  }
  .menu {
    position: fixed;
    z-index: 80;
    min-width: 14rem;
    padding: 0.25rem;
    border: 1px solid var(--color-default-medium);
    border-radius: 0.5rem;
    background: var(--color-neutral-primary);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
  }
  .menu button,
  .tune {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.55rem;
    border: 0;
    border-radius: 0.35rem;
    background: transparent;
    padding: 0.4rem 0.55rem;
    color: var(--color-heading);
    font-size: 0.875rem;
    text-align: left;
  }
  .menu button { cursor: pointer; }
  .menu button:hover { background: var(--color-neutral-secondary-medium); }
  .tune span { flex: 1 1 auto; }
  .tune input[type='range'] {
    width: 5.5rem;
    height: auto;
    border: 0;
    padding: 0;
    accent-color: #ca8a04;
  }
</style>
