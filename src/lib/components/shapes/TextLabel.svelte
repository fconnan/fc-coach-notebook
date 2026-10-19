<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { updateElement } from '$lib/stores/workspace';
  import { beginElementDrag } from '$lib/utils/interactions';

  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();

  const fontSize = $derived(element.fontSize || 24);
  const color = $derived(element.color || '#ffffff');
  const fontWeight = $derived(element.fontWeight || 'bold');
  const fontStyle = $derived(element.fontStyle || 'normal');
  const decoration = $derived(element.textDecoration || 'none');
  const angle = $derived(element.angle || 0);
  const text = $derived(element.text || 'Texte');
  const lines = $derived(text.split('\n'));

  let editing = $state(false);
  let inputEl: HTMLTextAreaElement | undefined = $state();

  function onPointerDown(e: PointerEvent) {
    if (editing) return;
    beginElementDrag(e, element);
  }

  function startEdit(e: MouseEvent) {
    e.stopPropagation();
    editing = true;
    queueMicrotask(() => inputEl?.focus());
  }

  function commit() {
    editing = false;
  }
</script>

<g
  class="text-element"
  data-id={element.id}
  role="button"
  tabindex="0"
  aria-label="Texte"
  onpointerdown={onPointerDown}
  ondblclick={startEdit}
  transform="translate({element.position.x}, {element.position.y}) rotate({angle})"
>
  {#if isSelected}
    {@const bw = Math.max(...lines.map((l: string) => l.length)) * fontSize * 0.55 + 12}
    {@const bh = lines.length * fontSize * 1.2 + 8}
    <rect
      x={-bw / 2} y={-bh / 2} width={bw} height={bh}
      fill="rgba(94,106,210,0.08)" stroke="var(--accent-primary)"
      stroke-width="1" stroke-dasharray="4,3" rx="3" pointer-events="none"
    />
  {/if}

  <text
    text-anchor="middle"
    dominant-baseline="central"
    fill={color}
    font-size={fontSize}
    font-weight={fontWeight}
    font-style={fontStyle}
    text-decoration={decoration}
    style="paint-order: stroke; stroke: rgba(0,0,0,0.5); stroke-width: 0.5px;"
    pointer-events="none"
  >
    {#each lines as line, i}
      <tspan x="0" dy={i === 0 ? `${-(lines.length - 1) * 0.6}em` : '1.2em'}>{line || ' '}</tspan>
    {/each}
  </text>

  {#if editing}
    <foreignObject x={-110} y={-30} width="220" height="60">
      <textarea
        bind:this={inputEl}
        class="inline-edit"
        value={element.text || ''}
        oninput={(e) => updateElement(element.id, { text: e.currentTarget.value })}
        onblur={commit}
        onpointerdown={(e) => e.stopPropagation()}
      ></textarea>
    </foreignObject>
  {/if}
</g>

<style>
  .text-element { cursor: grab; outline: none; }
  .text-element:active { cursor: grabbing; }
  .inline-edit {
    width: 100%;
    height: 100%;
    resize: none;
    border: 1px solid var(--accent-primary);
    border-radius: 4px;
    background: #1e1e1e;
    color: #fff;
    font-size: 13px;
    padding: 4px;
    font-family: inherit;
  }
</style>
