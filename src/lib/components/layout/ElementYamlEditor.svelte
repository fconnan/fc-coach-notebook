<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from 'flowbite-svelte';
  import { registerEditorGate, unsavedAsk } from '$lib/workspace/editorLeave';
  import { refreshLibrary } from '$lib/schema/preview';
  import type { LibraryEntry } from '$lib/schema/types';
  import { openNavItem } from '$lib/workspace/state';
  import { elementRel } from '$lib/workspace/catalog';
  import { dottedId } from '$lib/schema/scene';
  import SchemaEditor from './SchemaEditor.svelte';

  let { file }: { file: string } = $props();
  const elementId = $derived(dottedId(file.split('/').pop() || ''));

  let yaml = $state('');
  let yamlDisk = $state('');
  let library = $state<LibraryEntry[]>([]);
  let error = $state('');
  let status = $state('');
  let loaded = $state(false);
  let saving = $state(false);

  function canon(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  }

  const dirty = $derived(loaded && canon(yaml) !== canon(yamlDisk));

  function onYaml(text: string) {
    yaml = text;
  }

  async function load() {
    loaded = false;
    error = '';
    refreshLibrary();
    const response = await fetch(`/api/elements?file=${encodeURIComponent(file)}`);
    const body = await response.json() as { source?: string; library?: LibraryEntry[]; error?: string };
    if (!response.ok) {
      error = body.error || 'Lecture impossible';
      return;
    }
    library = body.library || [];
    yaml = yamlDisk = body.source || '';
    loaded = true;
    status = '';
  }

  let epoch = 0;
  let tail: Promise<boolean> = Promise.resolve(true);

  function discard() {
    epoch += 1;
    yaml = yamlDisk;
  }

  async function write(): Promise<boolean> {
    const token = epoch;
    if (!loaded || token !== epoch || canon(yaml) === canon(yamlDisk)) return true;
    const snapshot = yaml;
    const next = snapshot.replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n';
    saving = true;
    status = 'Enregistrement…';
    try {
      const response = await fetch('/api/elements', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file, source: next })
      });
      if (token !== epoch) return true;
      if (!response.ok) {
        status = 'Échec de l’enregistrement';
        return false;
      }
      if (yaml === snapshot) yamlDisk = snapshot;
      refreshLibrary();
      status = 'Enregistré';
      return true;
    } catch {
      if (token !== epoch) return true;
      status = 'Échec de l’enregistrement';
      return false;
    } finally {
      saving = false;
    }
  }

  function save(): Promise<boolean> {
    const run = tail.then(write, write);
    tail = run.then(() => true, () => false);
    return run;
  }

  function close() {
    const parent = elementRel(file).split('/').slice(0, -1).join('/');
    void openNavItem(parent);
  }

  $effect(() => {
    const text = yaml;
    const asking = $unsavedAsk;
    if (!loaded || asking || canon(text) === canon(yamlDisk)) return;
    const timer = setTimeout(() => { void save(); }, 600);
    return () => clearTimeout(timer);
  });

  onMount(() => {
    const stop = registerEditorGate({ dirty: () => dirty, save, discard });
    void load();
    return stop;
  });
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
  <div class="flex shrink-0 items-center gap-3">
    <p class="text-sm text-body">{status}</p>
    <div class="ms-auto flex items-center gap-2">
      <Button size="sm" color="brand" disabled={!dirty || saving} onclick={() => { void save(); }}>Sauver</Button>
      <Button size="sm" color="alternative" onclick={close}>Fermer</Button>
    </div>
  </div>
  {#if error}<p class="text-sm text-red-700">{error}</p>{/if}
  <div class="min-h-0 flex-1">
    <SchemaEditor source={yaml} {library} {loaded} {elementId} element onchange={onYaml} />
  </div>
</div>
