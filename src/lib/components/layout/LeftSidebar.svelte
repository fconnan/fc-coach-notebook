<script lang="ts">
  import { setFieldTemplate } from '$lib/stores/workspace';
  
  const categories = [
    { title: 'Équipe 1', type: 'player', team: 'team1', items: [{ icon: '🔵', label: '1' }, { icon: '🧤', label: 'G' }] },
    { title: 'Équipe 2', type: 'player', team: 'team2', items: [{ icon: '🔴', label: '1' }, { icon: '🧤', label: 'G' }] },
    { title: 'Éléments', type: 'ball', team: 'none', items: [{ icon: '⚽', label: '' }, { icon: '🚩', label: '' }] },
    { title: 'Tracés', type: 'arrow', team: 'none', items: [{ icon: '↗️', label: '' }, { icon: '➡️', label: '' }] },
    { title: 'Terrains', type: 'field', team: 'none', items: [{ icon: '🟩', label: 'Complet' }, { icon: '🟢', label: 'Demi' }] }
  ];

  function onDragStart(e: DragEvent, type: string, team: string, label: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('type', type);
      e.dataTransfer.setData('team', team);
      e.dataTransfer.setData('label', label);
      e.dataTransfer.effectAllowed = 'copy';
    }
  }

  function onItemClick(type: string, label: string) {
    if (type === 'field') {
      setFieldTemplate(label === 'Demi' ? 'Demi' : 'Complet');
    }
  }
</script>

<div class="left-sidebar">
  {#each categories as category}
    <div class="category">
      <div class="category-header">{category.title}</div>
      <div class="category-items">
        {#each category.items as item}
          <div 
            class="item" 
            draggable="true" 
            role="button"
            tabindex="0"
            title={item.label || category.title}
            ondragstart={(e) => onDragStart(e, category.type, category.team, item.label)}
            onclick={() => onItemClick(category.type, item.label)}
            onkeydown={(e) => e.key === 'Enter' && onItemClick(category.type, item.label)}
          >
            <span class="icon">{item.icon}</span>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .left-sidebar {
    width: 240px;
    background-color: var(--bg-panel);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  
  .category {
    border-bottom: 1px solid var(--border-color);
  }
  
  .category-header {
    padding: 10px 14px;
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--text-muted);
    letter-spacing: 0.5px;
    background-color: rgba(0, 0, 0, 0.2);
  }
  
  .category-items {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 12px;
  }
  
  .item {
    aspect-ratio: 1;
    background-color: var(--bg-canvas);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: grab;
    transition: all 0.2s;
  }
  
  .item:hover {
    border-color: var(--accent-primary);
    background-color: var(--hover-bg);
  }
  
  .item:active {
    cursor: grabbing;
  }
  
  .icon {
    font-size: 24px;
  }
</style>
