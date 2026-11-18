<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    top,
    tools,
    extra,
    bottom,
    children
  }: {
    class?: string;
    /** Barre haute. Dans le schéma, les dossiers d’éléments. */
    top?: Snippet;
    /** Outils de tracé. */
    tools?: Snippet;
    /** Réglages sous les outils : paramètres SVG, étirement. */
    extra?: Snippet;
    /** Barre basse. Dans le schéma, la lecture de l’animation. */
    bottom?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<div class="stage {className}">
  {#if top}
    <div class="top">{@render top()}</div>
  {/if}
  {#if tools}{@render tools()}{/if}
  {#if extra}{@render extra()}{/if}
  <div class="canvas">
    {#if children}{@render children()}{/if}
  </div>
  {#if bottom}{@render bottom()}{/if}
</div>

<style>
  .stage {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    border: 1px solid var(--color-default-medium);
    border-radius: var(--radius-base);
    background: #166534;
  }
  .top {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.12rem 0.28rem;
    min-width: 0;
    border-bottom: 1px solid var(--color-default-medium);
    background: var(--color-neutral-primary);
    padding: 0.12rem 0.3rem;
  }
  .canvas {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
</style>
