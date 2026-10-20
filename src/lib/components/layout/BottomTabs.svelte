<script lang="ts">
  import {
    currentPage, isPlaying, animPhase, animPreview,
    captureFrame, gotoFrame, deleteFrame, duplicateFrame
  } from '$lib/stores/workspace';
  import {
    clearTransport, pauseTransport, restartTransport,
    seek, setSpeed, stepTransport, toggleTransport, transportClock
  } from '$lib/animation/playback';
  import { totalSeconds } from '$lib/animation/timeline';

  let speed = $state(1);
  let scrub = $state(0);

  const frames = $derived($currentPage?.frames ?? []);
  const activeIdx = $derived($currentPage?.activeFrameIndex ?? 0);
  const hasFrames = $derived(frames.length > 0);
  const duration = $derived(totalSeconds(frames));

  $effect(() => {
    setSpeed(speed);
  });

  $effect(() => {
    scrub = $transportClock;
  });

  function jump(index: number) {
    clearTransport();
    gotoFrame(index);
  }

  function capture() {
    clearTransport();
    captureFrame();
  }

  function onScrub(e: Event) {
    pauseTransport();
    const value = parseFloat((e.currentTarget as HTMLInputElement).value);
    scrub = value;
    seek(value);
  }
</script>

<div class="bottom-tabs">
  <div class="anim-controls">
    <button class="ctrl ghost" title="Retour au début" onclick={restartTransport} disabled={frames.length < 2}>⏮</button>
    <button class="ctrl ghost" title="Pas précédent" onclick={() => stepTransport(-1)} disabled={frames.length < 2}>◀</button>
    <button class="ctrl" title={$isPlaying ? 'Pause' : 'Lire'} onclick={toggleTransport} disabled={frames.length < 2}>
      {$isPlaying ? '⏸' : '▶'}
    </button>
    <button class="ctrl ghost" title="Pas suivant" onclick={() => stepTransport(1)} disabled={frames.length < 2}>⏭</button>
    <input class="scrub" type="range" min="0" max={duration || 0} step="0.05" value={scrub} oninput={onScrub} disabled={frames.length < 2} />
    <select class="speed" bind:value={speed} title="Vitesse">
      <option value={0.5}>0.5×</option>
      <option value={1}>1×</option>
      <option value={1.5}>1.5×</option>
      <option value={2}>2×</option>
    </select>
    {#if $animPreview && $animPhase}
      <span class="phase">{$animPhase}</span>
    {/if}
  </div>

  <div class="divider"></div>

  <div class="frames">
    {#if !hasFrames}
      <span class="empty-hint">Aucune frame — cliquez sur ＋ pour créer une animation</span>
    {:else}
      {#each frames as frame, i (frame.id)}
        <div class="frame" class:active={i === activeIdx && !$animPreview}>
          <button class="frame-btn" onclick={() => jump(i)} title={frame.name}>{i + 1}</button>
          <div class="frame-actions">
            <button title="Dupliquer" onclick={() => duplicateFrame(i)}>⧉</button>
            <button title="Supprimer" onclick={() => deleteFrame(i)}>✕</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <button class="add-btn" title="Capturer une nouvelle frame" onclick={capture}>＋</button>
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

  .anim-controls { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .ctrl {
    width: 26px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent-primary); color: #fff; border-radius: 4px; font-size: 11px;
  }
  .ctrl.ghost { background: var(--bg-app); color: var(--text-main); border: 1px solid var(--border-color); }
  .ctrl:disabled { opacity: 0.35; }
  .speed {
    background: var(--bg-canvas); color: var(--text-main);
    border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; padding: 2px 4px;
  }
  .scrub { width: 90px; accent-color: var(--accent-primary); }
  .phase { font-size: 11px; color: var(--text-main); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
