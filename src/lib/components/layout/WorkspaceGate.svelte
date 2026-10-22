<script lang="ts">
  import { Button, Card, Heading, P } from 'flowbite-svelte';
  import { folderLabel, needsPermission, openWorkspaceDirectory, pickWorkspace, resumeWorkspace, workspaceError } from '$lib/workspace/state';

  let busy = $state(false);
  let dragging = $state(false);

  async function choose() {
    busy = true;
    try {
      if ($needsPermission) await resumeWorkspace();
      else await pickWorkspace(false);
    } finally {
      busy = false;
    }
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    const items = event.dataTransfer?.items;
    if (!items) return;
    for (const item of items) {
      const asHandle = (item as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }).getAsFileSystemHandle;
      if (!asHandle) continue;
      const handle = await asHandle.call(item);
      if (handle?.kind === 'directory') {
        busy = true;
        try { await openWorkspaceDirectory(handle as FileSystemDirectoryHandle); }
        finally { busy = false; }
        return;
      }
    }
  }
</script>

<Card
  size="md"
  class="mx-auto border-dashed p-6 text-center {dragging ? 'border-primary-700 bg-primary-50' : ''}"
  role="region"
  aria-label="Ouvrir un espace de travail"
  ondragover={(event: DragEvent) => { event.preventDefault(); dragging = true; }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <Heading tag="h2" class="text-xl">Ouvrir un espace de travail</Heading>
  <P class="mx-auto max-w-xl">
    Glissez le dossier de l’espace de travail, ou sélectionnez-le. Les fichiers sont lus ici : rien n’est envoyé à un serveur.
  </P>
  <Button class="mt-6" onclick={choose} disabled={busy}>
    {$needsPermission && $folderLabel ? `Rouvrir ${$folderLabel}` : 'Choisir un dossier'}
  </Button>
</Card>
{#if $workspaceError}
  <P class="mt-4 text-center text-red-600" role="alert">{$workspaceError}</P>
{/if}
