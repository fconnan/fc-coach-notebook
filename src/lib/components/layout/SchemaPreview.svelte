<script lang="ts">
  import { PauseOutline, PlayOutline, RefreshOutline } from 'flowbite-svelte-icons';
  import { tick } from 'svelte';
  import { ballCarryGap, ballTransform } from '$lib/schema/ball';
  import { liveExercisePreview, loadExercisePreview, type ExercisePreview } from '$lib/schema/preview';

  let {
    at = '',
    exerciseId = '',
    compact = false,
    source = undefined as string | undefined,
    editable = false,
    selected = '',
    onpick = undefined as ((ref: string, focus?: boolean) => void) | undefined,
    onmove = undefined as ((ref: string, x: number, y: number) => void) | undefined,
    onrotate = undefined as ((ref: string, angle: number) => void) | undefined
  }: {
    at?: string;
    exerciseId?: string;
    compact?: boolean;
    source?: string;
    editable?: boolean;
    selected?: string;
    onpick?: (ref: string, focus?: boolean) => void;
    onmove?: (ref: string, x: number, y: number) => void;
    onrotate?: (ref: string, angle: number) => void;
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
  let zoom = $state(1);
  let fitted = $state<{ w: number; h: number } | null>(null);
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
    mode: 'move' | 'rotate';
    ax: number;
    ay: number;
  } | null = null;

  const token = $derived(source === undefined ? (exerciseId || at) : `live:${exerciseId || at}`);
  const active = $derived(preview && shownFor === token ? preview : null);
  const svg = $derived(active ? active.render(phase, progress, editable) : '');
  const phases = $derived(active?.phases || []);

  $effect(() => {
    const path = at;
    const id = exerciseId;
    const live = source;
    const key = live === undefined ? (id || path) : `live:${id || path}`;
    if (!key) return;
    let cancelled = false;
    const task = live === undefined ? loadExercisePreview(path, id) : liveExercisePreview(live, path, id);
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

  function fieldValue(event: Event): string {
    const target = event.currentTarget;
    return target instanceof HTMLSelectElement ? target.value : '';
  }

  function worldAt(event: PointerEvent): { x: number; y: number } | null {
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

  function shift(ref: string, x: number, y: number) {
    const root = sheetEl;
    if (!root) return;
    const nodes = [...root.querySelectorAll(`[data-ref="${CSS.escape(ref)}"]`)];
    const handle = nodes.find(node => node.hasAttribute('data-handle'));
    const ball = root.querySelector('[data-ball]');
    if (handle && ball instanceof SVGElement && handle.hasAttribute('cx')) {
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
      if (near <= closest + 0.05 && near < ballCarryGap + 0.6) {
        const nextX = x + dx;
        const nextY = y + dy;
        ball.setAttribute('data-x', String(nextX));
        ball.setAttribute('data-y', String(nextY));
        ball.setAttribute('transform', ballTransform(nextX, nextY));
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

  function down(event: PointerEvent) {
    if (!editable || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    const node = target?.closest('[data-pick], [data-ref]');
    const ref = node?.getAttribute('data-pick') || node?.getAttribute('data-ref') || '';
    if (!ref) {
      drag = null;
      grabbing = false;
      onpick?.('');
      return;
    }
    event.preventDefault();
    try { sheetEl?.setPointerCapture(event.pointerId); } catch { /* le pointeur n’est plus actif */ }
    playing = false;
    phase = 0;
    progress = 0;
    const rotating = !!target?.closest('[data-rotate]');
    const handle = node?.hasAttribute('data-handle')
      ? node
      : sheetEl?.querySelector(`[data-handle][data-ref="${CSS.escape(ref)}"]`);
    drag = {
      ref,
      canMove: !!handle && !rotating,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      ox: Number(handle?.getAttribute('data-ox') || 0),
      oy: Number(handle?.getAttribute('data-oy') || 0),
      sx: Number(handle?.getAttribute('data-sx') || 0),
      sy: Number(handle?.getAttribute('data-sy') || 0),
      relative: handle?.getAttribute('data-rel') === '1',
      mode: rotating ? 'rotate' : 'move',
      ax: Number(handle?.getAttribute('data-x') || 0),
      ay: Number(handle?.getAttribute('data-y') || 0)
    };
    onpick?.(ref, false);
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

  function move(event: PointerEvent) {
    const current = drag;
    if (current?.mode === 'rotate') {
      if (!current.moved) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 4) return;
        current.moved = true;
        grabbing = true;
      }
      const world = worldAt(event);
      if (!world) return;
      turn(current.ref, world.x, world.y);
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
    if (!current.moved) {
      onpick?.(current.ref, true);
      return;
    }
    const world = worldAt(event);
    if (current.mode === 'rotate') {
      if (!world) return;
      onrotate?.(current.ref, aim(current.ax, current.ay, world.x, world.y));
      return;
    }
    if (!world) return;
    const x = current.relative ? (current.sx ? (world.x - current.ox) / current.sx : 0) : world.x - current.ox;
    const y = current.relative ? (current.sy ? (world.y - current.oy) / current.sy : 0) : world.y - current.oy;
    onmove?.(current.ref, x, y);
  }

  $effect(() => {
    token;
    zoom = 1;
    fitted = null;
  });

  $effect(() => {
    const node = lensEl;
    if (!node) return;
    const onWheel = (event: WheelEvent) => { void zoomAt(event); };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  });

  function zoomAt(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const node = lensEl;
    const sheet = sheetEl;
    if (!node || !sheet) return;
    const origin = fitted ?? { w: sheet.clientWidth, h: sheet.clientHeight };
    if (!origin.w || !origin.h) return;
    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= node.clientHeight;
    const next = Math.min(8, Math.max(0.4, zoom * Math.exp(-delta * 0.0018)));
    if (Math.abs(next - zoom) < 0.001) return;
    const ratio = next / zoom;
    const rect = node.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const anchorX = offsetX + node.scrollLeft;
    const anchorY = offsetY + node.scrollTop;
    if (!fitted) fitted = origin;
    zoom = next;
    void tick().then(() => {
      node.scrollLeft = anchorX * ratio - offsetX;
      node.scrollTop = anchorY * ratio - offsetY;
    });
  }

  $effect(() => {
    const root = sheetEl;
    const mark = selected;
    const markup = svg;
    if (!root || !markup) return;
    for (const node of root.querySelectorAll('circle[data-pick], rect[data-pick]')) {
      node.setAttribute('stroke', node.getAttribute('data-pick') === mark ? '#fde047' : 'transparent');
    }
    for (const node of root.querySelectorAll('[data-rotate]')) {
      const on = node.closest('[data-pick]')?.getAttribute('data-pick') === mark;
      node.setAttribute('fill-opacity', on ? '1' : '0');
      node.setAttribute('stroke-opacity', on ? '1' : '0');
      node.setAttribute('pointer-events', on ? 'all' : 'none');
    }
  });
</script>

<div class="schema">
  <div class="pitch overflow-hidden bg-[#166534]">
    {#if svg}
      <div class="lens" class:compact bind:this={lensEl}>
        <div
          class="sheet"
          class:editing={editable}
          class:grabbing
          style:width={fitted ? `${fitted.w * zoom}px` : '100%'}
          style:height={fitted ? `${fitted.h * zoom}px` : '100%'}
          bind:this={sheetEl}
          onpointerdown={editable ? down : undefined}
          onpointermove={editable ? move : undefined}
          onpointerup={editable ? up : undefined}
          onpointercancel={editable ? up : undefined}
        >{@html svg}</div>
      </div>
    {:else}
      <div class="flex aspect-[3/2] items-center justify-center px-4 text-center text-sm text-white/80">
        {error || 'Schéma…'}
      </div>
    {/if}
  </div>
  {#if !compact}
  <div class="schema-bar">
    {#if phases.length}
      <select class="bar-select" aria-label="Phase" value={String(phase)} onchange={(e) => showPhase(Number(fieldValue(e)))}>
        {#each phases as item, index (item.name + index)}
          <option value={String(index)}>{item.name}</option>
        {/each}
      </select>
    {/if}
    <button type="button" class="bar-btn" disabled={!phases.length} onclick={resetAnimation}>
      <RefreshOutline class="bar-icon" /> Reset
    </button>
    <button type="button" class="bar-btn" disabled={!phases.length} title={phases.length ? undefined : 'Ce schéma n’a pas d’animation'} onclick={togglePlay}>
      {#if playing}
        <PauseOutline class="bar-icon" /> Pause
      {:else}
        <PlayOutline class="bar-icon" /> Lire
      {/if}
    </button>
  </div>
  {/if}
</div>

<style>
  .schema {
    overflow: hidden;
    border: 1px solid var(--color-default-medium);
    border-radius: 0;
  }
  .pitch { display: flex; min-width: 0; min-height: 0; }
  .lens {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }
  .lens.compact { flex: none; height: 7.5rem; }
  .sheet { width: 100%; height: 100%; }
  .sheet :global(svg) { display: block; width: 100%; height: 100%; }
  .sheet.editing { touch-action: none; user-select: none; }
  .sheet.editing :global(circle[data-handle]),
  .sheet.editing :global(rect[data-handle]),
  .sheet.editing :global([data-rotate]) { cursor: grab; }
  .sheet.grabbing :global(svg) { cursor: grabbing; }
  .schema-bar {
    display: flex;
    background: var(--color-neutral-primary);
    border-top: 1px solid var(--color-default-medium);
  }
  .bar-select,
  .bar-btn {
    height: 1.5rem;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding: 0 0.45rem;
    font-size: 0.75rem;
    color: var(--color-heading);
  }
  .bar-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
  }
  .bar-btn :global(.bar-icon) { width: 0.85rem; height: 0.85rem; }
  .schema-bar > * + * { border-left: 1px solid var(--color-default-medium); }
  .bar-btn:disabled { color: var(--color-body); }
  .bar-select:hover,
  .bar-btn:hover:not(:disabled) { background: var(--color-neutral-secondary-medium); }
</style>
