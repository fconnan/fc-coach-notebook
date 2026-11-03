<script lang="ts">
  import type { Snippet } from 'svelte';

  let { label, onclick, disabled = false, children }: {
    label: string;
    onclick: () => void;
    disabled?: boolean;
    children: Snippet;
  } = $props();
</script>

<button type="button" class="quiet" aria-label={label} title={label} disabled={disabled} {onclick}>
  {@render children()}
</button>

<style>
  .quiet {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    padding: 2px;
    line-height: 0;
    color: white;
    background: var(--color-brand);
    border-radius: 0.375rem;
  }

  .quiet:hover:not(:disabled) {
    color: white;
    background: var(--color-brand-strong);
  }

  .quiet:disabled {
    opacity: 0.4;
  }
</style>
