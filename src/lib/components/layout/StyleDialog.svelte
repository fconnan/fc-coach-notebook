<script lang="ts">
  import { Label, Modal, Select } from 'flowbite-svelte';
  import type { ParamChoice, ParamSession } from '$lib/schema/parameters';

  let {
    open = $bindable(false),
    title,
    choices,
    selected,
    onpick
  }: {
    open?: boolean;
    title: string;
    choices: ParamChoice[];
    selected: ParamSession;
    onpick: (element: string, key: string, value: string) => void;
  } = $props();

  function choose(element: string, key: string, event: Event) {
    const value = event.currentTarget instanceof HTMLSelectElement ? event.currentTarget.value : '';
    onpick(element, key, value);
  }
</script>

<Modal {title} bind:open size="sm">
  {#if choices.length}
    <div class="flex flex-col gap-3">
      {#each choices as choice (`${choice.element}/${choice.key}`)}
        <Label>{choice.element} · {choice.key}
          <Select
            class="mt-1"
            placeholder=""
            value={selected[choice.element]?.[choice.key] || ''}
            items={[{ value: '', name: 'Défaut' }, ...choice.names.map(name => ({ value: name, name }))]}
            onchange={(event) => choose(choice.element, choice.key, event)}
          />
        </Label>
      {/each}
    </div>
  {:else}
    <p>Aucun paramètre dans ce schéma.</p>
  {/if}
</Modal>
