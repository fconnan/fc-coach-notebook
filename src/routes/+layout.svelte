<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/workspace';
  import { refreshSession } from '$lib/storage/cloudClient';
import { startAutosave } from '$lib/storage/session';
import { restoreWorkspace, startWorkspaceAutosave } from '$lib/workspace/state';

  let { children } = $props();

  onMount(() => {
    const saved = localStorage.getItem('fctactics_theme');
    if (saved === 'dark' || saved === 'light') theme.set(saved);
    refreshSession();
    void (async () => {
      await restoreWorkspace();
      startAutosave();
      startWorkspaceAutosave();
    })();
  });

  $effect(() => {
    const t = $theme;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('fctactics_theme', t); } catch { /* ignore */ }
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
