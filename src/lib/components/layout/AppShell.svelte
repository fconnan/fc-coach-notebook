<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import { folderLabel, needsPermission, pickWorkspace, refreshWorkspace, resumeWorkspace, workspaceOpen } from '$lib/workspace/state';

  let { children } = $props();

  const FULLSCREEN = 'fctactics.fullscreen';
  let fullscreen = $state(false);
  let nativeFullscreen = false;
  let choosing = $state(false);

  function savedFullscreen(): boolean {
    try { return localStorage.getItem(FULLSCREEN) === '1'; } catch { return false; }
  }

  function remember(next: boolean) {
    fullscreen = next;
    try { localStorage.setItem(FULLSCREEN, next ? '1' : '0'); } catch { /* ignore */ }
  }

  async function enterNative() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  }

  async function exitNative() {
    if (document.fullscreenElement) await document.exitFullscreen();
  }

  function onFullscreenChange() {
    const active = document.fullscreenElement != null;
    if (active) {
      nativeFullscreen = true;
      if (!fullscreen) remember(true);
      return;
    }
    if (nativeFullscreen) {
      nativeFullscreen = false;
      remember(false);
    }
  }

  async function toggleFullscreen() {
    const next = !fullscreen;
    remember(next);
    try {
      if (next) await enterNative();
      else await exitNative();
    } catch {
      // Le navigateur n’ouvre le plein écran qu’après un clic. La mise en page large reste mémorisée.
    }
  }

  async function changeFolder() {
    choosing = true;
    try {
      if ($needsPermission && !$workspaceOpen) await resumeWorkspace();
      else await pickWorkspace(false);
    } finally {
      choosing = false;
    }
  }

  $effect(() => {
    if (!$workspaceOpen) return;
    fullscreen = savedFullscreen();
    if (!fullscreen) return;
    void enterNative().catch(() => {});
  });
</script>

<svelte:document onfullscreenchange={onFullscreenChange} />

<div class="shell">
  <header>
    <div class="bar" class:wide={fullscreen}>
      <img src={favicon} alt="" class="mark" />
      <div class="titles">
        <p class="title">FC Tactics</p>
        <p class="subtitle">Fiches de séance et schémas d’exercices</p>
      </div>
      {#if $workspaceOpen}
        <div class="actions">
          <div class="ws">
            <button type="button" class="ws-id" title="Changer de dossier" disabled={choosing} onclick={changeFolder}>
              <span class="kicker">Espace de travail</span>
              <span class="name">{$folderLabel || 'Sans nom'}</span>
            </button>
            <div class="ws-tools">
              <button type="button" class="icon" aria-label="Actualiser" title="Actualiser" onclick={() => refreshWorkspace()}>
                <svg viewBox="0 0 16 16" class="glyph" aria-hidden="true">
                  <path d="M13.2 8a5.2 5.2 0 1 1-1.55-3.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  <path d="M13.4 2.2V5.4H10.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          <button
            type="button"
            class="icon solo"
            aria-pressed={fullscreen}
            aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            onclick={toggleFullscreen}
          >
            {#if fullscreen}
              <svg viewBox="0 0 16 16" class="glyph" aria-hidden="true">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            {:else}
              <svg viewBox="0 0 16 16" class="glyph" aria-hidden="true">
                <path d="M6 2.5H3.2v2.8M10 2.5h2.8v2.8M6 13.5H3.2v-2.8M10 13.5h2.8v-2.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </header>
  <main class:wide={fullscreen}>
    {#if children}{@render children()}{/if}
  </main>
</div>

<style>
  .shell {
    min-height: 100vh;
    background: #f8fafc;
    color: #0f172a;
    font-family: 'Segoe UI', ui-sans-serif, system-ui, sans-serif;
  }
  header { border-bottom: 1px solid #e2e8f0; background: #fff; }
  .bar, main {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(72rem, 100%);
    margin: 0 auto;
    padding: 20px 16px;
  }
  .bar.wide, main.wide { width: 100%; padding-left: 12px; padding-right: 12px; }
  main { display: block; padding-top: 24px; padding-bottom: 40px; }
  .mark { width: 40px; height: 40px; flex: 0 0 auto; }
  .titles { min-width: 0; flex: 1; }
  .title { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .subtitle { margin: 0; font-size: 14px; color: #64748b; }
  .actions { display: flex; flex: 0 0 auto; align-items: center; gap: 10px; }
  .ws {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 4px 3px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #f8fafc;
  }
  .ws-id {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    border: none;
    background: transparent;
    border-radius: 8px;
    padding: 2px 8px;
    cursor: pointer;
    min-width: 0;
  }
  .kicker { font-size: 11px; line-height: 1.2; color: #64748b; font-weight: 500; }
  .name {
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    line-height: 1.2;
    font-weight: 600;
    color: #0f172a;
  }
  .ws-id:hover { background: #e2e8f0; }
  .ws-id:disabled { opacity: 0.45; cursor: default; }
  .ws-tools {
    display: flex;
    gap: 2px;
    padding-left: 4px;
    border-left: 1px solid #e2e8f0;
  }
  .icon {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: none;
    background: transparent;
    border-radius: 8px;
    color: #374151;
    cursor: pointer;
  }
  .icon:hover { background: #e2e8f0; }
  .icon:disabled { opacity: 0.45; cursor: default; }
  .icon.solo { border: 1px solid #e2e8f0; background: #fff; }
  .icon.solo:hover { background: #f8fafc; border-color: #94a3b8; }
  .glyph { width: 16px; height: 16px; display: block; }
</style>
