<script lang="ts" module>
  export type DeleteRequest = {
    title: string;
    /** Début de la phrase, par exemple « La saison ». */
    subject: string;
    name: string;
    /** Accord du participe : « supprimé » ou « supprimée ». */
    deleted: string;
    items?: string[];
    note?: string;
    run: () => Promise<string | null>;
  };

  export function plural(count: number, one: string, many: string) {
    return `${count} ${count > 1 ? many : one}`;
  }
</script>

<script lang="ts">
  import { Alert, Button, Modal } from 'flowbite-svelte';

  let { request = $bindable(null) }: { request: DeleteRequest | null } = $props();

  let error = $state('');
  let busy = $state(false);

  async function confirm() {
    if (!request) return;
    busy = true;
    error = (await request.run()) || '';
    busy = false;
    if (!error) request = null;
  }
</script>

<Modal
  title={request?.title}
  bind:open={() => Boolean(request), (open) => { if (!open) { request = null; error = ''; } }}
  size="md"
>
  {#if request}
    <p>
      {request.subject} <strong>{request.name}</strong> sera {request.deleted} définitivement{request.items?.length ? ', avec\u00a0:' : '.'}
    </p>
    {#if request.items?.length}
      <ul class="mt-2 list-disc ps-6">
        {#each request.items as item, index (index)}
          <li>{item}</li>
        {/each}
      </ul>
    {/if}
    {#if request.note}
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">{request.note}</p>
    {/if}
    {#if error}<Alert color="red" class="mt-3">{error}</Alert>{/if}
  {/if}
  {#snippet footer()}
    <Button color="alternative" onclick={() => { request = null; error = ''; }}>Annuler</Button>
    <Button color="danger" disabled={busy} onclick={() => { void confirm(); }}>Supprimer</Button>
  {/snippet}
</Modal>
