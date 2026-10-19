<script lang="ts">
  import { onMount } from 'svelte';
  import { showConnections } from '$lib/stores/workspace';
  import {
    cloudSession, refreshSession, connect, disconnect,
    listRepos, listProjects, type CloudProvider
  } from '$lib/storage/cloudClient';
  import { destinations } from '$lib/storage/destinations';

  let tab = $state<CloudProvider>('google');
  let busy = $state(false);
  let err = $state('');
  let repos = $state<string[]>([]);
  let projects = $state<Array<{ id: number; name: string }>>([]);
  let listLoading = $state(false);

  onMount(() => { refreshSession(); });

  const labels: Record<CloudProvider, string> = { google: 'Google Drive', github: 'GitHub', gitlab: 'GitLab' };

  async function doConnect(p: CloudProvider) {
    err = ''; busy = true;
    try {
      await connect(p);
      if (p === 'github') loadRepos();
      if (p === 'gitlab') loadProjects();
    } catch (e: any) {
      err = e?.message ?? 'Connexion échouée.';
    } finally {
      busy = false;
    }
  }
  async function doDisconnect(p: CloudProvider) {
    busy = true;
    try { await disconnect(p); } finally { busy = false; }
  }

  async function loadRepos() {
    listLoading = true; err = '';
    try { repos = await listRepos(); } catch (e: any) { err = e?.message ?? ''; } finally { listLoading = false; }
  }
  async function loadProjects() {
    listLoading = true; err = '';
    try { projects = await listProjects(); } catch (e: any) { err = e?.message ?? ''; } finally { listLoading = false; }
  }

  $effect(() => {
    if (tab === 'github' && $cloudSession.connected.github && repos.length === 0) loadRepos();
    if (tab === 'gitlab' && $cloudSession.connected.gitlab && projects.length === 0) loadProjects();
  });

  function close() { showConnections.set(false); }
</script>

<div class="overlay" role="presentation" onclick={close}>
  <div class="dialog" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
    <div class="title">Connexions cloud</div>

    <div class="tabs">
      {#each ['google','github','gitlab'] as const as p}
        <button class:active={tab === p} onclick={() => { tab = p; err = ''; }}>
          {labels[p]}
          {#if $cloudSession.connected[p]}<span class="dot on"></span>{/if}
        </button>
      {/each}
    </div>

    <div class="body">
      {#if !$cloudSession.configured[tab]}
        <div class="warn">
          OAuth non configuré côté serveur pour {labels[tab]}.
          Ajoutez les variables d'environnement (voir <code>.env.example</code>) puis redémarrez.
        </div>
      {:else if !$cloudSession.connected[tab]}
        <p class="lead">Connectez-vous avec votre compte {labels[tab]}.</p>
        <button class="connect" disabled={busy} onclick={() => doConnect(tab)}>
          Se connecter avec {labels[tab]}
        </button>
      {:else}
        <div class="status"><span class="dot on"></span> Connecté</div>

        {#if tab === 'github'}
          <label for="ghrepo">Dépôt cible</label>
          <div class="row">
            <select id="ghrepo" bind:value={$destinations.github.repo}>
              <option value="" disabled>{listLoading ? 'Chargement…' : 'Sélectionnez un dépôt'}</option>
              {#each repos as r}<option value={r}>{r}</option>{/each}
            </select>
            <button class="mini" onclick={loadRepos} title="Rafraîchir">↻</button>
          </div>
          <div class="row">
            <div><label for="ghbr">Branche</label><input id="ghbr" bind:value={$destinations.github.branch} placeholder="(par défaut)" /></div>
            <div><label for="ghpath">Dossier</label><input id="ghpath" bind:value={$destinations.github.path} placeholder="tactiques" /></div>
          </div>
        {:else if tab === 'gitlab'}
          <label for="glproj">Projet cible</label>
          <div class="row">
            <select id="glproj" bind:value={$destinations.gitlab.projectId}>
              <option value="" disabled>{listLoading ? 'Chargement…' : 'Sélectionnez un projet'}</option>
              {#each projects as p}<option value={String(p.id)}>{p.name}</option>{/each}
            </select>
            <button class="mini" onclick={loadProjects} title="Rafraîchir">↻</button>
          </div>
          <div class="row">
            <div><label for="glbr">Branche</label><input id="glbr" bind:value={$destinations.gitlab.branch} placeholder="main" /></div>
            <div><label for="glpath">Dossier</label><input id="glpath" bind:value={$destinations.gitlab.path} placeholder="tactiques" /></div>
          </div>
        {:else}
          <p class="lead">Les tactiques seront enregistrées dans votre Google Drive (dossier de l'application).</p>
        {/if}

        <button class="disconnect" disabled={busy} onclick={() => doDisconnect(tab)}>Se déconnecter</button>
      {/if}

      {#if err}<p class="err">{err}</p>{/if}
    </div>

    <div class="footer">
      <button class="cancel" onclick={close}>Fermer</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 5000; }
  .dialog { width: 480px; max-width: 94vw; background: var(--bg-panel); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 10px; box-shadow: var(--shadow-md); padding: 22px; }
  .title { font-size: 16px; font-weight: 700; margin-bottom: 14px; }
  .tabs { display: flex; gap: 4px; margin-bottom: 16px; }
  .tabs button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border: 1px solid var(--border-color); background: var(--bg-canvas); color: var(--text-muted); border-radius: 6px; font-size: 13px; cursor: pointer; }
  .tabs button.active { border-color: var(--accent-primary); background: var(--active-bg); color: var(--accent-primary); font-weight: 600; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot.on { background: #2ecc71; }
  .body { min-height: 150px; display: flex; flex-direction: column; gap: 8px; }
  .lead { font-size: 13px; color: var(--text-muted); }
  .warn { font-size: 13px; color: var(--text-muted); background: var(--bg-canvas); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; line-height: 1.5; }
  .status { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #2ecc71; margin-bottom: 6px; }
  .connect { background: var(--accent-primary); color: #fff; border: none; padding: 11px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .connect:hover:not(:disabled) { background: var(--accent-hover); }
  .connect:disabled { opacity: 0.6; cursor: default; }
  .disconnect { margin-top: 12px; background: var(--bg-canvas); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px; border-radius: 6px; font-size: 13px; cursor: pointer; }
  .disconnect:hover:not(:disabled) { background: var(--hover-bg); }
  label { font-size: 12px; color: var(--text-muted); margin-top: 6px; display: block; }
  select, input { width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-canvas); color: var(--text-main); font-size: 13px; }
  .row { display: flex; gap: 10px; align-items: flex-end; }
  .row > div { flex: 1; }
  .mini { width: 38px; flex: none; border: 1px solid var(--border-color); background: var(--bg-canvas); color: var(--text-main); border-radius: 6px; cursor: pointer; height: 36px; }
  .mini:hover { background: var(--hover-bg); }
  .err { color: #d25e5e; font-size: 12px; }
  .footer { display: flex; justify-content: flex-end; margin-top: 18px; }
  .cancel { background: var(--bg-canvas); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; }
  .cancel:hover { background: var(--hover-bg); }
</style>
