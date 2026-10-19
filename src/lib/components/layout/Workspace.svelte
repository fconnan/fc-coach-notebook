<script lang="ts">
  import TopMenu from './TopMenu.svelte';
  import Toolbar from './Toolbar.svelte';
  import RightSidebar from './RightSidebar.svelte';
  import BottomTabs from './BottomTabs.svelte';
  import { currentPage } from '$lib/stores/workspace';
  import CanvasArea from '../canvas/CanvasArea.svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';
  
  // Right sidebar toggle state
  let showProperties = $state(true);
</script>

<div class="workspace">
  <div class="top-row">
    <TopMenu />
    <Toolbar bind:showProperties />
  </div>
  
  <div class="main-column">
    <div class="editor-pane">
      <MarkdownEditor content={$currentPage.markdownContent} />
    </div>
    
    <div class="canvas-pane">
      <CanvasArea />
    </div>

    {#if showProperties}
      <RightSidebar />
    {/if}
  </div>
  
  <BottomTabs />
</div>

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
    grid-template-columns: 1fr 1.2fr 280px; /* Text | Terrain (slightly larger) | Sidebar */
    height: 100%;
    overflow: hidden;
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
  }

  @media print {
    .top-row, :global(.bottom-tabs), :global(.right-sidebar) {
      display: none !important;
    }
    .workspace {
      display: block;
      height: auto;
      width: 100%;
    }
    .main-column {
      display: flex;
    }
  }
</style>
