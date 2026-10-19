<script lang="ts">
  import { onMount } from 'svelte';
  import { showSaveDialog, showConnections, tacticName } from '$lib/stores/workspace';
  import { saveTo, supportsFS, type Provider } from '$lib/storage';
  import { cloudSession, refreshSession, destinationReady, type CloudProvider } from '$lib/storage/cloudClient';

  let name = $state($tacticName || 'Sans titre');
  let busy = $state(false);

  onMount(() => { refreshSession(); });

  function isCloud(id: Provider): id is CloudProvider {
    return id === 'google' || id === 'github' || id === 'gitlab';
  }

  const allDestinations: { id: Provider; label: string; sub: string; icon: string }[] = [
    { id: 'device', label: 'Appareil', sub: supportsFS() ? 'Enregistrer un fichier .json' : 'Téléchargement (navigateur limité)', icon: '💾' },
    { id: 'download', label: 'Téléchargement', sub: 'Télécharger le fichier .json', icon: '⬇️' },
    { id: 'google', label: 'Google Drive', sub: 'Enregistrer dans Drive', icon: '🟢' },
    { id: 'github', label: 'GitHub', sub: 'Valider dans un dépôt', icon: '🐙' },
    { id: 'gitlab', label: 'GitLab', sub: 'Valider dans un projet', icon: '🦊' }
  ];

  // Cloud destinations only appear once configured on the server.
  const destinations = $derived(allDestinations.filter(d => !isCloud(d.id) || $cloudSession.configured[d.id]));
  const anyCloud = $derived($cloudSession.configured.google || $cloudSession.configured.github || $cloudSession.configured.gitlab);

  function subFor(d: { id: Provider; sub: string }): string {
    if (!isCloud(d.id)) return d.sub;
    if (!$cloudSession.configured[d.id]) return 'Non configuré côté serveur';
    if (!$cloudSession.connected[d.id]) return 'Connexion requise — cliquez pour vous connecter';
    if (!destinationReady(d.id)) return 'Destination à choisir — cliquez pour configurer';
    return d.sub;
  }

  async function choose(id: Provider) {
    if (isCloud(id) && (!$cloudSession.connected[id] || !destinationReady(id))) {
      showSaveDialog.set(false);
      showConnections.set(true);
      return;
    }
    busy = true;
    const ok = await saveTo(id, name);
    busy = false;
    if (ok) showSaveDialog.set(false);
  }

  function close() { showSaveDialog.set(false); }
  function openConnections() { showSaveDialog.set(false); showConnections.set(true); }
</script>

<div class="overlay" role="presentation" onclick={close}>
  <div class="dialog" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
    <div class="title">Enregistrer la tactique</div>

    <label class="name-label" for="tname">Nom du fichier</label>
    <input id="tname" class="name-input" bind:value={name} placeholder="Sans titre" />

    <div class="dest-grid">
      {#each destinations as d}
        <button class="dest" onclick={() => choose(d.id)} disabled={busy}>
          <span class="ico">{d.icon}</span>
          <span class="meta">
            <span class="lbl">{d.label}{#if isCloud(d.id) && $cloudSession.connected[d.id]}<span class="dot"></span>{/if}</span>
            <span class="sub">{subFor(d)}</span>
          </span>
        </button>
      {/each}
    </div>

    <div class="footer">
      {#if anyCloud}
        <button class="link" onclick={openConnections}>Gérer les connexions…</button>
      {:else}
        <span></span>
      {/if}
      <button class="cancel" onclick={close}>Annuler</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 5000; }
  .dialog { width: 440px; max-width: 92vw; background: var(--bg-panel); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 10px; box-shadow: var(--shadow-md); padding: 22px; }
  .title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
  .name-label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
  .name-input { width: 100%; padding: 9px 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-canvas); color: var(--text-main); font-size: 14px; margin-bottom: 18px; }
  .dest-grid { display: flex; flex-direction: column; gap: 8px; }
  .dest { display: flex; align-items: center; gap: 12px; text-align: left; padding: 11px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-canvas); cursor: pointer; transition: all 0.15s; }
  .dest:hover:not(:disabled) { border-color: var(--accent-primary); background: var(--hover-bg); }
  .dest:disabled { opacity: 0.6; cursor: default; }
  .ico { font-size: 22px; width: 28px; text-align: center; }
  .meta { display: flex; flex-direction: column; }
  .lbl { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #2ecc71; display: inline-block; }
  .sub { font-size: 11px; color: var(--text-muted); }
  .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .link { background: none; border: none; color: var(--accent-primary); font-size: 13px; cursor: pointer; }
  .link:hover { text-decoration: underline; }
  .cancel { background: var(--bg-canvas); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; }
  .cancel:hover { background: var(--hover-bg); }
</style>
