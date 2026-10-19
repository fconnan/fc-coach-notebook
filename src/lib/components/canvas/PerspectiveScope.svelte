<script lang="ts">
  import type { Projector } from '$lib/utils/projection';
  import { setPerspectiveContext } from '$lib/utils/perspectiveContext';
  import type { Snippet } from 'svelte';

  let { projector, children }: { projector: Projector | null; children: Snippet } = $props();

  setPerspectiveContext(() => projector);
</script>

{@render children()}
