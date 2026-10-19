<script lang="ts">
  import { onMount } from 'svelte';
  import { Crepe, CrepeFeature } from '@milkdown/crepe';
  import type { Action } from 'svelte/action';

  // Import Crepe styles
  import '@milkdown/crepe/theme/common/style.css';
  import '@milkdown/crepe/theme/frame.css';

  // Svelte 5 props
  let { value = $bindable(''), placeholder = 'Start typing...' } = $props();

  let editor: any = null;

  const milkdown: Action = (node) => {
    const crepe = new Crepe({
      root: node,
      defaultValue: value,
      placeholder,
      features: {
        [CrepeFeature.Table]: true, // Explicitly enable tables as requested
      },
      featureConfigs: {
        // You can add more configurations here if needed
      }
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        value = markdown;
      });
    });

    crepe.create().then((instance) => {
      editor = instance;
    });

    return {
      destroy() {
        if (crepe) {
          crepe.destroy();
        }
      }
    };
  };
</script>

<div class="editor-container">
  <div use:milkdown class="milkdown-wrapper"></div>
</div>

<style>
  .editor-container {
    width: 100%;
    height: 100%;
    min-height: 300px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background-color: #ffffff;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    transition: all 0.2s ease;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .editor-container:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .milkdown-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    font-family: 'Inter', ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  }

  /* Customizing Milkdown's look and feel for a more premium experience */
  :global(.milkdown) {
    height: 100%;
    max-width: 100% !important;
  }

  :global(.milkdown .editor) {
    padding: 0 !important;
    outline: none !important;
  }

  /* Ensuring tables are well-styled */
  :global(.milkdown table) {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
    border: 1px solid #e2e8f0;
  }

  :global(.milkdown th, .milkdown td) {
    border: 1px solid #e2e8f0;
    padding: 0.75rem;
    text-align: left;
  }

  :global(.milkdown th) {
    background-color: #f8fafc;
    font-weight: 600;
  }

  /* Scrollbar styling for better aesthetics */
  .milkdown-wrapper::-webkit-scrollbar {
    width: 8px;
  }

  .milkdown-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }

  .milkdown-wrapper::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .milkdown-wrapper::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
</style>


