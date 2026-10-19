<script lang="ts">
  import { showExportDialog, currentPage, updateSession, clearSelection } from '$lib/stores/workspace';
  import { exportImage, exportPDF, type ImageExportOptions } from '$lib/services/exportService';

  let format = $state<'jpeg' | 'png' | 'pdf'>('jpeg');
  let resolution = $state<'high' | 'medium' | 'low'>('high');
  let crop = $state(false);
  let busy = $state(false);
  let error = $state('');

  const session = $derived($currentPage?.session ?? {});

  const resLabels: Record<string, string> = {
    high: 'Haute (≈ 2000 px)',
    medium: 'Moyenne (≈ 1400 px)',
    low: 'Basse (≈ 760 px)'
  };

  async function doExport() {
    busy = true;
    error = '';
    try {
      clearSelection();
      await new Promise(r => setTimeout(r, 30)); // let selection clear render
      if (format === 'pdf') {
        await exportPDF();
      } else {
        await exportImage({ format, resolution, crop } as ImageExportOptions);
      }
      showExportDialog.set(false);
    } catch (e) {
      console.error(e);
      error = "Échec de l'export. Réessayez.";
    } finally {
      busy = false;
    }
  }
</script>

<div class="overlay" role="presentation" onclick={() => !busy && showExportDialog.set(false)}>
  <div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>Exporter</h2>
      <button class="close" onclick={() => showExportDialog.set(false)}>✕</button>
    </div>

    <div class="modal-body">
      <div class="block">
        <div class="block-title">Format</div>
        <div class="seg">
          <button class:active={format === 'jpeg'} onclick={() => format = 'jpeg'}>JPEG</button>
          <button class:active={format === 'png'} onclick={() => format = 'png'}>PNG</button>
          <button class:active={format === 'pdf'} onclick={() => format = 'pdf'}>PDF (fiche)</button>
        </div>
      </div>

      {#if format !== 'pdf'}
        <div class="block">
          <div class="block-title">Résolution</div>
          {#each ['high', 'medium', 'low'] as r}
            <label class="radio">
              <input type="radio" name="res" value={r} checked={resolution === r} onchange={() => resolution = r as any} />
              <span>{resLabels[r]}</span>
            </label>
          {/each}
        </div>
        <div class="block">
          <div class="block-title">Recadrage</div>
          <label class="radio"><input type="radio" name="crop" checked={!crop} onchange={() => crop = false} /><span>Terrain complet</span></label>
          <label class="radio"><input type="radio" name="crop" checked={crop} onchange={() => crop = true} /><span>Recadrer sur le contenu</span></label>
        </div>
      {:else}
        <div class="block">
          <div class="block-title">Informations de séance</div>
          <div class="grid2">
            <label class="fld"><span>Date</span><input type="text" value={session.date || ''} oninput={(e) => updateSession({ date: e.currentTarget.value })} placeholder="22/03/2026" /></label>
            <label class="fld"><span>Durée (min)</span><input type="number" value={session.durationMin || ''} oninput={(e) => updateSession({ durationMin: parseInt(e.currentTarget.value) || undefined })} /></label>
            <label class="fld"><span>Niveau</span><input type="text" value={session.level || ''} oninput={(e) => updateSession({ level: e.currentTarget.value })} placeholder="U11 - U13" /></label>
          </div>
          <label class="fld full"><span>Objectif</span><input type="text" value={session.objective || ''} oninput={(e) => updateSession({ objective: e.currentTarget.value })} /></label>
          <p class="note">Le terrain et les notes Markdown sont inclus automatiquement.</p>
        </div>
      {/if}

      {#if error}<div class="error">{error}</div>{/if}
    </div>

    <div class="modal-footer">
      <button class="secondary" onclick={() => showExportDialog.set(false)} disabled={busy}>Annuler</button>
      <button class="primary" onclick={doExport} disabled={busy}>
        {busy ? 'Export…' : format === 'pdf' ? 'Exporter PDF' : `Exporter ${format.toUpperCase()}`}
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55);
    display: flex; align-items: center; justify-content: center; z-index: 3000;
  }
  .modal {
    width: 420px; max-width: 92vw;
    background: var(--bg-panel); border: 1px solid var(--border-color);
    border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    overflow: hidden;
  }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border-color); }
  .modal-header h2 { margin: 0; font-size: 15px; }
  .close { font-size: 14px; color: var(--text-muted); width: 26px; height: 26px; border-radius: 4px; }
  .close:hover { background: var(--hover-bg); color: var(--text-main); }
  .modal-body { padding: 16px 18px; max-height: 60vh; overflow-y: auto; }
  .block { margin-bottom: 18px; }
  .block-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; font-weight: 700; }
  .seg { display: flex; gap: 6px; }
  .seg button { flex: 1; padding: 7px 4px; font-size: 12px; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-main); cursor: pointer; }
  .seg button.active { border-color: var(--accent-primary); background: rgba(94,106,210,0.18); color: var(--accent-primary); }
  .radio { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0; cursor: pointer; }
  .radio input { accent-color: var(--accent-primary); }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .fld { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
  .fld.full { grid-column: 1 / -1; }
  .fld input { background: var(--bg-canvas); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 8px; border-radius: 4px; font-size: 13px; }
  .note { font-size: 11px; color: var(--text-muted); font-style: italic; margin: 4px 0 0; }
  .error { color: #ff7b7b; font-size: 12px; margin-top: 8px; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 18px; border-top: 1px solid var(--border-color); }
  .modal-footer button { padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; }
  .secondary { background: var(--bg-app); border: 1px solid var(--border-color); color: var(--text-main); }
  .primary { background: var(--accent-primary); color: #fff; border: none; }
  .primary:disabled, .secondary:disabled { opacity: 0.5; cursor: default; }
</style>
