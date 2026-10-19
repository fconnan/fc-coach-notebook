<script lang="ts">
  let { onDelta } = $props<{ onDelta: (dx: number) => void }>();

  let dragging = false;
  let lastX = 0;

  function down(e: PointerEvent) {
    dragging = true;
    lastX = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.style.cursor = 'ew-resize';
    e.preventDefault();
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    if (dx !== 0) onDelta(dx);
  }
  function up() {
    dragging = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    document.body.style.cursor = '';
  }
</script>

<div class="resizer" role="separator" aria-orientation="vertical" tabindex="-1" onpointerdown={down}>
  <span class="grip"></span>
</div>

<style>
  .resizer {
    flex: 0 0 auto;
    width: 6px;
    cursor: ew-resize;
    background: var(--bg-app);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 5;
  }
  .resizer:hover .grip,
  .resizer:active .grip {
    background: var(--accent-primary);
  }
  .grip {
    width: 2px;
    height: 36px;
    border-radius: 2px;
    background: var(--border-color);
    transition: background 0.15s;
  }
</style>
