<script lang="ts">
  import { currentPage, selectedIds, zoom, pan, clearSelection, placeElementAt, type Position, type ComponentElement, type ElementType, type TeamType } from '$lib/stores/workspace';
  import { svgPoint } from '$lib/utils/interactions';
  import Player from '../shapes/Player.svelte';
  import Ball from '../shapes/Ball.svelte';
  import Pitch from '../shapes/Pitch.svelte';
  import Arrow from '../shapes/Arrow.svelte';
  import ShapeElement from '../shapes/ShapeElement.svelte';
  import TextLabel from '../shapes/TextLabel.svelte';
  import Callout from '../shapes/Callout.svelte';
  import Equipment from '../shapes/Equipment.svelte';
  import { EQUIPMENT_TYPES, isPlaying, playbackElements } from '$lib/stores/workspace';
  import { contentBox, fieldClipRect, FIELD_MARGIN } from '$lib/utils/fieldBounds';

  const displayElements = $derived($isPlaying ? $playbackElements : ($currentPage?.elements ?? []));

  let svgElement: SVGSVGElement | undefined = $state();
  let containerEl: HTMLDivElement | undefined = $state();

  // Live size of the drawing area, so the viewBox can match its aspect ratio
  // (no horizontal letterboxing → zoom uses the full central space).
  let contW = $state(0);
  let contH = $state(0);
  $effect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        contW = e.contentRect.width;
        contH = e.contentRect.height;
      }
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  });

  // Marquee / pan state
  let marquee: { x: number; y: number; w: number; h: number } | null = $state(null);
  let marqueeStart: Position | null = null;
  let isPanning = false;
  let panStart: Position | null = null;
  let panOrigin: Position = { x: 0, y: 0 };

  // Content box of the pitch (in SVG user units) per template: centre + size.
  const contentBoxDerived = $derived(contentBox($currentPage?.fieldTemplate ?? 'Complet'));
  const fieldClip = $derived(fieldClipRect($currentPage?.fieldTemplate ?? 'Complet'));

  // --- ViewBox: aspect ratio follows the container so the board fills the
  // whole central area; the pitch is fitted (with a margin) and centred. ---
  const baseVB = $derived.by(() => {
    const P = contentBoxDerived;
    const margin = FIELD_MARGIN;
    const W = P.W + margin * 2;
    const H = P.H + margin * 2;
    const A = contW > 0 && contH > 0 ? contW / contH : W / H;
    let vbW: number, vbH: number;
    if (A >= W / H) { vbH = H; vbW = H * A; } // container wider than pitch → fit height
    else { vbW = W; vbH = W / A; }            // container taller → fit width
    return { x: P.cx - vbW / 2, y: P.cy - vbH / 2, w: vbW, h: vbH };
  });

  const viewBox = $derived.by(() => {
    const b = baseVB;
    const z = $zoom || 1;
    const vbW = b.w / z;
    const vbH = b.h / z;
    const vbX = b.x + (b.w - vbW) / 2 + $pan.x;
    const vbY = b.y + (b.h - vbH) / 2 + $pan.y;
    return `${vbX} ${vbY} ${vbW} ${vbH}`;
  });

  function getSVGCoords(e: MouseEvent | PointerEvent): Position {
    if (!svgElement) return { x: 0, y: 0 };
    return svgPoint(svgElement, e.clientX, e.clientY);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    if (!svgElement) return;

    const type = e.dataTransfer?.getData('type') as ElementType | '';
    const team = (e.dataTransfer?.getData('team') || 'none') as TeamType;
    const label = e.dataTransfer?.getData('label') || '';

    if (type && type !== 'field') {
      placeElementAt(getSVGCoords(e), { type, team, label });
    }
  }

  function isBackground(target: EventTarget | null): boolean {
    const el = target as Element;
    return el === svgElement || el?.classList?.contains('pitch-surface') || el?.classList?.contains('bg-rect');
  }

  const isPerspective = $derived($currentPage?.view === 'perspective');

  function onPointerDown(e: PointerEvent) {
    if (isPerspective) return; // presentation mode is read-only
    if (!isBackground(e.target)) return;

    // Middle mouse or Space-pan → pan; otherwise marquee select
    if (e.button === 1 || spaceHeld) {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      panOrigin = { ...$pan };
      svgElement?.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', onPanMove);
      window.addEventListener('pointerup', onPanUp);
    } else {
      const start = getSVGCoords(e);
      marqueeStart = start;
      marquee = { x: start.x, y: start.y, w: 0, h: 0 };
      window.addEventListener('pointermove', onMarqueeMove);
      window.addEventListener('pointerup', onMarqueeUp);
    }
  }

  function onPanMove(e: PointerEvent) {
    if (!isPanning || !panStart || !svgElement) return;
    const rect = svgElement.getBoundingClientRect();
    const b = baseVB;
    const z = $zoom || 1;
    const vbW = b.w / z;
    const vbH = b.h / z;
    const dxScreen = e.clientX - panStart.x;
    const dyScreen = e.clientY - panStart.y;
    // Convert screen delta to SVG units (pan moves opposite to drag)
    pan.set({
      x: panOrigin.x - (dxScreen / rect.width) * vbW,
      y: panOrigin.y - (dyScreen / rect.height) * vbH
    });
  }
  function onPanUp() {
    isPanning = false;
    window.removeEventListener('pointermove', onPanMove);
    window.removeEventListener('pointerup', onPanUp);
  }

  function onMarqueeMove(e: PointerEvent) {
    if (!marqueeStart) return;
    const cur = getSVGCoords(e);
    marquee = {
      x: Math.min(marqueeStart.x, cur.x),
      y: Math.min(marqueeStart.y, cur.y),
      w: Math.abs(cur.x - marqueeStart.x),
      h: Math.abs(cur.y - marqueeStart.y)
    };
  }
  function onMarqueeUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onMarqueeMove);
    window.removeEventListener('pointerup', onMarqueeUp);
    if (marquee && (marquee.w > 4 || marquee.h > 4)) {
      const inside = $currentPage.elements.filter((el: ComponentElement) => {
        const p = el.position;
        return p.x >= marquee!.x && p.x <= marquee!.x + marquee!.w &&
               p.y >= marquee!.y && p.y <= marquee!.y + marquee!.h;
      }).map((el: ComponentElement) => el.id);
      selectedIds.set(inside);
    } else {
      clearSelection();
    }
    marquee = null;
    marqueeStart = null;
  }

  function onWheel(e: WheelEvent) {
    if (!svgElement) return;
    e.preventDefault();

    const rect = svgElement.getBoundingClientRect();
    const b = baseVB;
    const z = $zoom || 1;
    const vbW = b.w / z;
    const vbH = b.h / z;

    // Ctrl + wheel → zoom toward cursor
    if (e.ctrlKey) {
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const before = getSVGCoords(e);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZ = Math.max(0.3, Math.min(6, z * factor));
      const nextVbW = b.w / nextZ;
      const nextVbH = b.h / nextZ;
      const vbX = before.x - fx * nextVbW;
      const vbY = before.y - fy * nextVbH;
      pan.set({
        x: vbX - b.x - (b.w - nextVbW) / 2,
        y: vbY - b.y - (b.h - nextVbH) / 2
      });
      zoom.set(nextZ);
      return;
    }

    const scrollFactor = 0.9;
    if (e.shiftKey) {
      // Shift + wheel → horizontal pan (deltaY on most browsers when shifted)
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const dx = (delta / rect.width) * vbW * scrollFactor;
      pan.update((p) => ({ ...p, x: p.x + dx }));
    } else {
      // Wheel → vertical pan
      const dy = (e.deltaY / rect.height) * vbH * scrollFactor;
      pan.update((p) => ({ ...p, y: p.y + dy }));
    }
  }

  // Non-passive wheel listener so preventDefault() blocks browser zoom on Ctrl+wheel
  $effect(() => {
    const el = svgElement;
    const _fieldTpl = $currentPage?.fieldTemplate;
    void _fieldTpl;
    if (!el) return;
    const handler = (e: WheelEvent) => onWheel(e);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  });

  // Space-to-pan tracking
  let spaceHeld = $state(false);
  function onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (e.code === 'Space' && !(t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      spaceHeld = true;
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') spaceHeld = false;
  }
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div
  bind:this={containerEl}
  class="canvas-container"
  class:pan-mode={spaceHeld}
  ondragover={onDragOver}
  ondrop={onDrop}
  aria-label="Drawing area"
  role="region"
>
  <svg
    bind:this={svgElement}
    class="drawing-surface-vertical"
    class:perspective={isPerspective}
    {viewBox}
    xmlns="http://www.w3.org/2000/svg"
    onpointerdown={onPointerDown}
    role="presentation"
    aria-label="Tactical drawing board"
  >
    <g>
      {#if $currentPage}
        <defs>
          <clipPath id="canvas-field-clip">
            <rect x={fieldClip.x} y={fieldClip.y} width={fieldClip.w} height={fieldClip.h} />
          </clipPath>
        </defs>
        <g clip-path="url(#canvas-field-clip)">
          <Pitch
            template={$currentPage.fieldTemplate}
            orientation="vertical"
            showStripes={$currentPage.showFieldStripes}
            grassColor={$currentPage.backgroundColor}
            hideGoals={$currentPage.hideGoals}
            hideLines={$currentPage.hidePitchLines}
          />

          <g class="elements" class:playing={$isPlaying || isPerspective}>
            {#each displayElements as element (element.id)}
              {@const sel = !$isPlaying && $selectedIds.includes(element.id)}
              {#if element.type === 'player'}
                <Player {element} isSelected={sel} />
              {:else if element.type === 'ball'}
                <Ball {element} isSelected={sel} />
              {:else if element.type === 'arrow'}
                <Arrow {element} isSelected={sel} />
              {:else if element.type === 'text'}
                <TextLabel {element} isSelected={sel} />
              {:else if element.type === 'callout'}
                <Callout {element} isSelected={sel} />
              {:else if element.type === 'rect' || element.type === 'ellipse' || element.type === 'zone'}
                <ShapeElement {element} isSelected={sel} />
              {:else if EQUIPMENT_TYPES.includes(element.type)}
                <Equipment {element} isSelected={sel} />
              {/if}
            {/each}
          </g>

          <!-- Marquee selection rectangle -->
          {#if marquee}
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.h}
              fill="rgba(94,106,210,0.15)"
              stroke="var(--accent-primary)"
              stroke-width="1.5"
              stroke-dasharray="4,3"
              pointer-events="none"
            />
          {/if}
        </g>
      {/if}
    </g>
  </svg>
</div>

<style>
  .canvas-container {
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    background-color: var(--bg-canvas);
  }

  .canvas-container.pan-mode {
    cursor: grab;
  }

  .elements.playing { pointer-events: none; }

  .drawing-surface-vertical.perspective {
    transform: perspective(1500px) rotateX(34deg) scale(0.86);
    transform-origin: center 58%;
    transition: transform 0.35s ease;
  }

  .drawing-surface-vertical {
    width: 100%;
    height: 100%;
    display: block;
    background-color: transparent;
    touch-action: none;
  }

  @media print {
    .canvas-container {
      padding: 0;
      overflow: visible;
    }
  }
</style>
