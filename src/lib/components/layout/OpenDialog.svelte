<script lang="ts">
  import { onMount } from 'svelte';
  import { showConnections } from '$lib/stores/workspace';
  import { openFromDevice, openCloud } from '$lib/storage';
  import { cloudSession, refreshSession, cloudList, destinationReady, type CloudProvider, type CloudItem } from '$lib/storage/cloudClient';

  let { onclose } = $props<{ onclose: () => void }>();

  let tab = $state<'device' | CloudProvider>('device');
  let items = $state<CloudItem[]>([]);
  let loading = $state(false);
  let error = $state('');

  onMount(() => { refreshSession(); });

  async function pickTab(t: 'device' | CloudProvider) {
    tab = t; items = []; error = '';
    if (t === 'device') return;
    if (!$cloudSession.connected[t] || !destinationReady(t)) { error = 'connexion'; return; }
    loading = true;
    try { items = await cloudList(t); }
    catch (e: any) { error = e?.message ?? String(e); }
    finally { loading = false; }
  }

  async function openDeviceFile() {
    const ok = await openFromDevice();
    if (ok) onclose();
  }

  async function openItem(item: CloudItem) {
    if (tab === 'device') return;
    loading = true;
    const ok = await openCloud(tab as CloudProvider, item);
    loading = false;
    if (ok) onclose();
  }
</script>

<div class="overlay" role="presentation" onclick={onclose}>
  <div class="dialog" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
    <div class="title">Ouvrir une tactique</div>

    <div class="tabs">
      <button class:active={tab === 'device'} onclick={() => pickTab('device')}>Appareil</button>
      {#if $cloudSession.configured.google}
        <button class:active={tab === 'google'} onclick={() => pickTab('google')}>Drive</button>
      {/if}
      {#if $cloudSession.configured.github}
        <button class:active={tab === 'github'} onclick={() => pickTab('github')}>GitHub</button>
      {/if}
      {#if $cloudSession.configured.gitlab}
        <button class:active={tab === 'gitlab'} onclick={() => pickTab('gitlab')}>GitLab</button>
      {/if}
    </div>

    <div class="content">
      {#if tab === 'device'}
        <button class="device-btn" onclick={openDeviceFile}>📂 Choisir un fichier .json…</button>
      {:else if error === 'connexion'}
        <p class="empty">Connexion ou destination requise. <button class="link" onclick={() => { onclose(); showConnections.set(true); }}>Configurer</button></p>
      {:else if loading}
        <p class="empty">Chargement…</p>
      {:else if error}
        <p class="empty err">{error}</p>
      {:else if items.length === 0}
        <p class="empty">Aucune tactique trouvée.</p>
      {:else}
        <ul class="list">
          {#each items as item}
            <li><button onclick={() => openItem(item)}>📄 {item.name}</button></li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="footer">
      <button class="cancel" onclick={onclose}>Annuler</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 5000; }
  .dialog { width: 460px; max-width: 92vw; background: var(--bg-panel); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 10px; box-shadow: var(--shadow-md); padding: 22px; }
  .title { font-size: 16px; font-weight: 700; margin-bottom: 14px; }
  .tabs { display: flex; gap: 4px; margin-bottom: 14px; }
  .tabs button { flex: 1; padding: 7px; border: 1px solid var(--border-color); background: var(--bg-canvas); color: var(--text-muted); border-radius: 6px; font-size: 12px; cursor: pointer; }
  .tabs button.active { border-color: var(--accent-primary); background: var(--active-bg); color: var(--accent-primary); font-weight: 600; }
  .content { min-height: 140px; max-height: 320px; overflow-y: auto; }
  .device-btn { width: 100%; padding: 14px; border: 1px dashed var(--border-color); border-radius: 8px; background: var(--bg-canvas); color: var(--text-main); font-size: 14px; cursor: pointer; }
  .device-btn:hover { border-color: var(--accent-primary); background: var(--hover-bg); }
  .list { display: flex; flex-direction: column; gap: 4px; }
  .list button { width: 100%; text-align: left; padding: 9px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-canvas); color: var(--text-main); font-size: 13px; cursor: pointer; }
  .list button:hover { border-color: var(--accent-primary); background: var(--hover-bg); }
  .empty { color: var(--text-muted); font-size: 13px; text-align: center; padding: 30px 0; }
  .empty.err { color: #d25e5e; }
  .link { background: none; border: none; color: var(--accent-primary); cursor: pointer; font-size: 13px; }
  .link:hover { text-decoration: underline; }
  .footer { display: flex; justify-content: flex-end; margin-top: 16px; }
  .cancel { background: var(--bg-canvas); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; }
  .cancel:hover { background: var(--hover-bg); }
</style>
