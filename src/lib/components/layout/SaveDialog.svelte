<script lang="ts">
  import { onMount } from 'svelte';
  import { showSaveDialog, showConnections, tacticName } from '$lib/stores/workspace';
  import { saveTo, supportsFS, type Provider } from '$lib/storage';
  import { cloudSession, refreshSession, destinationReady, type CloudProvider } from '$lib/storage/cloudClient';
  import { Button, Indicator, Input, Label, Modal } from 'flowbite-svelte';

  let name = $state($tacticName || 'Sans titre');
  let busy = $state(false);
  let open = $state(true);

  onMount(() => { refreshSession(); });

  $effect(() => {
    if (!open) showSaveDialog.set(false);
  });

  function isCloud(id: Provider): id is CloudProvider {
    return id === 'google' || id === 'github' || id === 'gitlab';
  }

  const allDestinations: { id: Provider; label: string; sub: string }[] = [
    { id: 'device', label: 'Appareil', sub: supportsFS() ? 'Enregistrer un fichier .json' : 'Téléchargement (navigateur limité)' },
    { id: 'download', label: 'Téléchargement', sub: 'Télécharger le fichier .json' },
    { id: 'google', label: 'Google Drive', sub: 'Enregistrer dans Drive' },
    { id: 'github', label: 'GitHub', sub: 'Valider dans un dépôt' },
    { id: 'gitlab', label: 'GitLab', sub: 'Valider dans un projet' }
  ];

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
      open = false;
      showConnections.set(true);
      return;
    }
    busy = true;
    const ok = await saveTo(id, name);
    busy = false;
    if (ok) open = false;
  }

  function openConnections() {
    open = false;
    showConnections.set(true);
  }
</script>

<Modal title="Enregistrer la tactique" bind:open size="md">
  <Label class="mb-4">Nom du fichier
    <Input id="tname" class="mt-1" bind:value={name} placeholder="Sans titre" />
  </Label>
  <div class="flex flex-col gap-2">
    {#each destinations as d (d.id)}
      <Button color="alternative" class="justify-start" onclick={() => choose(d.id)} disabled={busy}>
        <span class="flex flex-col items-start">
          <span class="flex items-center gap-2 font-semibold">
            {d.label}
            {#if isCloud(d.id) && $cloudSession.connected[d.id]}<Indicator color="green" size="xs" />{/if}
          </span>
          <span class="text-xs font-normal text-gray-500">{subFor(d)}</span>
        </span>
      </Button>
    {/each}
  </div>
  {#snippet footer()}
    {#if anyCloud}
      <Button color="alternative" onclick={openConnections}>Gérer les connexions…</Button>
    {/if}
    <Button color="alternative" onclick={() => open = false}>Annuler</Button>
  {/snippet}
</Modal>
