<script lang="ts">
  import { createExercise } from '$lib/workspace/state';
  import { Alert, Button, Input, Label, Modal } from 'flowbite-svelte';

  let adding = $state(false);
  let entryName = $state('');
  let plainName = $state('');
  let addError = $state('');

  function openAdd() {
    adding = true;
    entryName = '';
    plainName = '';
    addError = '';
  }

  async function confirmAdd() {
    addError = (await createExercise(entryName, plainName)) || '';
    if (!addError) adding = false;
  }
</script>

<Button size="sm" color="brand" class="shrink-0" onclick={openAdd}>Ajouter un exercice</Button>

<Modal title="Nouvel exercice" bind:open={adding} size="md">
  <form id="exercise-form" class="space-y-3" onsubmit={(e) => { e.preventDefault(); void confirmAdd(); }}>
    <Label>Répertoire <Input class="mt-1" bind:value={entryName} /></Label>
    <Label>Nom <Input class="mt-1" bind:value={plainName} /></Label>
    {#if addError}<Alert color="red">{addError}</Alert>{/if}
  </form>
  {#snippet footer()}
    <Button color="alternative" onclick={() => adding = false}>Annuler</Button>
    <Button color="brand" type="submit" form="exercise-form">OK</Button>
  {/snippet}
</Modal>
