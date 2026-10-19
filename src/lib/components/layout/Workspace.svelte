<script lang="ts">
  import TopMenu from './TopMenu.svelte';
  import Toolbar from './Toolbar.svelte';
  import RightSidebar from './RightSidebar.svelte';
  import BottomTabs from './BottomTabs.svelte';
  import { currentPage, setMarkdownContent, isTacticLoaded, activeDirectoryHandle } from '$lib/stores/workspace';
  import CanvasArea from '../canvas/CanvasArea.svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import WelcomeScreen from './WelcomeScreen.svelte';
  import { fade } from 'svelte/transition';
  import { hasActiveDirectory } from '$lib/services/tacticFileService';
  
  // Right sidebar toggle state
  let showProperties = $state(true);

  // Handle changes from the editor
  function handleMarkdownChange(newVal: string) {
    setMarkdownContent(newVal);
  }
</script>

{#if $isTacticLoaded || $activeDirectoryHandle}
  <div class="workspace">
    <div class="top-row">
      <TopMenu />
      <Toolbar bind:showProperties />
    </div>
    
    {#key $currentPage.id}
      <div class="main-column" in:fade={{ duration: 200, delay: 100 }}>
        {#if $isTacticLoaded}
          <div class="editor-pane">
            <MarkdownEditor value={$currentPage?.markdownContent || ''} onchange={handleMarkdownChange} />
          </div>
          
          <div class="drawing-container">
            <div class="canvas-pane" style:aspect-ratio={$currentPage?.fieldTemplate === 'Complet' ? '760 / 1130' : '760 / 566.25'}>
              <CanvasArea />
            </div>

            {#if showProperties}
              <RightSidebar />
            {/if}
          </div>
        {:else}
          <div class="empty-workspace-state">
            <p>Sélectionnez une tactique dans l'explorateur ou cliquez sur le dossier dans la barre de menu.</p>
          </div>
        {/if}
      </div>
    {/key}
    
    <BottomTabs />
  </div>
{:else}
  <WelcomeScreen />
{/if}

<style>
  .workspace {
    display: grid;
    grid-template-rows: auto 1fr 32px;
    height: 100vh;
    width: 100vw;
    background-color: var(--bg-app);
  }
  
  .top-row {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--border-color);
    z-index: 100;
  }
  
  .main-column {
    display: grid;
    grid-template-columns: 1fr auto; 
    height: 100%;
    overflow: hidden;
  }

  .drawing-container {
    display: flex;
    height: 100%;
    overflow: hidden;
    background-color: #2b6b39; /* Matches pitch background */
  }

  .editor-pane {
    border-right: 1px solid var(--border-color);
    height: 100%;
    overflow: hidden;
    background-color: #fff;
  }

  .canvas-pane {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    /* Width will be determined by SVG aspect ratio */
  }

  @media print {
    .top-row, :global(.bottom-tabs), :global(.right-sidebar) {
      display: none !important;
    }
    .workspace {
      display: block;
      height: 210mm;
      width: 297mm;
    }
    .main-column {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      height: 210mm;
      width: 297mm;
    }
    .editor-pane, .canvas-pane {
      width: 100% !important;
      height: 100% !important;
      border: none !important;
    }
  }

  .empty-workspace-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    color: var(--text-muted);
    font-style: italic;
    background-color: var(--bg-app);
    grid-column: span 2;
  }
</style>
