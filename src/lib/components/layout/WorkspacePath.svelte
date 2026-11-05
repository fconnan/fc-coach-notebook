<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { currentPage } from '$lib/stores/workspace';
  import {
    breadcrumbEpoch, catalogReady, libraryItems, navArea, navChild, navDoor, navItem, navLeaf, restoring, screen, seanceHeader, seasons, themes,
    closeEvaluation, openArea, openDoor, openEvaluation, openNavChild, openNavItem, showHome, showSeanceScreen
  } from '$lib/workspace/state';
  import { WORKSPACE_DOORS, elementRel, type WorkspaceArea, type WorkspaceDoor } from '$lib/workspace/catalog';
  import { currentAddress, parseAddress } from '$lib/workspace/address';
import { longFrenchDate } from '$lib/workspace/calendar';
  import { addBookmark, bookmarks, removeBookmark } from '$lib/stores/bookmarks';
  import { Select } from 'flowbite-svelte';
  import { HeartOutline, HeartSolid, TrashBinOutline } from 'flowbite-svelte-icons';
  import LoadingIcon from './LoadingIcon.svelte';

  type Choice = { value: string; label: string };
  type Step = {
    key: string;
    label: string;
    value?: string;
    choices?: Choice[];
    change?: (value: string) => void;
    text?: string;
    loading?: boolean;
    back?: () => void | Promise<unknown>;
    backLabel?: string;
  };

  let mounted = $state(false);
  onMount(() => { mounted = true; });

  const openedTheme = $derived($themes.find(theme => theme.id === $navItem) ?? null);
  const openedSeason = $derived($seasons.find(season => season.id === $navItem) ?? null);
  const openedDoorId = $derived($navDoor || ($restoring ? (parseAddress($page.url.pathname)?.door || '') : ''));
  const door = $derived(WORKSPACE_DOORS.find(item => item.id === openedDoorId) ?? null);
  const seasonChoices = $derived.by(() => {
    const dates = new Map<string, { dates: string[]; name: string }>();
    for (const slot of openedSeason?.slots || []) {
      const entry = dates.get(slot.session) ?? { dates: [], name: slot.sessionName };
      if (slot.date) entry.dates.push(slot.date);
      dates.set(slot.session, entry);
    }
    return [...dates].map(([value, entry]) => ({ value, label: `${entry.dates.join(', ')} · ${entry.name}` }));
  });
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
    if (!$catalogReady) {
      const address = parseAddress($page.url.pathname);
      if (!address?.door) return list;
      const pendingDoor = WORKSPACE_DOORS.find(item => item.id === address.door);
      if (!pendingDoor) return list;
      add({
        key: 'door',
        label: 'Porte',
        value: address.door,
        choices: WORKSPACE_DOORS.map(item => ({ value: item.id, label: item.label })),
        change: (value) => { void openDoor(value as WorkspaceDoor); }
      });
      const labels = address.door === 'elements'
        ? ['Élément']
        : address.door === 'season'
          ? ['Saison', 'Séance', 'Évaluation']
          : ['Thème', 'Séance', 'Schéma'];
      const crumbs = address.door === 'elements'
        ? (address.item ? [address.item] : [])
        : [address.item, address.child, address.exercise].filter(Boolean);
      crumbs.forEach((part, index) => {
        add({ key: `pending-${part}`, label: labels[index] || 'Chargement', loading: true });
      });
      return list;
    }
    if (!openedDoorId || !door) return list;
    add({
      key: 'door',
      label: 'Porte',
      value: openedDoorId,
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
        choices: $seasons.map(item => ({ value: item.id, label: item.name })),
        change: (value) => { void openNavItem(value); }
      }, () => openNavItem(''), `Revenir à ${door.label}`);
    }
    const seasonPlayer = openedSeason?.players.find(player => player.id === $navChild);
    if ($navArea === 'seasons' && seasonPlayer && openedSeason) {
      add({
        key: 'player',
        label: 'Joueur',
        value: seasonPlayer.id,
        choices: openedSeason.players.map(player => ({ value: player.id, label: player.name })),
        change: (value) => { void openNavChild(value); }
      }, () => openNavChild(''), `Revenir à ${openedSeason.name}`);
      if ($navLeaf) {
        add({
          key: 'evaluation',
          label: 'Évaluation',
          value: $navLeaf,
          choices: seasonPlayer.evaluations.map(date => ({ value: date, label: longFrenchDate(date) })),
          change: (value) => openEvaluation(value)
        }, () => closeEvaluation(), `Revenir à ${seasonPlayer.name}`);
      }
    } else if ($navArea === 'seasons' && $navChild) {
      add({
        key: 'session',
        label: 'Séance',
        value: $navChild,
        choices: seasonChoices,
        change: (value) => { void openNavChild(value); }
      }, () => openNavChild(''), `Revenir à ${openedSeason?.name || 'Saison'}`);
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
      add({
        key: 'exercise',
        label: 'Schéma',
        text: $currentPage.name || 'Schéma'
      }, () => showSeanceScreen(), `Revenir à ${$seanceHeader.name || 'Séance'}`);
    }
    if ($navArea === 'elements' && $navItem) {
      const parts = $navItem.split('/').filter(Boolean);
      parts.forEach((part, index) => {
        const parent = parts.slice(0, index).join('/');
        const value = parts.slice(0, index + 1).join('/');
        const current = $libraryItems.find(item => elementRel(item.path) === value);
        const back = () => openNavItem(parent);
        const backLabel = parent ? `Revenir à ${parts[index - 1]}` : 'Revenir à Éléments';
        if (current && current.kind !== 'folder') {
          const choices = $libraryItems
            .filter(item => item.kind !== 'folder' && elementRel(item.path).split('/').slice(0, -1).join('/') === parent)
            .map(item => ({ value: elementRel(item.path), label: item.name }))
            .sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }));
          add({
            key: value,
            label: 'Fichier',
            value,
            choices,
            change: (next) => { void openNavItem(next); }
          }, back, backLabel);
          return;
        }
        const choices = $libraryItems
          .filter(item => item.kind === 'folder' && elementRel(item.path).split('/').slice(0, -1).join('/') === parent)
          .map(item => ({ value: elementRel(item.path), label: item.name }))
          .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
        add({
          key: value,
          label: 'Dossier',
          value,
          choices,
          change: (next) => { void openNavItem(next); }
        }, back, backLabel);
      });
    }
    return list;
  });

  const label = $derived(steps
    .map(step => step.choices?.find(choice => choice.value === step.value)?.label ?? step.text ?? '')
    .filter(Boolean)
    .join(' > ') || 'Accueil');
  const here = $derived.by(() => {
    void steps;
    return currentAddress();
  });
  const marked = $derived(mounted && $bookmarks.some(bookmark => bookmark.path === here));
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

