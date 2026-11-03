<script lang="ts">
  import { onMount } from 'svelte';

  let { value = $bindable('') } = $props<{ value: string }>();

  let host: HTMLDivElement | undefined = $state();

  onMount(() => {
    const node = host;
    const started = value;
    if (!node) return;
    let editor: { dispose: () => void; getModel: () => { dispose: () => void } | null } | null = null;
    let cancelled = false;
    void import('$lib/schema/monaco').then(monaco => {
      if (cancelled) return;
      editor = monaco.mountMarkdown(node, started, text => { value = text; }, 'file:///evaluation/content.md');
    });
    return () => {
      cancelled = true;
      editor?.getModel()?.dispose();
      editor?.dispose();
    };
  });
</script>

<div class="raw-md" bind:this={host}></div>

<style>
  .raw-md {
    height: 100%;
    min-height: 32rem;
    border: 1px solid var(--color-gray-200);
  }
</style>
