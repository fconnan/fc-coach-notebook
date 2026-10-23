<script lang="ts">
  import { onMount } from 'svelte';
  import { navArea, navItem, seanceHeader, seasons, sessionTheme, themes, trainer, saveSessionMarkdown } from '$lib/workspace/state';
  import { themeKey } from '$lib/workspace/catalog';
  import { trainerLabel } from '$lib/workspace/model';
  import { fillTemplate, readTemplate } from '$lib/workspace/templates';
  import { renderMarkdown } from '$lib/workspace/markdownHtml';
  import { Button, Card, Heading } from 'flowbite-svelte';
  import { LinkOutline } from 'flowbite-svelte-icons';
  import MarkdownEditor from './MarkdownEditor.svelte';

  let { editable = true }: { editable?: boolean } = $props();

  let editing = $state(false);
  let draft = $state('');
  let savingText = $state(false);
  let template = $state('');

  const planning = $derived($navArea === 'seasons');
  const theme = $derived($themes.find(item => item.sessions.some(session => session.id === $seanceHeader.id)) ?? null);
  const themeHref = $derived(theme ? `/repertoire/${themeKey(theme)}` : '');
  const sessionHref = $derived(theme && $seanceHeader.id ? `${themeHref}/${$seanceHeader.id}` : '');
  const season = $derived($seasons.find(item => item.id === $navItem) ?? null);
  const slots = $derived(planning ? (season?.slots.filter(slot => slot.session === $seanceHeader.id) ?? []) : []);
  const themeMarkdown = $derived($sessionTheme.markdown.trim() || ($sessionTheme.name ? `# ${$sessionTheme.name}` : ''));
  const shown = $derived.by(() => {
    const saved = ($seanceHeader.markdown || '').trim();
    if (saved) return $seanceHeader.markdown || '';
    const text = fillTemplate(template, {
      name: $seanceHeader.name,
      phase: $seanceHeader.phase,
      principle: $seanceHeader.principle,
      means: $seanceHeader.means,
      trainer: trainerLabel($trainer),
      date: slots.map(slot => slot.date).filter(Boolean).join(', ') || $seanceHeader.date,
      category: planning ? (season?.categoryName || '') : '',
      sheet: slots.map(slot => slot.sheet).filter(Boolean).join(', ') || $seanceHeader.sheet
    });
    return text.split('\n').filter(line => !/:\s*$/.test(line)).join('\n');
  });

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

<div class="flex items-center justify-between gap-3">
  <Heading tag="h2" class="inline-flex items-center gap-2 text-xl">
    Thème
    {#if planning && themeHref}
      <a href={themeHref} class="text-fg-brand" aria-label="Ouvrir le thème" title="Ouvrir le thème"><LinkOutline class="size-4" /></a>
    {/if}
  </Heading>
</div>
<Card size="xl" class="p-6">
  <div class="session-md">{@html renderMarkdown(themeMarkdown)}</div>
</Card>

<div class="flex items-center justify-between gap-3">
  <Heading tag="h2" class="inline-flex items-center gap-2 text-xl">
    Séance
    {#if planning && sessionHref}
      <a href={sessionHref} class="text-fg-brand" aria-label="Ouvrir la séance" title="Ouvrir la séance"><LinkOutline class="size-4" /></a>
    {/if}
  </Heading>
  {#if editable && !editing}
    <Button size="sm" color="brand" onclick={startEdit}>Éditer</Button>
  {/if}
</div>
<Card size="xl" class="p-6">
  {#if editable && editing}
    <div class="mb-3 flex justify-end gap-2">
      <Button size="sm" color="alternative" onclick={cancelEdit}>Annuler</Button>
      <Button size="sm" color="brand" disabled={savingText} onclick={() => { void saveEdit(); }}>Sauver</Button>
    </div>
    <MarkdownEditor bind:value={draft} />
  {:else}
    <div class="session-md">{@html renderMarkdown(shown)}</div>
  {/if}
</Card>

<style>
  .session-md { font-size: 0.975rem; line-height: 1.5; }
  .session-md :global(h1) { margin: 0 0 0.75rem; font-size: 1.15rem; font-weight: 700; }
  .session-md :global(h2) { margin: 0.9rem 0 0.3rem; font-size: 1rem; font-weight: 650; }
  .session-md :global(p) { margin: 0.35rem 0; }
  .session-md :global(ul) { margin: 0.25rem 0 0.6rem; padding-left: 1.15rem; list-style: disc; }
  .session-md :global(li) { margin: 0.12rem 0; }
</style>
