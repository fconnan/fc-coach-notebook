<script lang="ts">
  import { currentPage, selectedIds } from '$lib/stores/workspace';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import Player from '../shapes/Player.svelte';
  import Ball from '../shapes/Ball.svelte';
  import Pitch from '../shapes/Pitch.svelte';

  let { activePage } = $props<{ activePage: any }>();

  // For the sheet, we'll use a fixed SVG container
  // A4 Landscape is 297x210mm.
  // Our internal pitch is 1050x680. 
  // Rotated it's 680x1050.
  // We'll scale it to fit the right half of the A4.
</script>

<div class="printable-fiche">
  <div class="left-pane">
    <MarkdownEditor />
  </div>
  
  <div class="right-pane">
    <div class="canvas-print-wrap">
      <svg 
        class="print-svg" 
        viewBox="0 0 880 1250" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100%" height="100%" fill="#eee" />
        
        <!-- Render the vertical pitch -->
        <Pitch orientation="vertical" template={activePage.fieldTemplate} />
        
        <!-- Render elements (rotated logic?) -->
        <!-- To keep it simple, we wrap all elements in a group that rotates them 
             BUT individual player positions (x, y) were calculated on a horizontal plane.
             Wait, if the pitch rotates, they should rotate too. -->
        <g transform="rotate(270, 625, 440) translate(0, 0)"> 
             <!-- Wait, rotation center needs to be the center of the pitch 
                  Let's just use the same transform logic as Pitch if possible.
                  Actually, the pitch rotation should be consistent across ALL elements.
                  I'll use transform="rotate(90, 625, 440)" to match Pitch's internal logic 
                  if I follow the same convention.
             -->
             {#each activePage.elements as element (element.id)}
               {#if element.type === 'player'}
                 <Player {element} isSelected={$selectedIds.includes(element.id)} />
               {/if}
               {#if element.type === 'ball'}
                 <Ball {element} isSelected={$selectedIds.includes(element.id)} />
               {/if}
             {/each}
        </g>
      </svg>
    </div>
  </div>
</div>

<style>
  .printable-fiche {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 100%;
    background-color: var(--bg-canvas);
    overflow: hidden;
  }

  .left-pane, .right-pane {
    height: 100%;
    overflow: hidden;
  }

  .right-pane {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #222;
    padding: 20px;
  }

  .canvas-print-wrap {
    background-color: #fff;
    width: 100%;
    height: 100%;
    max-width: 210mm; /* Aspect ratio of half A4 landscape is vertical A4? No. 
                        A4 landscape is 297w x 210h. 
                        Half is 148.5w x 210h (Portrait A5).
                        Yes. */
    aspect-ratio: 148.5 / 210;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  .print-svg {
    width: 100%;
    height: 100%;
  }

  @media print {
    :global(body) {
      background: #fff !important;
      color: #000 !important;
    }

    .printable-fiche {
      display: block; /* Stack or keep grid? For A4 landscape, grid should stay? */
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 297mm;
      height: 210mm;
      position: absolute;
      top: 0;
      left: 0;
      background: white;
    }

    .right-pane {
      background: none;
      padding: 0;
    }

    .canvas-print-wrap {
      box-shadow: none;
      border: 1px solid #ccc;
    }

    /* Hide standard workspace buttons etc */
    :global(.top-row, .bottom-tabs, .left-sidebar, .right-sidebar) {
      display: none !important;
    }
  }
</style>
