<script lang="ts">
  import { Dropdown, DropdownItem } from 'flowbite-svelte';
  import { DotsHorizontalOutline, TrashBinOutline } from 'flowbite-svelte-icons';

  let { ondelete }: { ondelete: () => void } = $props();

  const uid = $props.id();
  const id = `row-actions-${uid}`;
  let open = $state(false);
</script>

<div role="presentation" class="flex justify-end" onclick={(event) => event.stopPropagation()}>
  <button
    type="button"
    {id}
    class="cursor-pointer rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white"
    aria-label="Actions"
    title="Actions"
  >
    <DotsHorizontalOutline size="md" />
  </button>
  <Dropdown simple triggeredBy={`[id="${id}"]`} placement="bottom-end" class="w-40" bind:isOpen={open}>
    <DropdownItem onclick={() => { open = false; ondelete(); }}>
      <span class="flex items-center gap-2 text-red-600 dark:text-red-500"><TrashBinOutline size="sm" />Supprimer</span>
    </DropdownItem>
  </Dropdown>
</div>
