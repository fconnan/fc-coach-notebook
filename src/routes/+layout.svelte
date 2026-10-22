<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import '../app.css';
  import { onMount } from 'svelte';
  import { refreshSession } from '$lib/storage/cloudClient';
  import { idbDel } from '$lib/storage/idb';
  import { startAutosave } from '$lib/storage/session';
  import { installAddress } from '$lib/workspace/address';
  import { restoreWorkspace, startWorkspaceAutosave } from '$lib/workspace/state';

  let { children } = $props();

  onMount(() => {
    try {
      for (const key of ['fctactics_ws_cursor', 'fctactics_ws_snap', 'fctactics_session', 'fctactics_theme', 'THEME_PREFERENCE_KEY', 'fctactics.fullscreen', 'fctactics_left_w', 'fctactics_notes_w', 'fctactics_right_w', 'fctactics_show_left', 'fctactics_show_right', 'fctactics_destinations']) {
        localStorage.removeItem(key);
      }
      sessionStorage.removeItem('fctactics_ws_snap');
      sessionStorage.removeItem('fctactics_session');
      if (window.name.startsWith('fctactics:')) window.name = '';
    } catch { /* ignore */ }
    void idbDel('workspace_snapshot');
    installAddress();
    refreshSession();
    void (async () => {
      await restoreWorkspace();
      startAutosave();
      startWorkspaceAutosave();
    })();
  });

</script>

<svelte:head>
  <link rel="icon" href={logo} />
  <script>
    try {
      if (sessionStorage.getItem('fctactics_ui_dark') === '1') document.documentElement.classList.add('dark');
    } catch (e) { /* session indisponible */ }
  </script>
</svelte:head>

{@render children()}
