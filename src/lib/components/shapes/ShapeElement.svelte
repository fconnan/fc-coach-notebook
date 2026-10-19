<script lang="ts">
  import type { ComponentElement } from '$lib/stores/workspace';
  import { updateElement, pushHistory } from '$lib/stores/workspace';
  import { beginElementDrag, svgPoint } from '$lib/utils/interactions';

  let { element, isSelected } = $props<{ element: ComponentElement, isSelected: boolean }>();

  const w = $derived(element.width || 120);
  const h = $derived(element.height || 80);
  const angle = $derived(element.angle || 0);
  const stroke = $derived(element.color || '#ffffff');
  const strokeWidth = $derived(element.strokeWidth || 2);
  const dash = $derived(element.strokeDasharray || '');
  const isZone = $derived(element.type === 'zone');
  const fill = $derived(
    element.type === 'zone'
      ? (element.fillColor || '#9bd64a')
      : (element.fillColor || 'none')
  );
  const fillOpacity = $derived(
    element.type === 'zone'
      ? (element.fillOpacity ?? 0.25)
      : (element.fillOpacity ?? (element.fillColor && element.fillColor !== 'none' ? 0.3 : 0))
  );

  function onPointerDown(e: PointerEvent) {
    beginElementDrag(e, element);
  }

  // SE resize handle (symmetric around center)
  let svgEl: SVGSVGElement | null = null;
  function onResizeDown(e: PointerEvent) {
    e.stopPropagation();
    svgEl = (e.currentTarget as SVGElement).ownerSVGElement;
    pushHistory(true);
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeUp);
  }
  function onResizeMove(e: PointerEvent) {
    if (!svgEl) return;
    const p = svgPoint(svgEl, e.clientX, e.clientY);
    const nw = Math.max(20, Math.abs(p.x - element.position.x) * 2);
    const nh = Math.max(20, Math.abs(p.y - element.position.y) * 2);
    updateElement(element.id, { width: nw, height: nh });
  }
  function onResizeUp() {
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeUp);
  }
</script>

<g
  class="shape-element"
  data-id={element.id}
  role="button"
  tabindex="0"
  aria-label="Forme"
  onpointerdown={onPointerDown}
  transform="translate({element.position.x}, {element.position.y}) rotate({angle})"
>
  {#if element.type === 'ellipse'}
    <ellipse
      cx="0" cy="0" rx={w / 2} ry={h / 2}
      fill={fill} fill-opacity={fillOpacity}
      stroke={stroke} stroke-width={strokeWidth} stroke-dasharray={dash}
    />
  {:else}
    <rect
      x={-w / 2} y={-h / 2} width={w} height={h}
      rx={isZone ? 6 : 2}
      fill={fill} fill-opacity={fillOpacity}
      stroke={stroke} stroke-width={strokeWidth} stroke-dasharray={dash}
    />
  {/if}

  {#if isSelected}
    <rect
      x={-w / 2} y={-h / 2} width={w} height={h}
      fill="none" stroke="var(--accent-primary)" stroke-width="1.5"
      stroke-dasharray="4,3" pointer-events="none"
    />
    <!-- SE resize handle -->
    <circle
      class="resize-handle"
      cx={w / 2} cy={h / 2} r="6"
      fill="var(--bg-panel)" stroke="var(--accent-primary)" stroke-width="2"
      role="button" tabindex="0" aria-label="Redimensionner"
      onpointerdown={onResizeDown}
    />
    {#if element.locked}
      <text x={0} y={-h / 2 - 6} text-anchor="middle" font-size="12" fill="#ffd54f">🔒</text>
    {/if}
  {/if}
</g>

<style>
  .shape-element { cursor: grab; outline: none; }
  .shape-element:active { cursor: grabbing; }
  .resize-handle { cursor: nwse-resize; }
</style>
