<script lang="ts">
  import { Button, Label, Modal, Select } from 'flowbite-svelte';
  import type { ParamChoice, ParamSession } from '$lib/schema/parameters';
  import type { AppSettings, OfferGroup } from '$lib/schema/viewStyles';

  let {
    open = $bindable(false),
    choices,
    selected,
    offers,
    hidden,
    onapply,
    onsave
  }: {
    open?: boolean;
    choices: ParamChoice[];
    selected: ParamSession;
    offers: OfferGroup[];
    hidden: string[];
    onapply: (next: AppSettings) => void;
    onsave: (next: AppSettings) => Promise<boolean>;
  } = $props();

  let offerFolder = $state<string | null>(null);
  let paramBase = $state<string | null>(null);
  let draft = $state<AppSettings>({ params: {}, hidden: [] });
  let draftHidden = $state<string[]>([]);
  let draftParams = $state<ParamSession>({});
  let saving = $state(false);
  let fault = $state('');
  let openedOnce = false;

  function copySettings(params: ParamSession, ids: readonly string[]): AppSettings {
    const next: ParamSession = {};
    for (const [element, bag] of Object.entries(params)) next[element] = { ...bag };
    return { params: next, hidden: [...ids] };
  }

  const bases = $derived([...new Set(choices.map(choice => choice.element.split('.')[0]))].sort((a, b) => a.localeCompare(b, 'fr')));
  const offered = $derived(offers.filter(group => group.entries.length));
  const opened = $derived(offered.find(group => group.folder === offerFolder) || null);
  const asked = $derived(paramBase ? choices.filter(choice => choice.element.split('.')[0] === paramBase) : []);
  const askedElements = $derived(new Set(asked.map(choice => choice.element)));

  function openOffer(folder: string) {
    draftHidden = [...draft.hidden];
    paramBase = null;
    offerFolder = folder;
  }

  function openParams(base: string) {
    const next: ParamSession = {};
    for (const choice of choices) {
      if (choice.element.split('.')[0] !== base) continue;
      const value = draft.params[choice.element]?.[choice.key];
      if (!value) continue;
      next[choice.element] = { ...next[choice.element], [choice.key]: value };
    }
    draftParams = next;
    offerFolder = null;
    paramBase = base;
  }

  function draftHide(id: string, hide: boolean) {
    const next = draftHidden.filter(item => item !== id);
    if (hide) next.push(id);
    draftHidden = next;
  }

  function selectAll(hide: boolean) {
    const group = opened;
    if (!group) return;
    const ids = new Set(group.entries.map(entry => entry.id));
    const next = draftHidden.filter(id => !ids.has(id));
    if (hide) next.push(...group.entries.map(entry => entry.id));
    draftHidden = next;
  }

  function draftValue(element: string, key: string, event: Event) {
    const value = event.currentTarget instanceof HTMLSelectElement ? event.currentTarget.value : '';
    const bag = { ...draftParams[element] };
    if (value) bag[key] = value;
    else delete bag[key];
    const next = { ...draftParams };
    if (Object.keys(bag).length) next[element] = bag;
    else delete next[element];
    draftParams = next;
  }

  function acceptOffer() {
    const group = opened;
    if (!group) return;
    const ids = new Set(group.entries.map(entry => entry.id));
    const next = draft.hidden.filter(id => !ids.has(id));
    for (const entry of group.entries) {
      if (draftHidden.includes(entry.id)) next.push(entry.id);
    }
    draft = { params: draft.params, hidden: next };
    offerFolder = null;
  }

  function acceptParams() {
    const params: ParamSession = { ...draft.params };
    for (const choice of asked) {
      const bag = { ...params[choice.element] };
      const value = draftParams[choice.element]?.[choice.key] || '';
      if (value) bag[choice.key] = value;
      else delete bag[choice.key];
      if (Object.keys(bag).length) params[choice.element] = bag;
      else delete params[choice.element];
    }
    draft = { params, hidden: draft.hidden };
    paramBase = null;
  }

  function snapshot(): AppSettings {
    return copySettings(draft.params, draft.hidden);
  }

  function confirm() {
    onapply(snapshot());
    open = false;
  }

  async function save() {
    if (saving) return;
    saving = true;
    fault = '';
    const next = snapshot();
    const stored = await onsave(next);
    saving = false;
    if (!stored) {
      fault = 'Enregistrement impossible.';
      return;
    }
    onapply(next);
    open = false;
  }

  function labelOf(choice: ParamChoice) {
    return askedElements.size > 1 || choice.element !== paramBase ? `${choice.element} · ${choice.key}` : choice.key;
  }

  $effect(() => {
    if (open && !openedOnce) draft = copySettings(selected, hidden);
    openedOnce = open;
    if (open) return;
    offerFolder = null;
    paramBase = null;
    fault = '';
  });
