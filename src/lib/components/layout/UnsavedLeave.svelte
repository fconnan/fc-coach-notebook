<script lang="ts">
  import { Button, Modal } from 'flowbite-svelte';
  import { chooseUnsaved, unsavedAsk, unsavedSaving } from '$lib/workspace/editorLeave';

  let open = $state(false);

  $effect(() => {
    open = $unsavedAsk;
  });

  function dismiss() {
    if ($unsavedAsk) chooseUnsaved('stay');
  }
</script>

<Modal bind:open title="Modifications non enregistrées" size="sm" dismissable={false} outsideclose={false} oncancel={dismiss}>
  <p class="text-sm text-body">Enregistrer avant de quitter ?</p>
  {#snippet footer()}
    <Button color="brand" disabled={$unsavedSaving} onclick={() => chooseUnsaved('save')}>Sauver</Button>
    <Button color="alternative" disabled={$unsavedSaving} onclick={() => chooseUnsaved('discard')}>Ne pas sauver</Button>
    <Button color="alternative" disabled={$unsavedSaving} onclick={() => chooseUnsaved('stay')}>Rester</Button>
  {/snippet}
</Modal>
