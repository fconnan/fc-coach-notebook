<script lang="ts">
  import { currentPage, selectedIds, updateElement, addElement, incrementTeamNumber } from '$lib/stores/workspace';
  import Player from '../shapes/Player.svelte';
  import Ball from '../shapes/Ball.svelte';
  import Pitch from '../shapes/Pitch.svelte';

  let svgElement: SVGSVGElement | undefined = $state();
  
  function onDragOver(e: DragEvent) {
    e.preventDefault(); 
  }
  
  function onDrop(e: DragEvent) {
    e.preventDefault();
    if (!svgElement) return;
    
    // Official way to get coordinates in SVG space
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svgElement.getScreenCTM()?.inverse());
    
    const x = svgPoint.x;
    const y = svgPoint.y;
    
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

      addElement({
        type,
        team: team || 'none',
        position: { x, y },
        label: label,
        radius,
        angle: team === 'team2' ? 180 : 0,
        color
      });

      // Increment numbering if it was a numbered field player
      if (type === 'player' && label !== 'G') {
        incrementTeamNumber(team);
      }
    }
  }

  function onBackgroundClick(e: MouseEvent) {
    if (e.target === svgElement || e.target instanceof SVGRectElement) {
      selectedIds.set([]);
    }
  }
</script>

<div class="canvas-container" ondragover={onDragOver} ondrop={onDrop} aria-label="Drawing area" role="region">
  <svg 
    bind:this={svgElement}
    class="drawing-surface-vertical" 
    viewBox={
      $currentPage?.fieldTemplate === 'Complet' ? "-40 -40 760 1130" : 
      $currentPage?.fieldTemplate === 'Demi' ? "-40 -40 760 566.25" : 
      "-40 523.75 760 566.25"
    } 
    xmlns="http://www.w3.org/2000/svg"
    onmousedown={onBackgroundClick}
    role="application"
    tabindex="0"
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
    </defs>

    <g clip-path="url(#zoom-clip)">
      {#if $currentPage}
        <Pitch 
          template={$currentPage.fieldTemplate} 
          orientation="vertical" 
          showStripes={$currentPage.showFieldStripes} 
        />
        
        <g class="elements">
          {#each $currentPage.elements as element (element.id)}
            {#if element.type === 'player'}
              <Player {element} isSelected={$selectedIds.includes(element.id)} />
            {:else if element.type === 'ball'}
              <Ball {element} isSelected={$selectedIds.includes(element.id)} />
            {/if}
          {/each}
        </g>
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