</script>

<Modal title="Réglages" bind:open size="md">
  <div class="flex max-h-[70vh] flex-col gap-5 overflow-auto">
    <section class="flex flex-col gap-2">
      <h4 class="text-sm font-semibold">Paramètres par défaut</h4>
      {#if bases.length}
        <div class="bar">
          {#each bases as base (base)}
            <button type="button" class="tool" onclick={() => openParams(base)}>{base}</button>
          {/each}
        </div>
      {:else}
        <p class="text-sm">Aucun paramètre déclaré.</p>
      {/if}
    </section>
    <section class="flex flex-col gap-2">
      <h4 class="text-sm font-semibold">Éléments proposés</h4>
      {#if offered.length}
        <div class="bar">
          {#each offered as group (group.folder)}
            <button type="button" class="tool" onclick={() => openOffer(group.folder)}>{group.folder}</button>
          {/each}
        </div>
      {:else}
        <p class="text-sm">Aucun élément.</p>
      {/if}
    </section>
    {#if fault}<p class="text-sm text-red-700">{fault}</p>{/if}
  </div>
  {#snippet footer()}
    <Button color="alternative" disabled={saving} onclick={() => open = false}>Annuler</Button>
    <Button color="brand" disabled={saving} onclick={confirm}>OK</Button>
    <Button color="brand" disabled={saving} onclick={() => { void save(); }}>Sauver</Button>
  {/snippet}
</Modal>

<Modal
  title={opened?.folder || ''}
  bind:open={() => offerFolder !== null, (next) => { if (!next) offerFolder = null; }}
  size="md"
>
  {#if opened}
    <div class="bar mb-3">
      <button type="button" class="tool" onclick={() => selectAll(false)}>Tout sélectionner</button>
      <button type="button" class="tool" onclick={() => selectAll(true)}>Tout désélectionner</button>
    </div>
    <div class="icons">
      {#each opened.entries as entry (entry.id)}
        <label class="icon" class:off={draftHidden.includes(entry.id)}>
          <input class="tick" type="checkbox" checked={!draftHidden.includes(entry.id)} onchange={(event) => draftHide(entry.id, event.currentTarget instanceof HTMLInputElement ? !event.currentTarget.checked : false)} />
          <span class="glyph" aria-hidden="true">{#if entry.icon}{@html entry.icon}{/if}</span>
          <span class="caption">{entry.name}</span>
        </label>
      {/each}
    </div>
  {/if}
  {#snippet footer()}
    <Button color="alternative" onclick={() => offerFolder = null}>Annuler</Button>
    <Button color="brand" onclick={acceptOffer}>OK</Button>
  {/snippet}
</Modal>

<Modal
  title={paramBase || ''}
  bind:open={() => paramBase !== null, (next) => { if (!next) paramBase = null; }}
  size="sm"
>
  {#if paramBase}
    <div class="flex flex-col gap-3">
      {#each asked as choice (`${choice.element}/${choice.key}`)}
        <Label>{labelOf(choice)}
          <Select
            class="mt-1"
            placeholder=""
            value={draftParams[choice.element]?.[choice.key] || ''}
            items={[{ value: '', name: 'Défaut' }, ...choice.names.map(name => ({ value: name, name }))]}
            onchange={(event) => draftValue(choice.element, choice.key, event)}
          />
        </Label>
      {/each}
    </div>
  {/if}
  {#snippet footer()}
    <Button color="alternative" onclick={() => paramBase = null}>Annuler</Button>
    <Button color="brand" onclick={acceptParams}>OK</Button>
  {/snippet}
</Modal>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.12rem 0.28rem;
  }
  .tool {
    border: 1px solid var(--color-default-medium);
    border-radius: 0.3rem;
    background: var(--bg-subtle);
    padding: 0 0.45rem;
    min-height: 1.35rem;
    font-size: 0.75rem;
    line-height: 1.2;
    color: var(--color-heading);
  }
  .tool:hover { border-color: var(--color-default-strong); background: var(--hover-bg); }
  .icons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    max-height: 60vh;
    overflow: auto;
  }
  .icon {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    width: 6.4rem;
    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;
    padding: 0.2rem;
    color: var(--color-heading);
  }
  .icon:hover { border-color: var(--color-default-medium); }
  .icon.off { opacity: 0.45; }
  .tick {
    position: absolute;
    z-index: 1;
    top: 0.35rem;
    left: 0.35rem;
    width: 0.95rem;
    height: 0.95rem;
    accent-color: #fff;
  }
  .glyph {
    display: flex;
    width: 100%;
    height: 4rem;
    align-items: center;
    justify-content: center;
    background: #166534;
  }
  .glyph :global(svg) { display: block; width: 100%; height: 100%; }
  .caption { font-size: 0.7rem; line-height: 1.1; text-align: center; }
</style>
