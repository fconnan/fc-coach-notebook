<script lang="ts">
  import { FolderOutline, TrashBinOutline } from 'flowbite-svelte-icons';
  import type { LibraryItem } from '$lib/workspace/catalog';
  import ElementThumb from './ElementThumb.svelte';

  let { items, onopen, ondelete }: {
    items: LibraryItem[];
    onopen: (item: LibraryItem) => void;
    ondelete: (item: LibraryItem) => void;
  } = $props();

  let menu = $state<{ x: number; y: number; item: LibraryItem } | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);

  function openMenu(event: MouseEvent, item: LibraryItem) {
    event.preventDefault();
    menu = {
      x: Math.max(8, event.clientX),
      y: Math.max(8, event.clientY),
      item
    };
  }

  function away(event: PointerEvent) {
    if (!menu || (event.target instanceof Node && menuEl?.contains(event.target))) return;
    menu = null;
  }

  function remove() {
    const item = menu?.item;
    menu = null;
    if (item) ondelete(item);
  }

  $effect(() => {
    if (!menu || !menuEl) return;
    const box = menuEl.getBoundingClientRect();
    const x = Math.max(8, Math.min(menu.x, window.innerWidth - box.width - 8));
    const y = Math.max(8, Math.min(menu.y, window.innerHeight - box.height - 8));
    if (x !== menu.x || y !== menu.y) menu = { ...menu, x, y };
  });
</script>

<svelte:window
  onpointerdown={away}
  onkeydown={(event) => { if (event.key === 'Escape') menu = null; }}
  onscroll={() => { menu = null; }}
/>

{#if items.length}
  <div class="thumbs">
    {#each items as item (item.path)}
      <button
        type="button"
        class="thumb"
        onclick={() => onopen(item)}
        oncontextmenu={(event) => openMenu(event, item)}
      >
        <span class="frame" class:pitch={item.kind !== 'folder'}>
          {#if item.kind === 'folder'}
            <FolderOutline class="h-12 w-12 text-gray-500" />
          {:else}
            <ElementThumb file={item.path} kind={item.kind} />
          {/if}
        </span>
        <span class="name">{item.name}</span>
      </button>
    {/each}
  </div>
{:else}
  <p class="text-sm text-body">Aucun élément</p>
{/if}

{#if menu}
  <div class="menu" style:left="{menu.x}px" style:top="{menu.y}px" bind:this={menuEl} role="menu">
    <button type="button" role="menuitem" onclick={remove}>
      <TrashBinOutline size="sm" /> Supprimer
    </button>
  </div>
{/if}

<style>
  .thumbs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.75rem, 1fr));
    gap: 0.9rem;
  }
  .thumb {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.4rem;
    border: 0;
    background: transparent;
    padding: 0;
    color: inherit;
    cursor: pointer;
  }
  .frame {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid var(--color-default-medium);
    border-radius: var(--radius-base);
    background: var(--color-neutral-secondary-medium);
  }
  .frame.pitch { background: #166534; }
  .thumb:hover .frame,
  .thumb:focus-visible .frame { border-color: var(--color-brand); }
  .name {
    overflow: hidden;
    color: var(--color-heading);
    font-size: 0.8rem;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .menu {
    position: fixed;
    z-index: 80;
    min-width: 10rem;
    padding: 0.25rem;
    border: 1px solid var(--color-default-medium);
    border-radius: 0.5rem;
    background: var(--color-neutral-primary);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
  }
  .menu button {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.45rem;
    border: 0;
    border-radius: 0.35rem;
    background: transparent;
    padding: 0.4rem 0.55rem;
    color: #dc2626;
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
  }
  .menu button:hover { background: var(--color-neutral-secondary-medium); }
</style>
