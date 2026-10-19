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
      addElement({
        type,
        team: team || 'none',
        position: { x, y },
        label: label,
        radius: type === 'ball' ? 8 : 14,
        color: team === 'team1' ? '#5e6ad2' : team === 'team2' ? '#d25e5e' : '#fff'
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
    viewBox={$currentPage?.fieldTemplate === 'Complet' ? "-40 -40 760 1130" : "-40 -40 760 605"} 
    xmlns="http://www.w3.org/2000/svg"
    onmousedown={onBackgroundClick}
    role="application"
    tabindex="0"
    aria-label="Tactical drawing board"
  >
    {#if $currentPage}
      <!-- Vertical Pitch -->
      <Pitch template={$currentPage.fieldTemplate} orientation="vertical" />

      {#each $currentPage.elements as element (element.id)}
        {#if element.type === 'player'}
          <Player {element} isSelected={$selectedIds.includes(element.id)} />
        {/if}
        {#if element.type === 'ball'}
          <Ball {element} isSelected={$selectedIds.includes(element.id)} />
        {/if}
      {/each}
    {/if}
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
