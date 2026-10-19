<script lang="ts">
  import { activeTool, currentPage, selectedIds, updateElement, addElement, incrementTeamNumber, zoom, pan, clearSelection, type Position, type ComponentElement } from '$lib/stores/workspace';
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

  // Drawing State
  let drawingPoint1: Position | null = $state(null);
  let mousePos: Position | null = $state(null);

  // Marquee / pan state
  let marquee: { x: number; y: number; w: number; h: number } | null = $state(null);
  let marqueeStart: Position | null = null;
  let isPanning = false;
  let panStart: Position | null = null;
  let panOrigin: Position = { x: 0, y: 0 };

  // Content box of the pitch (in SVG user units) per template: centre + size.
  const contentBox = $derived.by(() => {
    const tpl = $currentPage?.fieldTemplate;
    if (tpl === 'Demi') return { cx: 340, cy: 262.5, W: 680, H: 525 };
    if (tpl === 'DemiBas') return { cx: 340, cy: 787.5, W: 680, H: 525 };
    return { cx: 340, cy: 525, W: 680, H: 1050 };
  });

  // --- ViewBox: aspect ratio follows the container so the board fills the
  // whole central area; the pitch is fitted (with a margin) and centred. ---
  const baseVB = $derived.by(() => {
    const P = contentBox;
    const margin = 55;
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

    const { x, y } = getSVGCoords(e);

    const type = e.dataTransfer?.getData('type') as any;
    const team = e.dataTransfer?.getData('team') as any;
    const label = e.dataTransfer?.getData('label') || '';

    if (type && type !== 'field') {
      let radius = 14;
      let color: string | undefined = '#fff';

      if (type === 'ball') {
        radius = $currentPage.ballSize;
        color = $currentPage.ballColor;
      } else if (team === 'team1') {
        radius = $currentPage.team1Size;
        color = $currentPage.team1Color;
      } else if (team === 'team2') {
        radius = $currentPage.team2Size;
        color = $currentPage.team2Color;
      } else if (EQUIPMENT_TYPES.includes(type)) {
        color = undefined; // let the Equipment component pick its default colour
      }

      const elementData: any = {
        type,
        team: team || 'none',
        position: { x, y },
        label: label,
        radius,
        angle: team === 'team2' ? 180 : 0,
        color
      };

      if (type === 'arrow') {
        elementData.pathPoints = [{ x, y }, { x: x + 100, y: y }];
        elementData.curveType = 'L';
        elementData.arrowEnd = true;
        elementData.strokeWidth = 3;
      }

      addElement(elementData);

      if (type === 'player' && label !== 'G') {
        incrementTeamNumber(team);
      }
    }
  }

  function isBackground(target: EventTarget | null): boolean {
    const el = target as Element;
    return el === svgElement || el?.classList?.contains('pitch-surface') || el?.classList?.contains('bg-rect');
  }

  // Shape (rect/ellipse/zone) drag-create state
  let shapeStart: Position | null = null;
  let shapePreview: { x: number; y: number; w: number; h: number } | null = $state(null);

  const isPerspective = $derived($currentPage?.view === 'perspective');

  function onPointerDown(e: PointerEvent) {
    if (isPerspective) return; // presentation mode is read-only

    // Arrow drawing tool (two-click)
    if ($activeTool === 'arrow') {
      const coords = getSVGCoords(e);
      if (!drawingPoint1) {
        drawingPoint1 = coords;
        mousePos = coords;
      } else {
        addElement({
          type: 'arrow',
          team: 'none',
          position: drawingPoint1,
          pathPoints: [drawingPoint1, coords],
          curveType: 'L',
          arrowEnd: true,
          strokeWidth: 3,
          color: '#ffffff'
        });
        drawingPoint1 = null;
        mousePos = null;
        activeTool.set(null);
      }
      return;
    }

    // Click-to-place tools: text & callout
    if ($activeTool === 'text' || $activeTool === 'callout') {
      const { x, y } = getSVGCoords(e);
      const tool = $activeTool;
      addElement(tool === 'text'
        ? { type: 'text', team: 'none', position: { x, y }, text: 'Texte', fontSize: 24, color: '#ffffff', fontWeight: 'bold' }
        : { type: 'callout', team: 'none', position: { x, y }, text: 'Annotation', width: 180, fillColor: '#fdf7d0', color: '#1a1a1a', fontSize: 13 });
      activeTool.set(null);
      return;
    }

    // Drag-create tools: rect / ellipse / zone
    if ($activeTool === 'rect' || $activeTool === 'ellipse' || $activeTool === 'zone') {
      shapeStart = getSVGCoords(e);
      shapePreview = { x: shapeStart.x, y: shapeStart.y, w: 0, h: 0 };
      window.addEventListener('pointermove', onShapeMove);
      window.addEventListener('pointerup', onShapeUp);
      return;
    }

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

  function onShapeMove(e: PointerEvent) {
    if (!shapeStart) return;
    const cur = getSVGCoords(e);
    shapePreview = {
      x: Math.min(shapeStart.x, cur.x),
      y: Math.min(shapeStart.y, cur.y),
      w: Math.abs(cur.x - shapeStart.x),
      h: Math.abs(cur.y - shapeStart.y)
    };
  }
  function onShapeUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onShapeMove);
    window.removeEventListener('pointerup', onShapeUp);
    const cur = getSVGCoords(e);
    const w = Math.max(24, Math.abs(cur.x - (shapeStart?.x ?? cur.x)));
    const h = Math.max(24, Math.abs(cur.y - (shapeStart?.y ?? cur.y)));
    const cx = ((shapeStart?.x ?? cur.x) + cur.x) / 2;
    const cy = ((shapeStart?.y ?? cur.y) + cur.y) / 2;
    const tool = $activeTool;
    if (tool === 'rect' || tool === 'ellipse' || tool === 'zone') {
      addElement({
        type: tool,
        team: 'none',
        position: { x: cx, y: cy },
        width: w,
        height: h,
        color: tool === 'zone' ? '#9bd64a' : '#ffffff',
        strokeWidth: 2,
        fillColor: tool === 'zone' ? '#9bd64a' : 'none',
        fillOpacity: tool === 'zone' ? 0.25 : 0
      });
    }
    shapeStart = null;
    shapePreview = null;
    activeTool.set(null);
  }

  function onPointerMove(e: PointerEvent) {
    if (drawingPoint1) {
      mousePos = getSVGCoords(e);
    }
  }

  function onWheel(e: WheelEvent) {
    if (!svgElement) return;
    e.preventDefault();
    const rect = svgElement.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const before = getSVGCoords(e);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const z = Math.max(0.3, Math.min(6, ($zoom || 1) * factor));
    const b = baseVB;
    const vbW = b.w / z;
    const vbH = b.h / z;
    // Keep the point under the cursor fixed
    const vbX = before.x - fx * vbW;
    const vbY = before.y - fy * vbH;
    pan.set({
      x: vbX - b.x - (b.w - vbW) / 2,
      y: vbY - b.y - (b.h - vbH) / 2
    });
    zoom.set(z);
  }

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
  class:drawing-mode={$activeTool !== null}
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
    onpointermove={onPointerMove}
    onwheel={onWheel}
    role="presentation"
    aria-label="Tactical drawing board"
  >
    <defs>
      <marker
        id="preview-arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="white" opacity="0.6" />
      </marker>
    </defs>

    <g>
      {#if $currentPage}
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

        <!-- Drawing Preview -->
        {#if drawingPoint1 && mousePos}
          <line
            x1={drawingPoint1.x}
            y1={drawingPoint1.y}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="white"
            stroke-width="3"
            stroke-dasharray="5,5"
            opacity="0.6"
            marker-end="url(#preview-arrowhead)"
          />
        {/if}

        <!-- Shape creation preview -->
        {#if shapePreview && ($activeTool === 'rect' || $activeTool === 'ellipse' || $activeTool === 'zone')}
          {#if $activeTool === 'ellipse'}
            <ellipse
              cx={shapePreview.x + shapePreview.w / 2}
              cy={shapePreview.y + shapePreview.h / 2}
              rx={shapePreview.w / 2} ry={shapePreview.h / 2}
              fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="2" stroke-dasharray="5,5" pointer-events="none"
            />
          {:else}
            <rect
              x={shapePreview.x} y={shapePreview.y} width={shapePreview.w} height={shapePreview.h}
              fill={$activeTool === 'zone' ? 'rgba(155,214,74,0.25)' : 'rgba(255,255,255,0.08)'}
              stroke={$activeTool === 'zone' ? '#9bd64a' : '#fff'} stroke-width="2" stroke-dasharray="5,5" pointer-events="none"
            />
          {/if}
        {/if}

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

  .canvas-container.drawing-mode {
    cursor: crosshair;
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
