<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Button, TableSearch } from 'flowbite-svelte';

  let { query = $bindable(''), placeholder, addLabel = 'Ajouter', onadd, actions, children }: {
    query?: string;
    placeholder: string;
    addLabel?: string;
    onadd?: () => void;
    actions?: Snippet;
    children: Snippet;
  } = $props();
</script>

{#snippet addButton()}
  <Button size="sm" color="brand" onclick={onadd}>{addLabel}</Button>
{/snippet}

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
