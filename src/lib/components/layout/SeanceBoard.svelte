<script lang="ts">
  import { onMount } from 'svelte';
  import { pages, type Page } from '$lib/stores/workspace';
  import { exerciseDocument, exerciseOrder } from '$lib/workspace/exerciseFile';
  import { categoryInfo, exercisePaths, seanceHeader, trainer, showExercise, createExercise, saveSessionMarkdown } from '$lib/workspace/state';
  import { trainerLabel } from '$lib/workspace/model';
  import { fillTemplate, readTemplate } from '$lib/workspace/templates';
  import { Alert, Button, Card, Heading, Input, Label, Modal } from 'flowbite-svelte';
  import { PenOutline } from 'flowbite-svelte-icons';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import SchemaPreview from './SchemaPreview.svelte';

  let adding = $state(false);
  let editing = $state(false);
  let draft = $state('');
  let savingText = $state(false);
  let template = $state('');
  let entryName = $state('');
  let plainName = $state('');
  let addError = $state('');

  function openAdd() {
    adding = true;
    entryName = '';
    plainName = '';
    addError = '';
  }

  async function confirmAdd() {
    addError = (await createExercise(entryName, plainName)) || '';
    if (!addError) adding = false;
  }

  function renderMarkdown(source: string): string {
    const html: string[] = [];
    let list = false;
    const closeList = () => {
      if (!list) return;
      html.push('</ul>');
      list = false;
    };
    for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
      if (!line.trim()) {
        closeList();
        continue;
      }
      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      if (heading) {
        closeList();
        const level = heading[1].length;
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        continue;
      }
      const item = /^[-*]\s+(.*)$/.exec(line);
      if (item) {
        if (!list) {
          html.push('<ul>');
          list = true;
        }
        html.push(`<li>${inline(item[1])}</li>`);
        continue;
      }
      closeList();
      html.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    return html.join('');
  }

  function inline(text: string): string {
    return escape(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  function escape(text: string): string {
    return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);
  }

  function exerciseHtml(page: Page, order: number): string {
    const drill = page.drill || {};
    return renderMarkdown(exerciseDocument({
      name: page.name,
      drill: {
        kind: drill.kind || '',
        method: drill.method || '',
        duration: drill.duration || '',
        area: drill.area || '',
        headcount: drill.headcount || '',
        equipment: drill.equipment || ''
      },
      markdownContent: page.markdownContent || ''
    }, exerciseOrder(($exercisePaths[page.id] || '').split('/').pop() || '', order)));
  }

  function schemaAt(id: string): string {
    return $exercisePaths[id] || '';
  }

  const shown = $derived(($seanceHeader.markdown || '').trim()
    ? $seanceHeader.markdown || ''
    : fillTemplate(template, {
      name: $seanceHeader.name,
      phase: $seanceHeader.phase,
      principle: $seanceHeader.principle,
      means: $seanceHeader.means,
      trainer: trainerLabel($trainer),
      date: $seanceHeader.date,
      category: $categoryInfo?.name || '',
      sheet: $seanceHeader.sheet
    }));

  onMount(() => {
    void readTemplate('session').then(text => { template = text; });
  });

  function startEdit() {
    draft = shown;
    editing = true;
  }

  function cancelEdit() {
    editing = false;
    draft = '';
  }

  async function saveEdit() {
    savingText = true;
    const ok = await saveSessionMarkdown(draft);
    savingText = false;
    if (ok) editing = false;
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between gap-3">
    <Heading tag="h2" class="text-xl">Thème</Heading>
    {#if !editing}
      <Button size="sm" color="brand" onclick={startEdit}>Éditer le thème</Button>
    {/if}
  </div>
  <Card size="xl" class="p-6">
    {#if editing}
      <div class="mb-3 flex justify-end gap-2">
        <Button size="sm" color="alternative" onclick={cancelEdit}>Annuler</Button>
        <Button size="sm" color="brand" disabled={savingText} onclick={() => { void saveEdit(); }}>Sauver</Button>
      </div>
      <MarkdownEditor bind:value={draft} />
    {:else}
      <div class="session-md">{@html renderMarkdown(shown)}</div>
    {/if}
  </Card>

  <div class="flex items-center justify-between">
    <Heading tag="h2" class="text-xl">Exercices</Heading>
    <Button size="sm" color="brand" onclick={openAdd}>Ajouter un exercice</Button>
  </div>

  {#each $pages as page, index (page.id)}
    <Card size="xl" class="p-6">
      <div class="mb-3 flex justify-end">
        <Button size="sm" color="alternative" onclick={() => showExercise(page.id)}>
          <PenOutline class="me-1 h-3.5 w-3.5" /> Modifier
        </Button>
      </div>
      <div class="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div class="exercise-frame flex min-h-0 flex-col overflow-hidden lg:h-0 lg:min-h-full">
          <div class="exercise-md min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {@html exerciseHtml(page, index)}
          </div>
        </div>
        <SchemaPreview at={schemaAt(page.id)} exerciseId={page.id} />
      </div>
    </Card>
  {/each}
</div>

<style>
  .session-md { font-size: 0.975rem; line-height: 1.5; }
  .session-md :global(h1) { margin: 0 0 0.75rem; font-size: 1.15rem; font-weight: 700; }
  .session-md :global(h2) { margin: 0.9rem 0 0.3rem; font-size: 1rem; font-weight: 650; }
  .session-md :global(p) { margin: 0.35rem 0; }
  .session-md :global(ul) { margin: 0.25rem 0 0.6rem; padding-left: 1.15rem; list-style: disc; }
  .session-md :global(li) { margin: 0.12rem 0; }
  .exercise-frame {
    border: 1px solid var(--color-default-medium);
    border-radius: 0;
  }
  .exercise-md {
    padding: 0.9rem 1rem;
    font-size: 0.925rem;
    line-height: 1.45;
  }
  .exercise-md :global(h1) { margin: 0 0 0.75rem; font-size: 1.05rem; font-weight: 650; }
  .exercise-md :global(h2) { margin: 0.9rem 0 0.3rem; font-size: 0.95rem; font-weight: 650; }
  .exercise-md :global(h3) { margin: 0.75rem 0 0.25rem; font-size: 0.9rem; font-weight: 650; }
  .exercise-md :global(p) { margin: 0.35rem 0; }
  .exercise-md :global(ul) { margin: 0.25rem 0 0.6rem; padding-left: 1.15rem; list-style: disc; }
  .exercise-md :global(li) { margin: 0.12rem 0; }
</style>

<Modal title="Nouvel exercice" bind:open={adding} size="md">
  <form id="exercise-form" class="space-y-3" onsubmit={(e) => { e.preventDefault(); void confirmAdd(); }}>
    <Label>Répertoire <Input class="mt-1" bind:value={entryName} /></Label>
    <Label>Nom <Input class="mt-1" bind:value={plainName} /></Label>
    {#if addError}<Alert color="red">{addError}</Alert>{/if}
  </form>
  {#snippet footer()}
    <Button color="alternative" onclick={() => adding = false}>Annuler</Button>
    <Button color="brand" type="submit" form="exercise-form">OK</Button>
  {/snippet}
</Modal>
