<script lang="ts">
  import {
    currentPage, isPlaying, playbackElements,
    captureFrame, gotoFrame, deleteFrame, duplicateFrame, commitToActiveFrame,
    type Frame, type ComponentElement, type Position
  } from '$lib/stores/workspace';
  import { onDestroy } from 'svelte';

  let speed = $state(1);
  let raf = 0;

  const frames = $derived($currentPage?.frames ?? []);
  const activeIdx = $derived($currentPage?.activeFrameIndex ?? 0);
  const hasFrames = $derived(frames.length > 0);

  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  function lerpPos(a: Position, b: Position, t: number): Position {
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  }
  function lerpAngle(a = 0, b = 0, t: number): number {
    let d = ((b - a + 540) % 360) - 180; // shortest path
    return a + d * t;
  }

  function interpolate(a: Frame, b: Frame, t: number): ComponentElement[] {
    const prev = new Map(a.elements.map(e => [e.id, e]));
    return b.elements.map(eb => {
      const ea = prev.get(eb.id);
      if (!ea) return eb;
      const out: ComponentElement = {
        ...eb,
        position: lerpPos(ea.position, eb.position, t),
        angle: lerpAngle(ea.angle, eb.angle, t)
      };
      if (ea.pathPoints && eb.pathPoints && ea.pathPoints.length === eb.pathPoints.length) {
        out.pathPoints = eb.pathPoints.map((pt, i) => lerpPos(ea.pathPoints![i], pt, t));
      }
      return out;
    });
  }

  function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function play() {
    commitToActiveFrame();
    const fr = $currentPage.frames;
    if (fr.length < 2) return;
    isPlaying.set(true);
    let seg = 0;
    let segStart = performance.now();
    playbackElements.set(fr[0].elements);

    function step(now: number) {
      const dur = Math.max(150, (fr[seg].durationMs || 1000)) / speed;
      let t = (now - segStart) / dur;
      if (t >= 1) {
        seg++;
        segStart = now;
        if (seg >= fr.length - 1) {
          playbackElements.set(fr[fr.length - 1].elements);
          stop();
          return;
        }
        t = 0;
      }
      playbackElements.set(interpolate(fr[seg], fr[seg + 1], easeInOut(t)));
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    isPlaying.set(false);
  }

  function togglePlay() {
    if ($isPlaying) stop();
    else play();
  }

  onDestroy(stop);
</script>

<div class="bottom-tabs">
  <div class="anim-controls">
    <button class="ctrl" title={$isPlaying ? 'Arrêter' : 'Lire l’animation'} onclick={togglePlay} disabled={frames.length < 2}>
      {$isPlaying ? '⏹' : '▶'}
    </button>
    <select class="speed" bind:value={speed} title="Vitesse">
      <option value={0.5}>0.5×</option>
      <option value={1}>1×</option>
      <option value={1.5}>1.5×</option>
      <option value={2}>2×</option>
    </select>
  </div>

  <div class="divider"></div>

  <div class="frames">
    {#if !hasFrames}
      <span class="empty-hint">Aucune frame — cliquez sur ＋ pour créer une animation</span>
    {:else}
      {#each frames as frame, i (frame.id)}
        <div class="frame" class:active={i === activeIdx && !$isPlaying}>
          <button class="frame-btn" onclick={() => gotoFrame(i)} title={frame.name}>{i + 1}</button>
          <div class="frame-actions">
            <button title="Dupliquer" onclick={() => duplicateFrame(i)}>⧉</button>
            <button title="Supprimer" onclick={() => deleteFrame(i)}>✕</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <button class="add-btn" title="Capturer une nouvelle frame" onclick={captureFrame}>＋</button>
</div>

<style>
  .bottom-tabs {
    display: flex;
    align-items: center;
    background-color: var(--bg-panel);
    border-top: 1px solid var(--border-color);
    height: 100%;
    padding: 0 8px;
    gap: 8px;
  }

  .anim-controls { display: flex; align-items: center; gap: 4px; }
  .ctrl {
    width: 26px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent-primary); color: #fff; border-radius: 4px; font-size: 11px;
  }
  .ctrl:disabled { opacity: 0.35; background: var(--bg-app); }
  .speed {
    background: var(--bg-canvas); color: var(--text-main);
    border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; padding: 2px 4px;
  }

  .divider { width: 1px; height: 18px; background: var(--border-color); }

  .frames { display: flex; align-items: center; gap: 6px; overflow-x: auto; flex: 1; }
  .empty-hint { font-size: 11px; color: var(--text-muted); font-style: italic; }

  .frame {
    display: flex; align-items: center;
    border: 1px solid var(--border-color); border-radius: 4px;
    overflow: hidden; background: rgba(0,0,0,0.1);
  }
  .frame.active { border-color: var(--accent-primary); background: rgba(94,106,210,0.15); }
  .frame-btn {
    padding: 0 10px; height: 24px; font-size: 12px;
    color: var(--text-main); background: transparent;
  }
  .frame.active .frame-btn { color: var(--accent-primary); font-weight: 700; }
  .frame-actions { display: flex; }
  .frame-actions button {
    width: 18px; height: 24px; font-size: 9px; color: var(--text-muted);
    border-left: 1px solid var(--border-color); background: transparent;
  }
  .frame-actions button:hover { color: var(--text-main); background: var(--hover-bg); }

  .add-btn { padding: 0 12px; height: 24px; font-size: 14px; color: var(--text-muted); }
  .add-btn:hover { color: var(--text-main); background-color: var(--hover-bg); border-radius: 4px; }
</style>
