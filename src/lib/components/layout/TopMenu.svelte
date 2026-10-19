<script lang="ts">
  const menus = ['Fichier', 'Modifier', 'Vue', 'Organiser', 'Aide'];
</script>

<div class="top-menu">
  <div class="logo">FC Tactics</div>
  {#each menus as menu}
    <button class="menu-item">{menu}</button>
  {/each}
</div>

<style>
  .top-menu {
    display: flex;
    align-items: center;
    background-color: var(--bg-panel);
    padding: 2px 12px;
    height: 32px;
  }
  
  .logo {
    font-weight: 600;
    color: var(--accent-hover);
    margin-right: 20px;
    font-size: 14px;
    letter-spacing: 0.5px;
  }
  
  .menu-item {
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 4px;
    color: var(--text-main);
  }
  
  .menu-item:hover {
    background-color: var(--hover-bg);
  }
</style>
