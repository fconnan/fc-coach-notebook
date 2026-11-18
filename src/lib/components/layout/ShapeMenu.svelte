<script lang="ts">
  import type { PathKind } from '$lib/editor/pathEdit';

  let {
    x,
    y,
    fill = '',
    stroke = '',
    scope = 'shape',
    kind = null,
    canAdd = false,
    canRemove = false,
    addLabel = 'Ajouter un point',
    removeLabel = 'Enlever ce point',
    sections = [],
    onpaint,
    ondelete,
    onadd,
    onremove,
    onkind,
    onparam
  }: {
    x: number;
    y: number;
    fill?: string;
    stroke?: string;
    /** Courbe, point du chemin, ou autre forme. */
    scope?: 'shape' | 'path' | 'point';
    /** Présent pour un chemin dont on peut changer la courbe. */
    kind?: PathKind | null;
    canAdd?: boolean;
    canRemove?: boolean;
    addLabel?: string;
    removeLabel?: string;
    sections?: { key: string; names: string[]; current: string }[];
    onpaint: (name: 'fill' | 'stroke', value: string) => void;
    ondelete: () => void;
    onadd?: () => void;
    onremove?: () => void;
    onkind?: (kind: PathKind) => void;
    onparam?: (key: string, value: string) => void;
  } = $props();

  let node = $state<HTMLDivElement | null>(null);
  let left = $state(0);
  let top = $state(0);
  const kinds: { id: PathKind; label: string }[] = [
    { id: 'smooth', label: 'Courbe' },
    { id: 'line', label: 'Segments' },
    { id: 'free', label: 'Bézier' }
  ];

  function hex(value: string, fallback: string): string {
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  }

  $effect(() => {
    x;
    y;
    const box = node?.getBoundingClientRect();
    if (!box) return;
    left = Math.max(8, Math.min(x, window.innerWidth - box.width - 8));
    top = Math.max(8, Math.min(y, window.innerHeight - box.height - 8));
  });
</script>

<div class="menu" style:left="{node ? left : x}px" style:top="{node ? top : y}px" bind:this={node} role="menu" tabindex="-1" onpointerdown={(event) => event.stopPropagation()}>
  {#if scope === 'path'}
    <p class="title">Courbe</p>
    {#if canAdd}
      <button type="button" role="menuitem" onclick={() => onadd?.()}>{addLabel}</button>
    {/if}
    {#if kind}
      <div class="kinds" role="group" aria-label="Type de courbe">
        {#each kinds as item (item.id)}
          <button type="button" aria-pressed={kind === item.id} onclick={() => onkind?.(item.id)}>{item.label}</button>
        {/each}
      </div>
    {/if}
  {:else if scope === 'point'}
    <p class="title">Point</p>
    <button type="button" role="menuitem" disabled={!canRemove} onclick={() => onremove?.()}>{removeLabel}</button>
  {/if}
  {#if scope !== 'point'}
  <label class="swatch">
    <span>Remplissage</span>
    <span class="chip" style:background={fill && fill !== 'none' ? fill : 'transparent'}></span>
    <input type="color" aria-label="Remplissage" value={hex(fill, '#f59e0b')} oninput={(event) => onpaint('fill', event.currentTarget.value)} />
  </label>
  <label class="swatch">
    <span>Contour</span>
    <span class="chip ring" style:border-color={stroke && stroke !== 'none' ? stroke : '#111827'}></span>
    <input type="color" aria-label="Contour" value={hex(stroke, '#b45309')} oninput={(event) => onpaint('stroke', event.currentTarget.value)} />
  </label>
  <button type="button" role="menuitem" onclick={ondelete}>Supprimer</button>
  {/if}
  {#each sections as section (section.key)}
    <p class="title">{section.key}</p>
    <button type="button" role="menuitemradio" aria-checked={!section.current} class:on={!section.current} onclick={() => onparam?.(section.key, '')}>
      <span class="tick">{!section.current ? '✓' : ''}</span>Défaut
    </button>
    {#each section.names as name (name)}
      <button type="button" role="menuitemradio" aria-checked={name === section.current} class:on={name === section.current} onclick={() => onparam?.(section.key, name)}>
        <span class="tick">{name === section.current ? '✓' : ''}</span>{name}
      </button>
    {/each}
  {/each}
</div>

<style>
  .menu {
    position: fixed;
    z-index: 80;
    min-width: 14rem;
    max-height: 70vh;
    overflow: auto;
    padding: 0.25rem;
    border: 1px solid var(--color-default-medium);
    border-radius: 0.5rem;
    background: var(--color-neutral-primary);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
  }
  .menu button,
  .swatch {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.55rem;
    border: 0;
    border-radius: 0.35rem;
    background: transparent;
    padding: 0.4rem 0.55rem;
    color: var(--color-heading);
    font-size: 0.875rem;
    text-align: left;
  }
  .menu button { cursor: pointer; }
  .menu button:hover:not(:disabled), .menu button.on, .swatch:hover { background: var(--color-neutral-secondary-medium); }
  .tick { width: 1rem; flex: none; }
  .menu button:disabled { opacity: 0.4; cursor: default; }
  .title {
    margin: 0;
    padding: 0.25rem 0.55rem 0.1rem;
    color: var(--color-body);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .menu button[aria-pressed='true'] { background: var(--color-neutral-secondary-medium); font-weight: 600; }
  .kinds {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.2rem;
    padding: 0.15rem;
  }
  .kinds button { justify-content: center; padding-inline: 0.3rem; }
  .swatch { position: relative; cursor: pointer; }
  .swatch span:first-child { flex: 1 1 auto; }
  .chip {
    width: 1.05rem;
    height: 1.05rem;
    border: 1px solid rgba(17, 24, 39, 0.35);
    border-radius: 0.2rem;
  }
  .chip.ring { border-width: 4px; background: transparent; }
  .swatch input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
</style>
