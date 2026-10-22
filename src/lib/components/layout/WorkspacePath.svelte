<script lang="ts">
  import { currentPage } from '$lib/stores/workspace';
  import {
    breadcrumbEpoch, libraryItems, navArea, navChild, navDoor, navItem, screen, seasons, styles, themes,
    openArea, openDoor, openNavChild, openNavItem, showHome, showSeanceScreen
  } from '$lib/workspace/state';
  import { LIBRARY_KINDS, WORKSPACE_DOORS, type WorkspaceArea, type WorkspaceDoor } from '$lib/workspace/catalog';
  import { Select } from 'flowbite-svelte';

  type Choice = { value: string; label: string };
  type Step = {
    key: string;
    label: string;
    value?: string;
    choices?: Choice[];
    change?: (value: string) => void;
    text?: string;
    back?: () => void | Promise<unknown>;
    backLabel?: string;
  };

  const openedTheme = $derived($themes.find(theme => theme.id === $navItem) ?? null);
  const door = $derived(WORKSPACE_DOORS.find(item => item.id === $navDoor) ?? null);
  const domains = $derived([...new Set($libraryItems.map(item => item.domain))].sort((a, b) => a.localeCompare(b, 'fr')));

  function fieldValue(event: Event): string {
    const target = event.currentTarget;
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      ? target.value
      : '';
  }

  const steps = $derived.by(() => {
    const list: Step[] = [];
    const add = (step: Step, back?: () => void | Promise<unknown>, backLabel?: string) => {
      if (list.length && back) {
        step.back = back;
        step.backLabel = backLabel;
      }
      list.push(step);
    };
    if (!$navDoor || !door) return list;
    add({
      key: 'door',
      label: 'Porte',
      value: $navDoor,
      choices: WORKSPACE_DOORS.map(item => ({ value: item.id, label: item.label })),
      change: (value) => { void openDoor(value as WorkspaceDoor); }
    });
    if ($navArea && door.children.length > 1) {
      add({
        key: 'area',
        label: 'Section',
        value: $navArea,
        choices: door.children.map(item => ({ value: item.id, label: item.label })),
        change: (value) => { void openArea(value as WorkspaceArea); }
      }, () => openDoor($navDoor as WorkspaceDoor), `Revenir à ${door.label}`);
    }
    if ($navArea === 'seasons' && $navItem) {
      add({
        key: 'season',
        label: 'Saison',
        value: $navItem,
        choices: $seasons.map(item => ({ value: item.id, label: `${item.name} · ${item.categoryName}` })),
        change: (value) => { void openNavItem(value); }
      }, () => openNavItem(''), `Revenir à ${door.label}`);
    }
    if ($navArea === 'themes' && $navItem) {
      add({
        key: 'theme',
        label: 'Thème',
        value: $navItem,
        choices: $themes.map(theme => ({ value: theme.id, label: theme.name })),
        change: (value) => { void openNavItem(value); }
      }, () => openNavItem(''), `Revenir à ${door.label}`);
    }
    if ($navArea === 'themes' && $navChild) {
      add({
        key: 'session',
        label: 'Séance',
        value: $navChild,
        choices: (openedTheme?.sessions || []).map(session => ({ value: session.id, label: session.name || session.folder })),
        change: (value) => { void openNavChild(value); }
      }, () => openNavChild(''), `Revenir à ${openedTheme?.name || 'Thème'}`);
    }
    if ($screen === 'exercise' && $currentPage) {
      const session = openedTheme?.sessions.find(item => item.id === $navChild);
      add({
        key: 'exercise',
        label: 'Schéma',
        text: $currentPage.name || 'Schéma'
      }, () => showSeanceScreen(), `Revenir à ${session?.name || 'Séance'}`);
    }
    if ($navArea === 'styles' && $navItem) {
      add({
        key: 'style',
        label: 'Style',
        value: $navItem,
        choices: $styles.map(style => ({ value: style.id, label: style.name })),
        change: (value) => { void openNavItem(value); }
      }, () => openNavItem(''), 'Revenir à Styles');
    }
    if ($navArea === 'library' && $navItem) {
      add({
        key: 'domain',
        label: 'Domaine',
        value: $navItem,
        choices: domains.map(domain => ({ value: domain, label: domain })),
        change: (value) => { void openNavItem(value); }
      }, () => openNavItem(''), 'Revenir à Bibliothèque');
    }
    if ($navArea === 'library' && $navChild) {
      add({
        key: 'kind',
        label: 'Dossier',
        value: $navChild,
        choices: LIBRARY_KINDS.map(kind => ({ value: kind.id, label: kind.label })),
        change: (value) => { void openNavChild(value); }
      }, () => openNavChild(''), `Revenir à ${$navItem}`);
    }
    return list;
  });
</script>

{#snippet pathSelect(label: string, value: string, choices: { value: string; label: string }[], change: (value: string) => void)}
  {#key `${value}:${$breadcrumbEpoch}`}
    <Select
      aria-label={label}
      size="sm"
      class="w-auto"
      placeholder=""
      {value}
      items={choices.map(choice => ({ value: choice.value, name: choice.label }))}
      onchange={(e) => change(fieldValue(e))}
    />
  {/key}
{/snippet}

<nav class="flex items-center gap-0.5" aria-label="Chemin">
  <button type="button" class="path-home" aria-label="Accueil" onclick={() => { void showHome(); }}>
    <svg class="size-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4 12 8-8 8 8M6 10.5V19a1 1 0 0 0 1 1h3v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h3a1 1 0 0 0 1-1v-8.5" />
    </svg>
  </button>
  {#each steps as step (step.key)}
    {#if step.back}
      <button type="button" class="path-back" aria-label={step.backLabel} onclick={() => { void step.back?.(); }}>
        <svg class="size-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7" />
        </svg>
      </button>
    {/if}
    {#if step.choices && step.change}
      {@render pathSelect(step.label, step.value || '', step.choices, step.change)}
    {:else}
      <span class="text-sm font-medium">{step.text}</span>
    {/if}
  {/each}
</nav>
