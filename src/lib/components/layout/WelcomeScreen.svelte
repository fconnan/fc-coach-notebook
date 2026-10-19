<script lang="ts">
  import { openDirectory, listTactics } from '$lib/services/tacticFileService';
  import { showTacticBrowser } from '$lib/stores/workspace';

  async function handleOpenFolder() {
    const handle = await openDirectory();
    if (handle) {
      const tactics = await listTactics();
      if (tactics.length === 0) {
        showTacticBrowser.set(true);
      }
    }
  }
</script>

<div class="welcome-container">
  <div class="content">
    <div class="logo-large">FC Tactics</div>
    <h1>Simplifiez votre gestion tactique</h1>
    <p class="description">
      Dessinez vos schémas, rédigez vos notes et gérez vos fiches directement dans vos dossiers locaux.
      Le compagnon idéal pour vos préparations de match.
    </p>

    <div class="features">
      <div class="feature-card">
        <div class="icon">📂</div>
        <h3>Dossier Local</h3>
        <p>Vos fichiers restent chez vous. Travaillez sur votre Drive ou votre disque dur.</p>
      </div>
      <div class="feature-card">
        <div class="icon">📝</div>
        <h3>Markdown</h3>
        <p>Prenez des notes structurées à côté de vos schémas tactiques.</p>
      </div>
      <div class="feature-card">
        <div class="icon">⚡</div>
        <h3>Instantané</h3>
        <p>Sauvegarde automatique et rechargement ultra-rapide.</p>
      </div>
    </div>

    <button class="cta-button" onclick={handleOpenFolder}>
      Ouvrir un répertoire pour commencer
    </button>
  </div>
</div>

<style>
  .welcome-container {
    height: 100vh;
    width: 100vw;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at top right, #1a1c1e 0%, #0a0b0c 100%);
    color: white;
    font-family: 'Inter', sans-serif;
    overflow: hidden;
  }

  .content {
    max-width: 800px;
    text-align: center;
    padding: 40px;
    animation: fadeIn 0.8s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .logo-large {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 4px;
    color: var(--accent-primary);
    text-transform: uppercase;
    margin-bottom: 24px;
  }

  h1 {
    font-size: 48px;
    font-weight: 800;
    margin-bottom: 16px;
    background: linear-gradient(to bottom right, #fff, #94a3b8);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .description {
    font-size: 18px;
    color: #94a3b8;
    line-height: 1.6;
    margin-bottom: 48px;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-bottom: 60px;
  }

  .feature-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 24px;
    border-radius: 16px;
    transition: transform 0.3s ease, border-color 0.3s ease;
  }

  .feature-card:hover {
    transform: translateY(-5px);
    border-color: var(--accent-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  .feature-card .icon {
    font-size: 32px;
    margin-bottom: 16px;
  }

  .feature-card h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #e2e8f0;
  }

  .feature-card p {
    font-size: 13px;
    color: #64748b;
    line-height: 1.5;
  }

  .cta-button {
    background-color: var(--accent-primary);
    color: white;
    padding: 16px 32px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4);
  }

  .cta-button:hover {
    transform: scale(1.02);
    background-color: var(--accent-hover);
    box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.5);
  }

  .cta-button:active {
    transform: scale(0.98);
  }
</style>
