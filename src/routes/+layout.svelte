<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/workspace';
  import { refreshSession } from '$lib/storage/cloudClient';
  import { restoreSession, startAutosave } from '$lib/storage/session';

  let { children } = $props();

  onMount(() => {
    const saved = localStorage.getItem('fctactics_theme');
    if (saved === 'dark' || saved === 'light') theme.set(saved);
    refreshSession();
    restoreSession();
    startAutosave();
  });

  $effect(() => {
    const t = $theme;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('fctactics_theme', t); } catch { /* ignore */ }
    }
  });
</script>

{@render children()}
