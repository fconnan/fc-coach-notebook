<script lang="ts">
  import type { Snippet } from 'svelte';
  import LoadingIcon from './LoadingIcon.svelte';

  let { ready = false, error = '', children }: { ready?: boolean; error?: string; children: Snippet } = $props();
</script>

<div class="raw">
  {@render children()}
  {#if !ready && !error}
    <div class="wait" role="status"><LoadingIcon /></div>
  {/if}
</div>

<style>
  .raw {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    align-self: stretch;
    min-width: 0;
    min-height: 0;
  }
  .wait {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-neutral-primary);
    color: var(--color-heading, #111827);
  }
  .wait :global(svg) {
    width: 2.5rem;
    height: 2.5rem;
  }
</style>
