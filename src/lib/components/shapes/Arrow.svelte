<script lang="ts">
  import type { ComponentElement, Position, HeadStyle } from '$lib/stores/workspace';
  import { updateElement, selectedIds, currentPage, selectElement, pushHistory } from '$lib/stores/workspace';
  
  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();
  
  // DRAG LOGIC FOR POINTS
  let activePointIndex = $state<number | null>(null);
  let startX = 0;
  let startY = 0;
  let originalPoints: Position[] = [];
  let svgElement: SVGSVGElement | null = null;
  let capturedTarget: SVGElement | null = null;
  let nearElementId = $state<string | null>(null); // Element currently being snapped to

  function onPointDown(e: PointerEvent, index: number) {
    e.stopPropagation();
    selectElement(element.id, e.shiftKey);
    pushHistory(true);
    activePointIndex = index;
    startX = e.clientX;
    startY = e.clientY;
    
    const target = e.currentTarget as SVGElement;
    svgElement = target.ownerSVGElement;
    capturedTarget = target;

    originalPoints = JSON.parse(JSON.stringify(element.pathPoints || [{x: element.position.x, y: element.position.y}, element.endPosition || {x: element.position.x + 50, y: element.position.y}]));
    
    window.addEventListener('pointermove', onPointMove);
    window.addEventListener('pointerup', onPointUp);
    
    target.setPointerCapture(e.pointerId);
  }

  function onPointMove(e: PointerEvent) {
    if (activePointIndex === null) return;
    
    // We need to calculate the delta in SVG space. 
    // Since we don't have easy access to the SVG root matrix here without passing it down,
    // we can approximate or use a trick.
    // For now, let's assume 1:1 screen/SVG or use the move logic from Player.svelte
    // But Player.svelte uses screen deltas which works because it's translation.
    // Here we're updating absolute coordinates.
    
    if (!svgElement) return;

    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svgElement.getScreenCTM()?.inverse());

    let targetX = svgPoint.x;
    let targetY = svgPoint.y;
    nearElementId = null;

    // Snapping logic for start and end points
    if (activePointIndex === 0 || activePointIndex === originalPoints.length - 1) {
      const otherElements = $currentPage.elements.filter(el => el.id !== element.id && el.type !== 'field');
      for (const el of otherElements) {
        const dx = el.position.x - svgPoint.x;
        const dy = el.position.y - svgPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20) {
          targetX = el.position.x;
          targetY = el.position.y;
          nearElementId = el.id;
          break;
        }
      }
    }

    const newPoints = [...originalPoints];
    newPoints[activePointIndex] = { x: targetX, y: targetY };

    // Update position if it's the first point (since position is the anchor in workspace)
    if (activePointIndex === 0) {
      updateElement(element.id, { 
        position: newPoints[0],
        pathPoints: newPoints
      });
    } else {
      updateElement(element.id, { pathPoints: newPoints });
    }
  }

  function onPointUp(e: PointerEvent) {
    if (activePointIndex === 0) {
      updateElement(element.id, { linkedStartId: nearElementId || undefined });
    } else if (activePointIndex !== null && activePointIndex === pathPoints.length - 1) {
      updateElement(element.id, { linkedEndId: nearElementId || undefined });
    }

    activePointIndex = null;
    nearElementId = null;
    window.removeEventListener('pointermove', onPointMove);
    window.removeEventListener('pointerup', onPointUp);
    if (capturedTarget) {
      capturedTarget.releasePointerCapture(e.pointerId);
      capturedTarget = null;
    }
  }

  // ENTIRE ARROW DRAG
  let isDraggingAll = false;
  function onArrowDown(e: PointerEvent) {
    if (activePointIndex !== null) return;
    e.stopPropagation();
    if (e.shiftKey) { selectElement(element.id, true); return; }
    if (!$selectedIds.includes(element.id)) selectElement(element.id, false);
    if (element.locked) return;
    pushHistory(true);
    isDraggingAll = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const target = e.currentTarget as SVGElement;
    svgElement = target.ownerSVGElement;
    capturedTarget = target;

    originalPoints = JSON.parse(JSON.stringify(element.pathPoints || [{x: element.position.x, y: element.position.y}, element.endPosition || {x: element.position.x + 50, y: element.position.y}]));
    
    window.addEventListener('pointermove', onArrowMove);
    window.addEventListener('pointerup', onArrowUp);
    
    target.setPointerCapture(e.pointerId);
  }

  function onArrowMove(e: PointerEvent) {
    if (!isDraggingAll || !svgElement) return;

    const ptStart = svgElement.createSVGPoint();
    ptStart.x = startX;
    ptStart.y = startY;
    const svgStart = ptStart.matrixTransform(svgElement.getScreenCTM()?.inverse());

    const ptCurrent = svgElement.createSVGPoint();
    ptCurrent.x = e.clientX;
    ptCurrent.y = e.clientY;
    const svgCurrent = ptCurrent.matrixTransform(svgElement.getScreenCTM()?.inverse());

    const dx = svgCurrent.x - svgStart.x;
    const dy = svgCurrent.y - svgStart.y;

    const newPoints = originalPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
    
    updateElement(element.id, { 
      position: newPoints[0],
      pathPoints: newPoints 
    });
  }

  function onArrowUp(e: PointerEvent) {
    isDraggingAll = false;
    window.removeEventListener('pointermove', onArrowMove);
    window.removeEventListener('pointerup', onArrowUp);
    if (capturedTarget) {
      capturedTarget.releasePointerCapture(e.pointerId);
      capturedTarget = null;
    }
  }

  // PATH GENERATION
  const pathPoints = $derived(element.pathPoints || [element.position, element.endPosition || {x: element.position.x + 100, y: element.position.y}]);
  const curveType = $derived(element.curveType || 'L');
  
  const pathData = $derived.by(() => {
    if (pathPoints.length < 2) return '';
    let d = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
    
    if (curveType === 'L') {
      for (let i = 1; i < pathPoints.length; i++) {
        d += ` L ${pathPoints[i].x} ${pathPoints[i].y}`;
      }
    } else if (curveType === 'Q') {
      if (pathPoints.length >= 3) {
        d += ` Q ${pathPoints[1].x} ${pathPoints[1].y} ${pathPoints[2].x} ${pathPoints[2].y}`;
        for (let i = 3; i < pathPoints.length; i++) {
          d += ` T ${pathPoints[i].x} ${pathPoints[i].y}`;
        }
      } else {
        d += ` L ${pathPoints[1].x} ${pathPoints[1].y}`;
      }
    } else if (curveType === 'C') {
      if (pathPoints.length >= 4) {
        d += ` C ${pathPoints[1].x} ${pathPoints[1].y} ${pathPoints[2].x} ${pathPoints[2].y} ${pathPoints[3].x} ${pathPoints[3].y}`;
        for (let i = 4; i < pathPoints.length; i++) {
          d += ` S ${pathPoints[i].x} ${pathPoints[i].y} ${pathPoints[i+1]?.x || pathPoints[i].x} ${pathPoints[i+1]?.y || pathPoints[i].y}`;
          if (pathPoints[i+1]) i++;
        }
      } else {
        for (let i = 1; i < pathPoints.length; i++) {
          d += ` L ${pathPoints[i].x} ${pathPoints[i].y}`;
        }
      }
    } else if (curveType === 'T') {
       for (let i = 1; i < pathPoints.length; i++) {
         d += ` T ${pathPoints[i].x} ${pathPoints[i].y}`;
       }
    } else if (curveType === 'S') {
       for (let i = 1; i < pathPoints.length; i++) {
         d += ` S ${pathPoints[i].x} ${pathPoints[i].y} ${pathPoints[i+1]?.x || pathPoints[i].x} ${pathPoints[i+1]?.y || pathPoints[i].y}`;
         if (pathPoints[i+1]) i++;
       }
    }
    return d;
  });

  const color = $derived(element.color || '#ffffff');
  const strokeWidth = $derived(element.strokeWidth || 3);
  const dashArray = $derived(element.strokeDasharray || '');

  // Resolve head styles (new headStart/headEnd take priority over legacy booleans)
  const headStart = $derived<HeadStyle>(element.headStart ?? (element.arrowStart ? 'arrow' : 'none'));
  const headEnd = $derived<HeadStyle>(element.headEnd ?? (element.arrowEnd ? 'arrow' : 'none'));
  const markerStart = $derived(headStart !== 'none' ? `url(#mk-start-${headStart}-${element.id})` : '');
  const markerEnd = $derived(headEnd !== 'none' ? `url(#mk-end-${headEnd}-${element.id})` : '');

  // Wavy (dribble / conduite) rendering — only meaningful for polyline paths
  const renderPath = $derived.by(() => {
    if (!element.wavy || curveType !== 'L' || pathPoints.length < 2) return pathData;
    const amp = Math.max(3, (element.strokeWidth || 3) + 2);
    const wl = 16;
    let d = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
    for (let s = 0; s < pathPoints.length - 1; s++) {
      const a = pathPoints[s];
      const b = pathPoints[s + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;
      const steps = Math.max(4, Math.floor(len / 3));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const dist = t * len;
        const off = amp * Math.sin((dist / wl) * 2 * Math.PI) * Math.sin(t * Math.PI);
        const px = a.x + ux * dist + nx * off;
        const py = a.y + uy * dist + ny * off;
        d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      }
    }
    return d;
  });
