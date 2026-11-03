<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button, Table, TableSearch } from 'flowbite-svelte';

  let { query = $bindable(''), placeholder = '', search = true, addLabel = 'Ajouter', onadd, actions, children }: {
    query?: string;
    placeholder?: string;
    search?: boolean;
    addLabel?: string;
    onadd?: () => void;
    actions?: Snippet;
    children: Snippet;
  } = $props();
</script>

{#snippet addButton()}
  <Button size="sm" color="brand" onclick={onadd}>{addLabel}</Button>
{/snippet}

{#if search}
  <TableSearch
    {placeholder}
    hoverable
    bind:inputValue={query}
    header={actions ?? (onadd ? addButton : undefined)}
    class="overflow-visible rounded-none shadow-none"
    classes={{ inner: 'mb-3 flex items-center justify-between gap-3 p-0', search: 'mt-0' }}
  >
    {@render children()}
  </TableSearch>
{:else}
  {#if actions || onadd}
    <div class="mb-3 flex items-center justify-end gap-3">
      {#if actions}
        {@render actions()}
      {:else}
        {@render addButton()}
      {/if}
    </div>
  {/if}
  <Table hoverable class="overflow-visible rounded-none shadow-none">
    {@render children()}
  </Table>
{/if}
