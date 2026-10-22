<script lang="ts">
  import { onMount } from 'svelte';
  import { showConnections } from '$lib/stores/workspace';
  import {
    cloudSession, refreshSession, connect, disconnect,
    listRepos, listProjects, type CloudProvider
  } from '$lib/storage/cloudClient';
  import { destinations } from '$lib/storage/destinations';
  import { Alert, Button, ButtonGroup, Indicator, Input, Label, Modal, Select } from 'flowbite-svelte';

  let tab = $state<CloudProvider>('google');
  let busy = $state(false);
  let err = $state('');
  let repos = $state<string[]>([]);
  let projects = $state<Array<{ id: number; name: string }>>([]);
  let listLoading = $state(false);
  let open = $state(true);

  onMount(() => { refreshSession(); });

  const labels: Record<CloudProvider, string> = { google: 'Google Drive', github: 'GitHub', gitlab: 'GitLab' };
  const providers = ['google', 'github', 'gitlab'] as const;

  $effect(() => {
    if (!open) showConnections.set(false);
  });

  async function doConnect(p: CloudProvider) {
    err = ''; busy = true;
    try {
      await connect(p);
      if (p === 'github') loadRepos();
      if (p === 'gitlab') loadProjects();
    } catch (e: unknown) {
      err = e instanceof Error ? e.message : 'Connexion échouée.';
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
    try { repos = await listRepos(); } catch (e: unknown) { err = e instanceof Error ? e.message : ''; } finally { listLoading = false; }
  }
  async function loadProjects() {
    listLoading = true; err = '';
    try { projects = await listProjects(); } catch (e: unknown) { err = e instanceof Error ? e.message : ''; } finally { listLoading = false; }
  }

  $effect(() => {
    if (tab === 'github' && $cloudSession.connected.github && repos.length === 0) loadRepos();
    if (tab === 'gitlab' && $cloudSession.connected.gitlab && projects.length === 0) loadProjects();
  });
</script>

<Modal title="Connexions cloud" bind:open size="md">
  <ButtonGroup class="mb-4 w-full">
    {#each providers as p (p)}
      <Button class="flex-1" color={tab === p ? 'brand' : 'alternative'} onclick={() => { tab = p; err = ''; }}>
        {labels[p]}
        {#if $cloudSession.connected[p]}<Indicator color="green" size="xs" class="ms-2" />{/if}
      </Button>
    {/each}
  </ButtonGroup>

  <div class="flex min-h-36 flex-col gap-3">
    {#if !$cloudSession.configured[tab]}
      <Alert color="yellow">
        OAuth non configuré côté serveur pour {labels[tab]}. Ajoutez les variables d'environnement (voir .env.example) puis redémarrez.
      </Alert>
    {:else if !$cloudSession.connected[tab]}
      <p class="text-sm text-gray-500">Connectez-vous avec votre compte {labels[tab]}.</p>
      <Button color="brand" disabled={busy} onclick={() => doConnect(tab)}>Se connecter avec {labels[tab]}</Button>
    {:else}
      <p class="flex items-center gap-2 text-sm font-semibold text-green-600">
        <Indicator color="green" size="xs" /> Connecté
      </p>

      {#if tab === 'github'}
        <Label>Dépôt cible
          <div class="mt-1 flex gap-2">
            <Select class="flex-1" bind:value={$destinations.github.repo} items={[
              { value: '', name: listLoading ? 'Chargement…' : 'Sélectionnez un dépôt', disabled: true },
              ...repos.map(repo => ({ value: repo, name: repo }))
            ]} />
            <Button color="alternative" onclick={loadRepos} title="Rafraîchir">↻</Button>
          </div>
        </Label>
        <div class="grid gap-3 sm:grid-cols-2">
          <Label>Branche <Input class="mt-1" bind:value={$destinations.github.branch} placeholder="(par défaut)" /></Label>
          <Label>Dossier <Input class="mt-1" bind:value={$destinations.github.path} placeholder="tactiques" /></Label>
        </div>
      {:else if tab === 'gitlab'}
        <Label>Projet cible
          <div class="mt-1 flex gap-2">
            <Select class="flex-1" bind:value={$destinations.gitlab.projectId} items={[
              { value: '', name: listLoading ? 'Chargement…' : 'Sélectionnez un projet', disabled: true },
              ...projects.map(project => ({ value: String(project.id), name: project.name }))
            ]} />
            <Button color="alternative" onclick={loadProjects} title="Rafraîchir">↻</Button>
          </div>
        </Label>
        <div class="grid gap-3 sm:grid-cols-2">
          <Label>Branche <Input class="mt-1" bind:value={$destinations.gitlab.branch} placeholder="main" /></Label>
          <Label>Dossier <Input class="mt-1" bind:value={$destinations.gitlab.path} placeholder="tactiques" /></Label>
        </div>
      {:else}
        <p class="text-sm text-gray-500">Les tactiques seront enregistrées dans votre Google Drive (dossier de l'application).</p>
      {/if}

      <Button color="alternative" disabled={busy} onclick={() => doDisconnect(tab)}>Se déconnecter</Button>
    {/if}

    {#if err}<Alert color="red">{err}</Alert>{/if}
  </div>
  {#snippet footer()}
    <Button color="alternative" onclick={() => open = false}>Fermer</Button>
  {/snippet}
</Modal>
