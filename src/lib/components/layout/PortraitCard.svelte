<script lang="ts">
  import { Alert, Button, Card, Input, Label, Modal } from 'flowbite-svelte';
  import { PenOutline } from 'flowbite-svelte-icons';
  import QuietIconButton from './QuietIconButton.svelte';

  let {
    photo = '',
    name = '',
    onphoto,
    onname,
    onerror,
    class: className = ''
  } = $props<{
    photo?: string;
    name?: string;
    onphoto?: (file: File) => void | Promise<void>;
    onname?: (name: string) => void | Promise<string | null | void>;
    onerror?: (message: string) => void;
    class?: string;
  }>();

  let nameOpen = $state(false);
  let nameDraft = $state('');
  let nameError = $state('');
  let savingName = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  function editName() {
    nameDraft = name;
    nameError = '';
    nameOpen = true;
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (!next) {
      nameError = 'Indique un nom.';
      return;
    }
    if (next === name.trim()) {
      nameOpen = false;
      return;
    }
    savingName = true;
    try {
      const error = await onname?.(next);
      if (error) {
        nameError = error;
        return;
      }
      nameOpen = false;
    } catch {
      nameError = 'Enregistrement impossible.';
    } finally {
      savingName = false;
    }
  }

  function pickPhoto() {
    fileInput?.click();
  }

  function choose(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    input.value = '';
    if (file) void onphoto?.(file);
  }

  async function pastePhoto() {
    if (!navigator.clipboard?.read) {
      onerror?.('Impossible de lire le presse-papiers.');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(entry => entry.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        await onphoto?.(new File([blob], 'photo', { type }));
        return;
      }
      onerror?.('Aucune image à coller.');
    } catch {
      onerror?.('Impossible de lire le presse-papiers.');
    }
  }

  $effect(() => {
    if (!nameOpen) return;
    const timer = setTimeout(() => {
      document.querySelector<HTMLInputElement>('#portrait-name input')?.focus();
      document.querySelector<HTMLInputElement>('#portrait-name input')?.select();
    }, 0);
    return () => clearTimeout(timer);
  });
</script>

<Card size="xl" class="overflow-hidden p-0 {className}">
  <div class="panel flex items-stretch">
    <div class="flex min-w-0 flex-1 items-center gap-2 px-6">
      <p class="truncate text-2xl font-semibold text-heading">{name}</p>
      <span class="name-edit">
        <QuietIconButton label="Modifier le nom" onclick={editName}><PenOutline size="sm" /></QuietIconButton>
      </span>
    </div>
    <div class="shot relative h-44 w-44 shrink-0">
      {#if photo}
        <img src={photo} alt="" class="h-44 w-44 object-cover" />
      {:else}
        <span class="flex h-44 w-44 items-center justify-center bg-gray-100 text-sm dark:bg-gray-700">Photo</span>
      {/if}
      <div class="shot-actions">
        <button type="button" class="shot-btn" onclick={pickPhoto}>Importer</button>
        <button type="button" class="shot-btn" onclick={() => { void pastePhoto(); }}>Coller</button>
      </div>
      <input bind:this={fileInput} class="hidden" type="file" accept="image/*" onchange={choose} />
    </div>
  </div>
</Card>

<Modal title="Modifier le nom" bind:open={nameOpen} size="md">
  <form id="portrait-name" onsubmit={(event) => { event.preventDefault(); void saveName(); }}>
    <Label>Nom
      <Input class="mt-1" bind:value={nameDraft} />
    </Label>
    {#if nameError}<Alert color="red" class="mt-3">{nameError}</Alert>{/if}
  </form>
  {#snippet footer()}
    <Button color="alternative" onclick={() => { nameOpen = false; }}>Annuler</Button>
    <Button color="brand" type="submit" form="portrait-name" disabled={savingName}>OK</Button>
  {/snippet}
</Modal>

<style>
  .name-edit {
    opacity: 0;
    pointer-events: none;
  }

  .panel:hover .name-edit,
  .panel:focus-within .name-edit {
    opacity: 1;
    pointer-events: auto;
  }

  .shot-actions {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: rgb(0 0 0 / 0.45);
    opacity: 0;
    pointer-events: none;
  }

  .shot:hover .shot-actions,
  .shot:focus-within .shot-actions {
    opacity: 1;
    pointer-events: auto;
  }

  .shot-btn {
    border: 0;
    border-radius: 0.375rem;
    background: white;
    color: #111827;
    font: inherit;
    font-size: 0.875rem;
    line-height: 1.25rem;
    padding: 0.25rem 0.75rem;
    cursor: pointer;
  }

  .shot-btn:hover {
    background: #f3f4f6;
  }
</style>
