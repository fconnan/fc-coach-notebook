<script lang="ts">
  import { Carta, MarkdownEditor } from 'carta-md';
  import 'carta-md/default.css';
  import { setMarkdownContent } from '$lib/stores/workspace';
  import { onMount, onDestroy } from 'svelte';

  let { content = '' } = $props<{ content: string }>();

  // Initialize Carta
  const carta = new Carta({
    sanitizer: false, // For maximum flexibility if needed
  });

  let editorValue = $state(content);

  // Sync to store
  $effect(() => {
    setMarkdownContent(editorValue);
  });
</script>

<div class="carta-wrapper">
  <!-- MarkdownEditor from Carta -->
  <MarkdownEditor {carta} bind:value={editorValue} mode="tabs" />
</div>

<style>
  .carta-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #fff;
    color: #333;
    overflow: auto;
  }

  /* Some visual tweaks to make it feel more "A4" and standard */
  :global(.carta-editor) {
    height: 100% !important;
    border: none !important;
  }

  :global(.carta-input) {
    font-size: 15px !important;
    background: transparent !important;
    color: #333 !important;
    padding: 30px !important;
    font-family: inherit !important;
  }

  :global(.carta-renderer) {
    padding: 30px !important;
  }

  @media print {
    :global(.carta-input-wrapper) {
      display: none !important;
    }
  }
</style>
