<script lang="ts">
  import type { Action } from 'svelte/action';

  let {
    value = $bindable(''),
    placeholder = 'Écrire…',
    preview = false,
    embedded = false,
    onchange
  } = $props<{
    value: string;
    placeholder?: string;
    preview?: boolean;
    embedded?: boolean;
    onchange?: (markdown: string) => void;
  }>();

  type Handle = {
    setReadonly: (value: boolean) => unknown;
    getMarkdown: () => string;
    destroy: () => Promise<unknown>;
  };

  let handle = $state<Handle | null>(null);

  const milkdown: Action = (node) => {
    let dead = false;
    let current: Handle | null = null;
    const started = value;
    void (async () => {
      const [{ Crepe, CrepeFeature }] = await Promise.all([
        import('@milkdown/crepe'),
        import('@milkdown/crepe/theme/common/style.css'),
        import('@milkdown/crepe/theme/frame.css')
      ]);
      if (dead) return;
      const crepe = new Crepe({
        root: node,
        defaultValue: started,
        featureConfigs: {
          [CrepeFeature.Placeholder]: { text: placeholder }
        }
      });
      crepe.on(listener => {
        listener.markdownUpdated((_ctx: unknown, markdown: string) => {
          if (value === markdown) return;
          value = markdown;
          onchange?.(markdown);
        });
      });
      await crepe.create();
      if (dead) {
        await crepe.destroy();
        return;
      }
      crepe.setReadonly(preview);
      current = crepe;
      handle = crepe;
    })();
    return {
      destroy() {
        dead = true;
        handle = null;
        void current?.destroy();
      }
    };
  };

  $effect(() => {
    handle?.setReadonly(preview);
  });
</script>

<div class="editor-container" class:embedded>
  <div use:milkdown class="milkdown-wrapper"></div>
</div>

<style>
  .editor-container {
    width: 100%;
    height: 100%;
    min-height: 300px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background-color: #ffffff;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .editor-container.embedded {
    min-height: 0;
    border: 0;
    border-radius: 0;
  }

  .milkdown-wrapper {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.75rem 1rem 1rem;
  }

  :global(.milkdown) {
    height: 100%;
    max-width: 100% !important;
  }

  :global(.milkdown .editor) {
    padding: 0 !important;
    outline: none !important;
  }

  :global(.milkdown table) {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
    border: 1px solid #e2e8f0;
  }

  :global(.milkdown th, .milkdown td) {
    border: 1px solid #e2e8f0;
    padding: 0.75rem;
    text-align: left;
  }

  :global(.milkdown th) {
    background-color: #f8fafc;
    font-weight: 600;
  }
</style>
