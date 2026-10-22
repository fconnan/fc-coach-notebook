<script lang="ts">
  import { showExportDialog, clearSelection } from '$lib/stores/workspace';
  import { exportImage, exportOdsFile, exportSessionPDF, exportSVG, type ImageExportOptions } from '$lib/services/exportService';
  import { Alert, Button, ButtonGroup, Modal, Radio } from 'flowbite-svelte';

  let format = $state<'jpeg' | 'png' | 'svg' | 'pdf' | 'ods'>('jpeg');
  let resolution = $state<'high' | 'medium' | 'low'>('high');
  let crop = $state(false);
  let busy = $state(false);
  let error = $state('');
  let open = $state(true);

  const resLabels: Record<string, string> = {
    high: 'Haute (≈ 2000 px)',
    medium: 'Moyenne (≈ 1400 px)',
    low: 'Basse (≈ 760 px)'
  };
  const formats = ['jpeg', 'png', 'svg', 'pdf', 'ods'] as const;

  $effect(() => {
    if (!open) showExportDialog.set(false);
  });

  async function doExport() {
    busy = true;
    error = '';
    try {
      clearSelection();
      await new Promise(r => setTimeout(r, 30));
      if (format === 'pdf') {
        await exportSessionPDF();
      } else if (format === 'svg') {
        await exportSVG();
      } else if (format === 'ods') {
        const warning = await exportOdsFile();
        if (warning) alert(warning);
      } else {
        await exportImage({ format, resolution, crop } as ImageExportOptions);
      }
      open = false;
    } catch (e) {
      console.error(e);
      error = "Échec de l'export. Réessayez.";
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Exporter" bind:open size="md">
  <div class="space-y-4">
    <div>
      <p class="mb-2 text-sm font-medium">Format</p>
      <ButtonGroup>
        {#each formats as item (item)}
          <Button color={format === item ? 'brand' : 'alternative'} onclick={() => format = item}>{item.toUpperCase()}</Button>
        {/each}
      </ButtonGroup>
    </div>

    {#if format === 'jpeg' || format === 'png'}
      <div>
        <p class="mb-2 text-sm font-medium">Résolution</p>
        {#each ['high', 'medium', 'low'] as r (r)}
          <Radio name="res" value={r} bind:group={resolution}>{resLabels[r]}</Radio>
        {/each}
      </div>
      <div>
        <p class="mb-2 text-sm font-medium">Recadrage</p>
        <Radio name="crop" value={false} bind:group={crop}>Terrain complet</Radio>
        <Radio name="crop" value={true} bind:group={crop}>Recadrer sur le contenu</Radio>
      </div>
    {:else if format === 'svg'}
      <p class="text-sm text-gray-500">Le fichier SVG joue l'animation tout seul. La pause, le retour et le pas à pas restent dans l'application.</p>
    {:else if format === 'pdf'}
      <p class="text-sm text-gray-500">Une page par exercice, avec le texte et la liste des phases.</p>
    {:else}
      <p class="text-sm text-gray-500">Écrit la séance dans le classeur de la catégorie. Au-delà de 4 exercices, les suivants restent dans le dossier et dans le PDF.</p>
    {/if}

    {#if error}<Alert color="red">{error}</Alert>{/if}
  </div>
  {#snippet footer()}
    <Button color="alternative" onclick={() => open = false} disabled={busy}>Annuler</Button>
    <Button color="brand" onclick={doExport} disabled={busy} loading={busy}>
      Exporter {format.toUpperCase()}
    </Button>
  {/snippet}
</Modal>
