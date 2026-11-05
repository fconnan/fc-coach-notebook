<script lang="ts">
  import { onMount } from 'svelte';
  import RawWait from './RawWait.svelte';

  let { value = $bindable(''), uri = 'file:///evaluation/content.md' } = $props<{ value: string; uri?: string }>();

  let host: HTMLDivElement | undefined = $state();
  let editorReady = $state(false);

  onMount(() => {
    const node = host;
    const started = value;
    if (!node) return;
    let editor: { dispose: () => void; getModel: () => { dispose: () => void } | null } | null = null;
    let cancelled = false;
    void import('$lib/schema/monaco').then(monaco => {
      if (cancelled) return;
      editor = monaco.mountMarkdown(node, started, text => { value = text; }, uri);
      editorReady = true;
    }).catch(() => {
      editorReady = true;
    });
    return () => {
      cancelled = true;
      editor?.getModel()?.dispose();
      editor?.dispose();
    };
  });
</script>

<div class="raw-md">
  <RawWait ready={editorReady}>
    <div class="sheet" bind:this={host}></div>
  </RawWait>
</div>

<style>
  .raw-md {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 32rem;
    border: 1px solid var(--color-gray-200);
  }
  .sheet { flex: 1 1 auto; min-width: 0; min-height: 0; }
</style>
