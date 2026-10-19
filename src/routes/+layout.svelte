<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { tryToReconnectDirectory } from '$lib/services/tacticFileService';

  let { children } = $props();

  onMount(async () => {
    // Attempt to reconnect to the last directory for "Save" functionality
    await tryToReconnectDirectory();
  });
</script>

{@render children()}
