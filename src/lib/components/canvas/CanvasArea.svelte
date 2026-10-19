<script lang="ts">
  import { activeTool, currentPage, selectedIds, updateElement, addElement, incrementTeamNumber, type Position } from '$lib/stores/workspace';
  import Player from '../shapes/Player.svelte';
  import Ball from '../shapes/Ball.svelte';
  import Pitch from '../shapes/Pitch.svelte';
  import Arrow from '../shapes/Arrow.svelte';

  let svgElement: SVGSVGElement | undefined = $state();
  
  // Drawing State
  let drawingPoint1: Position | null = $state(null);
  let mousePos: Position | null = $state(null);

  function getSVGCoords(e: MouseEvent | PointerEvent) {
    if (!svgElement) return { x: 0, y: 0 };
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svgElement.getScreenCTM()?.inverse());
    return { x: svgPoint.x, y: svgPoint.y };
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
      let color = '#fff';

      if (type === 'ball') {
        radius = $currentPage.ballSize;
        color = $currentPage.ballColor;
      } else if (team === 'team1') {
        radius = $currentPage.team1Size;
        color = $currentPage.team1Color;
      } else if (team === 'team2') {
        radius = $currentPage.team2Size;
        color = $currentPage.team2Color;
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

      // Increment numbering if it was a numbered field player
      if (type === 'player' && label !== 'G') {
        incrementTeamNumber(team);
      }
    }
  }

  function onPointerDown(e: PointerEvent) {
    if ($activeTool === 'arrow') {
      const coords = getSVGCoords(e);
      if (!drawingPoint1) {
        drawingPoint1 = coords;
        mousePos = coords;
      } else {
        // Finalize arrow
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

    if (e.target === svgElement || (e.target as Element).classList.contains('pitch-surface')) {
      selectedIds.set([]);
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (drawingPoint1) {
      mousePos = getSVGCoords(e);
    }
  }

</script>

<div 
  class="canvas-container" 
  class:drawing-mode={$activeTool !== null}
  ondragover={onDragOver} 
  ondrop={onDrop} 
  aria-label="Drawing area" 
  role="region"
>
  <svg 
    bind:this={svgElement}
    class="drawing-surface-vertical" 
    style:aspect-ratio={$currentPage?.fieldTemplate === 'Complet' ? '760 / 1130' : '760 / 566.25'}
    viewBox={
      $currentPage?.fieldTemplate === 'Complet' ? "-40 -40 760 1130" : 
      $currentPage?.fieldTemplate === 'Demi' ? "-40 -40 760 566.25" : 
      "-40 523.75 760 566.25"
    } 
    xmlns="http://www.w3.org/2000/svg"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    role="presentation"
    aria-label="Tactical drawing board"
  >
    <defs>
      <clipPath id="zoom-clip">
        {#if $currentPage?.fieldTemplate === 'Complet'}
          <rect x="-40" y="-40" width="760" height="1130" />
        {:else if $currentPage?.fieldTemplate === 'Demi'}
          <rect x="-40" y="-40" width="760" height="566.25" />
        {:else}
          <rect x="-40" y="523.75" width="760" height="566.25" />
        {/if}
      </clipPath>

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

    <g clip-path="url(#zoom-clip)">
      {#if $currentPage}
        <Pitch 
          template={$currentPage.fieldTemplate} 
          orientation="vertical" 
          showStripes={$currentPage.showFieldStripes} 
        />
        
        <g class="elements">
          <!-- 1. Unselected Arrows (Bottom layer) -->
          {#each $currentPage.elements.filter(el => el.type === 'arrow' && !$selectedIds.includes(el.id)) as element (element.id)}
            <Arrow {element} isSelected={false} />
          {/each}

          <!-- 2. Unselected Balls (Middle layer) -->
          {#each $currentPage.elements.filter(el => el.type === 'ball' && !$selectedIds.includes(el.id)) as element (element.id)}
            <Ball {element} isSelected={false} />
          {/each}

          <!-- 3. Unselected Players and other elements (Top normal layer) -->
          {#each $currentPage.elements.filter(el => (el.type === 'player' || el.type === 'cone') && !$selectedIds.includes(el.id)) as element (element.id)}
            {#if element.type === 'player'}
              <Player {element} isSelected={false} />
            {:else if element.type === 'cone'}
              <!-- Cone logic -->
            {/if}
          {/each}

          <!-- 4. Selected Elements (Foreground layer, everything else below) -->
          {#each $currentPage.elements.filter(el => $selectedIds.includes(el.id)) as element (element.id)}
            {#if element.type === 'player'}
              <Player {element} isSelected={true} />
            {:else if element.type === 'ball'}
              <Ball {element} isSelected={true} />
            {:else if element.type === 'arrow'}
              <Arrow {element} isSelected={true} />
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
      {/if}
    </g>
  </svg>
</div>

<style>
  .canvas-container {
    flex: 1;
    background-color: #2b6b39; /* Same green as the terrain */
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
  }

  .canvas-container.drawing-mode {
    cursor: crosshair;
  }
  
  .drawing-surface-vertical {
    height: 100%;
    width: auto;
    max-width: 100%;
    max-height: 100%;
    background-color: transparent;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.1));
  }

  @media print {
    .canvas-container {
      padding: 0;
      background: #2b6b39;
      overflow: visible;
    }
  }
</style>
