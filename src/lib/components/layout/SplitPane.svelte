<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    view,
    left,
    right,
    stack = false,
    class: className = ''
  }: {
    /** Clé de sauvegarde : une position par type de vue. */
    view: string;
    left: Snippet;
    right: Snippet;
    /** Empile les panneaux sur petit écran. */
    stack?: boolean;
    class?: string;
  } = $props();

  const MIN = 0.15;
  const STEP = 0.02;

  let box = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);
  let ratio = $derived(saved(view));

  function key(name: string): string {
    return `fctactics.split.${name}`;
  }

  function saved(name: string): number | null {
    try {
      const value = Number(sessionStorage.getItem(key(name)));
      return value > 0 && value < 1 ? value : null;
    } catch {
      return null;
    }
  }

  function store() {
    try {
      if (ratio == null) sessionStorage.removeItem(key(view));
      else sessionStorage.setItem(key(view), String(Math.round(ratio * 1000) / 1000));
    } catch { /* ignore */ }
  }

  function clamp(value: number): number {
    return Math.min(1 - MIN, Math.max(MIN, value));
  }

  function current(handle: HTMLElement): number {
    if (ratio != null) return ratio;
    const first = handle.previousElementSibling?.getBoundingClientRect().width ?? 0;
    const second = handle.nextElementSibling?.getBoundingClientRect().width ?? 0;
    return first + second ? first / (first + second) : 0.5;
  }

  function down(event: PointerEvent) {
    if (event.button !== 0 || !box) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragging = true;
    const move = (pointer: PointerEvent) => {
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const span = rect.width - handle.offsetWidth;
      if (span <= 0) return;
      ratio = clamp((pointer.clientX - rect.left - handle.offsetWidth / 2) / span);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      dragging = false;
      store();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  function nudge(event: KeyboardEvent) {
    const handle = event.currentTarget as HTMLElement;
    if (event.key === 'ArrowLeft') ratio = clamp(current(handle) - STEP);
    else if (event.key === 'ArrowRight') ratio = clamp(current(handle) + STEP);
    else if (event.key === 'Home') ratio = MIN;
    else if (event.key === 'End') ratio = 1 - MIN;
    else return;
    event.preventDefault();
    store();
  }

  function reset() {
    ratio = null;
    store();
  }
</script>

<div
  class="split {className}"
  class:stack
  class:dragging
  bind:this={box}
  style:--split-left={ratio == null ? undefined : `${ratio}fr`}
  style:--split-right={ratio == null ? undefined : `${1 - ratio}fr`}
>
  <div class="side">{@render left()}</div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="grip"
    role="separator"
    aria-orientation="vertical"
    aria-label="Redimensionner les panneaux"
    aria-valuemin={MIN * 100}
    aria-valuemax={(1 - MIN) * 100}
    aria-valuenow={ratio == null ? 50 : Math.round(ratio * 100)}
    title="Glisser pour redimensionner, double-clic pour réinitialiser"
    tabindex="0"
    onpointerdown={down}
    onkeydown={nudge}
    ondblclick={reset}
  ><span></span></div>
  <div class="side">{@render right()}</div>
</div>

<style>
  .split {
    display: grid;
    grid-template-columns: minmax(0, var(--split-left, 1fr)) 0.75rem minmax(0, var(--split-right, 1fr));
    min-width: 0;
    min-height: 0;
  }
  .split.dragging { cursor: col-resize; user-select: none; }
  .side {
    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
  }
  .grip {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: col-resize;
    touch-action: none;
    outline: none;
  }
  .grip span {
    width: 3px;
    height: 2.5rem;
    border-radius: 2px;
    background: var(--color-default-medium, #d1d5db);
    transition: background 0.15s, height 0.15s;
  }
  .grip:hover span,
  .grip:focus-visible span,
  .dragging .grip span {
    height: 4rem;
    background: var(--color-brand, #2563eb);
  }
  @media (max-width: 767.98px) {
    .split.stack {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: minmax(0, 1fr);
      row-gap: 1rem;
    }
    .split.stack .grip { display: none; }
  }
</style>
