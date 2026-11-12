<script lang="ts">
  import type { DrawShape } from '$lib/editor/drawShapes';

  let {
    shapes,
    fittable = false,
    fitHome = true,
    oninsert,
    onfit,
    onzoom
  }: {
    shapes: DrawShape[];
    /** Ajuster le viewBox. Réservé à l’éditeur de fichier SVG. */
    fittable?: boolean;
    /** Le cadrage montre déjà tous les objets : Fit Zoom reste masqué. */
    fitHome?: boolean;
    oninsert: (kind: string) => void;
    onfit?: () => void;
    onzoom?: () => void;
  } = $props();
</script>

<div class="tools">
  {#each shapes as shape (shape.kind)}
    <button type="button" title={shape.label} aria-label={shape.label} onclick={() => oninsert(shape.kind)}>
      {@render icon(shape.d)}
    </button>
  {/each}
  {#if fittable}
    <span class="sep"></span>
    <button type="button" title="Ajuster le viewBox" aria-label="Ajuster le viewBox" onclick={() => onfit?.()}>
      {@render icon('M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M9 9h6v6H9z')}
    </button>
  {/if}
  {#if onzoom && !fitHome}
    <button type="button" class="zoom" title="Zoom pour voir tous les objets" onclick={() => onzoom?.()}>Fit Zoom</button>
  {/if}
</div>

{#snippet icon(d: string)}
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path {d} /></svg>
{/snippet}

<style>
  .tools {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.2rem;
    overflow: auto;
    border-bottom: 1px solid var(--color-default-medium);
    background: var(--color-neutral-primary);
    padding: 0.3rem;
  }
  .tools button {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border: 1px solid transparent;
    border-radius: 0.3rem;
    background: transparent;
    color: var(--color-heading);
  }
  .tools button:hover:not(:disabled) {
    border-color: var(--color-default-medium);
    background: var(--color-neutral-secondary-medium);
  }
  .tools button.zoom {
    width: auto;
    margin-left: auto;
    border-color: var(--color-default-medium);
    padding: 0 0.55rem;
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .zoom:hover { background: var(--color-neutral-secondary-medium); }
  .sep {
    flex-shrink: 0;
    width: 1px;
    height: 1.2rem;
    margin: 0 0.15rem;
    background: var(--color-default-medium);
  }
</style>
