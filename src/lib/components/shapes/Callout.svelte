<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { updateElement, pushHistory } from '$lib/stores/workspace';
  import { beginElementDrag, svgPoint } from '$lib/utils/interactions';

  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();

  const fontSize = $derived(element.fontSize || 13);
  const textColor = $derived(element.color || '#1a1a1a');
  const fill = $derived(element.fillColor || '#fdf7d0');
  const text = $derived(element.text || 'Annotation');
  const lines = $derived(text.split('\n'));
  const bw = $derived(element.width || 180);
  const bh = $derived(Math.max(element.height || 0, lines.length * fontSize * 1.35 + 16));
  // Tip of the callout, relative to the box center
  const tip = $derived(element.calloutAnchor || { x: -bw / 2 - 30, y: bh / 2 + 30 });

  let editing = $state(false);
  let inputEl: HTMLTextAreaElement | undefined = $state();
  let svgEl: SVGSVGElement | null = null;

  function onPointerDown(e: PointerEvent) {
    if (editing) return;
    beginElementDrag(e, element);
  }
  function startEdit(e: MouseEvent) {
    e.stopPropagation();
    editing = true;
    queueMicrotask(() => inputEl?.focus());
  }

  function onTipDown(e: PointerEvent) {
    e.stopPropagation();
    svgEl = (e.currentTarget as SVGElement).ownerSVGElement;
    pushHistory(true);
    window.addEventListener('pointermove', onTipMove);
    window.addEventListener('pointerup', onTipUp);
  }
  function onTipMove(e: PointerEvent) {
    if (!svgEl) return;
    const p = svgPoint(svgEl, e.clientX, e.clientY);
    updateElement(element.id, {
      calloutAnchor: { x: p.x - element.position.x, y: p.y - element.position.y }
    });
  }
  function onTipUp() {
    window.removeEventListener('pointermove', onTipMove);
    window.removeEventListener('pointerup', onTipUp);
  }

  // Build a bubble path with a triangular tail pointing to the tip
  const tailBase = $derived.by(() => {
    // Pick the box edge midpoint closest to the tip for the tail anchor
    const ax = Math.max(-bw / 2 + 10, Math.min(bw / 2 - 10, tip.x));
    return { x: ax, y: bh / 2 };
  });
</script>

<g
  class="callout-element"
  data-id={element.id}
  role="button"
  tabindex="0"
  aria-label="Bulle d'annotation"
  onpointerdown={onPointerDown}
  ondblclick={startEdit}
  transform="translate({element.position.x}, {element.position.y})"
>
  <!-- Tail -->
  <path
    d="M {tailBase.x - 10} {bh / 2 - 2} L {tip.x} {tip.y} L {tailBase.x + 10} {bh / 2 - 2} Z"
    fill={fill} stroke="rgba(0,0,0,0.25)" stroke-width="1"
  />
  <!-- Bubble -->
  <rect
    x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx="8"
    fill={fill} stroke="rgba(0,0,0,0.25)" stroke-width="1"
    style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));"
  />

  <text
    text-anchor="middle"
    fill={textColor}
    font-size={fontSize}
    pointer-events="none"
  >
    {#each lines as line, i}
      <tspan x="0" y={-bh / 2 + 14 + i * fontSize * 1.35}>{line || ' '}</tspan>
    {/each}
  </text>

  {#if isSelected}
    <rect
      x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx="8"
      fill="none" stroke="var(--accent-primary)" stroke-width="1.5"
      stroke-dasharray="4,3" pointer-events="none"
    />
    <circle
      class="tip-handle"
      cx={tip.x} cy={tip.y} r="5"
      fill="var(--bg-panel)" stroke="var(--accent-primary)" stroke-width="2"
      role="button" tabindex="0" aria-label="Déplacer la pointe"
      onpointerdown={onTipDown}
    />
  {/if}

  {#if editing}
    <foreignObject x={-bw / 2} y={-bh / 2} width={bw} height={bh}>
      <textarea
        bind:this={inputEl}
        class="inline-edit"
        value={element.text || ''}
        oninput={(e) => updateElement(element.id, { text: e.currentTarget.value })}
        onblur={() => editing = false}
        onpointerdown={(e) => e.stopPropagation()}
      ></textarea>
    </foreignObject>
  {/if}
</g>

<style>
  .callout-element { cursor: grab; outline: none; }
  .callout-element:active { cursor: grabbing; }
  .tip-handle { cursor: move; }
  .inline-edit {
    width: 100%;
    height: 100%;
    resize: none;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #1a1a1a;
    font-size: 13px;
    padding: 8px;
    font-family: inherit;
    text-align: center;
  }
</style>
