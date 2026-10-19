<script lang="ts">
  import { currentPage, selectedIds, updateElement, addElement } from '$lib/stores/workspace';
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
    viewBox="0 0 880 1250" 
    xmlns="http://www.w3.org/2000/svg"
    onmousedown={onBackgroundClick}
    role="img"
    aria-label="Tactical drawing board"
  >
    <defs>
      <pattern id="grid-vertical" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border-color)" stroke-opacity="0.2" stroke-width="1"/>
      </pattern>
    </defs>
    
    <rect width="100%" height="100%" fill="url(#grid-vertical)" />
    
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
    background-color: var(--bg-canvas);
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
  }
  
  .drawing-surface-vertical {
    height: 100%;
    aspect-ratio: 880 / 1250;
    max-width: 100%;
    background-color: #0f1a0f;
    box-shadow: 0 0 40px rgba(0,0,0,0.6);
  }

  @media print {
    .canvas-container {
      padding: 0;
      background: none;
      overflow: visible;
    }
    .drawing-surface-vertical {
      box-shadow: none;
      border: 1px solid #ccc;
    }
  }
</style>