<div class="flex w-full flex-col gap-1">
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
    {#if step.loading}
      <LoadingIcon />
    {:else if step.choices && step.change}
      {@render pathSelect(step.label, step.value || '', step.choices, step.change)}
    {:else}
      <span class="text-sm font-medium">{step.text}</span>
    {/if}
  {/each}
  <button
    type="button"
    class="path-mark ms-auto"
    aria-label="Ajouter aux favoris"
    title={marked ? 'Déjà dans les favoris' : 'Ajouter aux favoris'}
    disabled={marked}
    onclick={() => addBookmark({ path: here, label })}
  >
    {#if marked}<HeartSolid class="size-4" />{:else}<HeartOutline class="size-4" />{/if}
  </button>
</nav>
{#if mounted && $bookmarks.length}
  <ul class="flex flex-col gap-0.5" aria-label="Favoris">
    {#each $bookmarks as bookmark (bookmark.path)}
      <li class="flex items-center gap-2">
        <a href={bookmark.path} class="truncate text-sm font-medium text-fg-brand hover:underline">{bookmark.label}</a>
        <button
          type="button"
          class={['path-mark ms-auto', bookmark.path === here && 'current']}
          aria-label={`Retirer ${bookmark.label} des favoris`}
          title="Retirer des favoris"
          onclick={() => removeBookmark(bookmark.path)}
        ><TrashBinOutline class="size-4" /></button>
      </li>
    {/each}
  </ul>
{/if}
</div>
