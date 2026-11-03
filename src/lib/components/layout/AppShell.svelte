<script lang="ts">
  import type { Snippet } from 'svelte';
  import logo from '$lib/assets/logo.png';
  import { Button, ButtonGroup, Navbar, NavBrand } from 'flowbite-svelte';
  import { RefreshOutline } from 'flowbite-svelte-icons';
  import { folderLabel, needsPermission, pickWorkspace, refreshWorkspace, resumeWorkspace, showHome, workspaceOpen } from '$lib/workspace/state';

  let { children, fill = false, bar }: { children?: Snippet; fill?: boolean; bar?: Snippet } = $props();

  const WIDE = 'fctactics.wide';
  const DARK = 'fctactics_ui_dark';
  let wide = $state(false);
  let choosing = $state(false);

  function savedWide(): boolean {
    try { return sessionStorage.getItem(WIDE) === '1'; } catch { return false; }
  }

  function toggleWide() {
    wide = !wide;
    try { sessionStorage.setItem(WIDE, wide ? '1' : '0'); } catch { /* ignore */ }
  }

  function toggleDark() {
    const dark = document.documentElement.classList.toggle('dark');
    try { sessionStorage.setItem(DARK, dark ? '1' : '0'); } catch { /* ignore */ }
  }

  async function changeFolder() {
    choosing = true;
    try {
      if ($needsPermission && !$workspaceOpen) await resumeWorkspace();
      else await pickWorkspace(false);
    } finally {
      choosing = false;
    }
  }

  $effect(() => {
    if (!$workspaceOpen) return;
    wide = savedWide();
  });
</script>

<div class="flex h-screen flex-col overflow-hidden bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-white">
  <Navbar fluid class="shrink-0">
    <NavBrand href="#marque" onclick={(e) => { e.preventDefault(); if ($workspaceOpen) void showHome(); }}>
      <img src={logo} alt="" class="me-3 h-10 w-auto object-contain" />
      <span class="flex flex-col items-start text-left">
        <span class="text-lg font-semibold whitespace-nowrap">FC Coach Notebook</span>
        <span class="text-sm font-normal text-gray-500 dark:text-gray-400">Préparer la saison d’entraînement</span>
      </span>
    </NavBrand>
    <div class="ms-auto flex items-center gap-2">
      {#if $workspaceOpen}
        <ButtonGroup>
          <Button color="alternative" disabled={choosing} onclick={changeFolder} title="Espace de travail">
            <span class="max-w-56 truncate">{$folderLabel || 'Sans nom'}</span>
          </Button>
          <Button color="alternative" aria-label="Actualiser" title="Actualiser" onclick={() => refreshWorkspace()}>
            <RefreshOutline class="h-4 w-4" />
          </Button>
        </ButtonGroup>
        <Button
          color="alternative"
          aria-pressed={wide}
          aria-label={wide ? 'Resserrer la page' : 'Élargir la page'}
          title={wide ? 'Resserrer la page' : 'Élargir la page'}
          onclick={toggleWide}
        >
          {#if wide}
            <svg class="icon-margins" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M3 12h6M9 12l-3-3M9 12l-3 3M21 12h-6M15 12l3-3M15 12l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {:else}
            <svg class="icon-expand" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M9 12H3M3 12l3-3M3 12l3 3M15 12h6M21 12l-3-3M21 12l-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {/if}
        </Button>
      {/if}
      <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-base p-2 text-sm text-body hover:bg-neutral-secondary-soft hover:text-heading focus:ring-2 focus:ring-neutral-tertiary focus:outline-none" aria-label="Dark mode" onclick={toggleDark}>
        <svg class="hidden h-4 w-4 dark:block" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5V3m0 18v-2M7.05 7.05 5.636 5.636m12.728 12.728L16.95 16.95M5 12H3m18 0h-2M7.05 16.95l-1.414 1.414M18.364 5.636 16.95 7.05M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"></path>
        </svg>
        <svg class="block h-4 w-4 dark:hidden" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 0 1-.5-17.986V3c-.354.966-.5 1.911-.5 3a9 9 0 0 0 9 9c.239 0 .254.018.488 0A9.004 9.004 0 0 1 12 21Z"></path>
        </svg>
      </button>
    </div>
  </Navbar>
  {#if bar}
    <div class="flex shrink-0 items-center px-2 py-1.5 sm:px-4" data-scope="app-path">
      {@render bar()}
    </div>
  {/if}
  <div class={fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-h-0 flex-1 overflow-y-auto'}>
    <main class={fill ? 'flex h-full min-h-0 flex-col px-4 py-4' : wide ? 'is-wide w-full px-4 py-6' : 'mx-auto w-full max-w-6xl px-4 py-6'}>
      {#if children}{@render children()}{/if}
    </main>
  </div>
</div>
