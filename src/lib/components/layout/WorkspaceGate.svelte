<script lang="ts">
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
        try { await openWorkspaceDirectory(handle); }
        finally { busy = false; }
        return;
      }
    }
  }
</script>

<div
  class="card"
  class:dragging
  role="region"
  aria-label="Ouvrir un espace de travail"
  ondragover={(event) => { event.preventDefault(); dragging = true; }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <h2>Ouvrir un espace de travail</h2>
  <p>
    Glissez le dossier de l’espace de travail, ou sélectionnez-le. Les fichiers sont lus ici : rien n’est envoyé à un serveur.
  </p>
  <button type="button" onclick={choose} disabled={busy}>
    {$needsPermission && $folderLabel ? `Rouvrir ${$folderLabel}` : 'Choisir un dossier'}
  </button>
</div>
{#if $workspaceError}
  <p class="error" role="alert">{$workspaceError}</p>
{/if}

<style>
  .card {
    border: 1px dashed #cbd5e1;
    border-radius: 16px;
    background: #fff;
    padding: 40px 24px;
    text-align: center;
  }
  .card.dragging { border-color: #2563eb; background: #eff6ff; }
  h2 { margin: 0; font-size: 20px; font-weight: 600; }
  p { margin: 8px auto 0; max-width: 36rem; color: #64748b; font-size: 14px; line-height: 1.5; }
  button {
    margin-top: 24px;
    border: none;
    border-radius: 8px;
    background: #2563eb;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    padding: 9px 18px;
    cursor: pointer;
  }
  button:hover { background: #1d4ed8; }
  button:disabled { opacity: 0.5; cursor: default; }
  .error {
    margin: 16px 0 0;
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #991b1b;
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 14px;
  }
</style>