</script>

<g class="arrow-element" class:selected={isSelected}>
  <defs>
    <!-- END markers -->
    <marker id="mk-end-arrow-{element.id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill={color} />
    </marker>
    <marker id="mk-end-double-{element.id}" markerWidth="16" markerHeight="7" refX="15" refY="3.5" orient="auto">
      <polygon points="0 0, 8 3.5, 0 7" fill={color} />
      <polygon points="8 0, 16 3.5, 8 7" fill={color} />
    </marker>
    <marker id="mk-end-bar-{element.id}" markerWidth="6" markerHeight="10" refX="3" refY="5" orient="auto">
      <rect x="2" y="0" width="2" height="10" fill={color} />
    </marker>
    <!-- START markers -->
    <marker id="mk-start-arrow-{element.id}" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
      <polygon points="0 0, 10 3.5, 0 7" fill={color} />
    </marker>
    <marker id="mk-start-double-{element.id}" markerWidth="16" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
      <polygon points="0 0, 8 3.5, 0 7" fill={color} />
      <polygon points="8 0, 16 3.5, 8 7" fill={color} />
    </marker>
    <marker id="mk-start-bar-{element.id}" markerWidth="6" markerHeight="10" refX="3" refY="5" orient="auto">
      <rect x="2" y="0" width="2" height="10" fill={color} />
    </marker>
  </defs>

  <!-- Invisible wider path for easier clicking -->
  <path 
    d={pathData} 
    fill="none" 
    stroke="transparent" 
    stroke-width={strokeWidth + 15} 
    onpointerdown={onArrowDown}
    class="hit-area"
    role="button"
    aria-label="Arrow handle"
  />

  <!-- Visible path -->
  <path 
    d={renderPath} 
    fill="none" 
    stroke={color} 
    stroke-width={strokeWidth} 
    stroke-dasharray={dashArray}
    stroke-linecap="round"
    stroke-linejoin="round"
    marker-start={markerStart}
    marker-end={markerEnd}
    onpointerdown={onArrowDown}
    class="main-path"
    role="button"
    aria-label="Arrow path"
  />

  <!-- Handles for editing points -->
  {#if isSelected}
    {#each pathPoints as pt, i}
      <g 
        class="handle" 
        onpointerdown={(e) => onPointDown(e, i)}
        transform="translate({pt.x}, {pt.y})"
        role="button"
        tabindex="0"
        aria-label="Edit point {i}"
      >
        <circle 
          cx="0" 
          cy="0" 
          r={i === 0 || i === pathPoints.length - 1 ? 6 : 5} 
          fill={
            (i === 0 && element.linkedStartId) || (i === pathPoints.length - 1 && element.linkedEndId) 
            ? 'var(--accent-primary)' 
            : (nearElementId && (i === 0 || i === pathPoints.length - 1) && activePointIndex === i ? 'var(--accent-primary)' : 'var(--bg-panel)')
          } 
          stroke={
            (i === 0 && element.linkedStartId) || (i === pathPoints.length - 1 && element.linkedEndId) 
            ? 'white' 
            : 'white'
          }
          stroke-width={(i === 0 && element.linkedStartId) || (i === pathPoints.length - 1 && element.linkedEndId) ? 2 : 1.5} 
        />
        {#if i === 0}<text y="-10" text-anchor="middle" font-size="8" fill="white">{element.linkedStartId ? 'Linked' : 'Début'}</text>{/if}
        {#if i === pathPoints.length - 1}<text y="-10" text-anchor="middle" font-size="8" fill="white">{element.linkedEndId ? 'Linked' : 'Fin'}</text>{/if}
      </g>
    {/each}
  {/if}
</g>

<style>
  .arrow-element {
    cursor: pointer;
  }
  .hit-area {
    cursor: move;
  }
  .main-path {
    pointer-events: none;
    transition: stroke 0.2s;
  }
  .handle {
    cursor: crosshair;
  }
  .handle circle {
    transition: r 0.2s, fill 0.2s;
  }
  .handle:hover circle {
    r: 8;
  }
  .selected .main-path {
    filter: drop-shadow(0 0 2px var(--accent-primary));
  }
</style>
