<script lang="ts">
  import { hexForInput } from '$lib/schema/params';
  import type { TrajectoryDraft } from '$lib/schema/arrowDraft';

  let {
    value,
    base,
    onchange,
    onreset
  }: {
    value: TrajectoryDraft;
    base: TrajectoryDraft;
    onchange: (next: TrajectoryDraft) => void;
    onreset: () => void;
  } = $props();

  const wavy = $derived(value.motif !== 'none');
  const dirty = $derived(
    value.ink !== base.ink
    || Math.abs(value.width - base.width) > 1e-6
    || value.dash !== base.dash
    || value.motif !== base.motif
    || (wavy && (
      Math.abs(value.wave - base.wave) > 1e-6
      || Math.abs(value.amp - base.amp) > 1e-6
      || Math.abs(value.phase - base.phase) > 1e-6
      || value.side !== base.side
      || Math.abs(value.taper - base.taper) > 1e-6
    ))
  );

  function set<K extends keyof TrajectoryDraft>(key: K, next: TrajectoryDraft[K]) {
    onchange({ ...value, [key]: next });
  }

  function num(event: Event): number {
    const raw = event.currentTarget instanceof HTMLInputElement ? Number(event.currentTarget.value) : 0;
    return Math.round(raw * 100) / 100;
  }
</script>

<div class="params">
  <label class="param" title="Encre du trait">
    <span>ink</span>
    <span class="swatch">
      <span class="chip" style:background={hexForInput(value.ink)}></span>
      <input type="color" aria-label="ink" value={hexForInput(value.ink)} oninput={(event) => set('ink', event.currentTarget.value)} />
    </span>
  </label>
  <label class="param" title="Épaisseur du trait, en mètres">
    <span>width</span>
    <input type="range" min="0.04" max="0.4" step="0.01" value={value.width} aria-label="width" oninput={(event) => set('width', num(event))} />
  </label>
  <label class="param" title="Pointillés, ou none">
    <span>dash</span>
    <input type="text" aria-label="dash" value={value.dash} oninput={(event) => set('dash', event.currentTarget.value)} />
  </label>
  <label class="param" title="Motif latéral">
    <span>motif</span>
    <select aria-label="motif" value={value.motif} onchange={(event) => set('motif', event.currentTarget.value as TrajectoryDraft['motif'])}>
      <option value="none">none</option>
      <option value="sine">sine</option>
      <option value="zigzag">zigzag</option>
    </select>
  </label>
  {#if wavy}
    <label class="param" title="Longueur d'onde, en mètres">
      <span>wave</span>
      <input type="range" min="0.3" max="3" step="0.05" value={value.wave} aria-label="wave" oninput={(event) => set('wave', num(event))} />
    </label>
    <label class="param" title="Amplitude, en mètres">
      <span>amp</span>
      <input type="range" min="0" max="1.5" step="0.05" value={value.amp} aria-label="amp" oninput={(event) => set('amp', num(event))} />
    </label>
    <label class="param" title="Décalage de phase, en radians">
      <span>phase</span>
      <input type="range" min="0" max="6.3" step="0.05" value={value.phase} aria-label="phase" oninput={(event) => set('phase', num(event))} />
    </label>
    <label class="param" title="Côté du motif : 1 vers la gauche du déplacement">
      <span>side</span>
      <select aria-label="side" value={String(value.side)} onchange={(event) => set('side', event.currentTarget.value === '-1' ? -1 : 1)}>
        <option value="1">1</option>
        <option value="-1">-1</option>
      </select>
    </label>
    <label class="param" title="Adoucissement aux extrémités, en mètres">
      <span>taper</span>
      <input type="range" min="0" max="2" step="0.05" value={value.taper} aria-label="taper" oninput={(event) => set('taper', num(event))} />
    </label>
  {/if}
  <button type="button" class="reset" disabled={!dirty} onclick={onreset}>Reset</button>
</div>

<style>
  .params {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    border-bottom: 1px solid var(--color-default-medium);
    background: var(--color-neutral-primary);
    padding: 0.3rem 0.45rem;
  }
  .param {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--color-heading);
    font-size: 0.75rem;
  }
  .reset {
    margin-left: auto;
    height: 1.6rem;
    border: 1px solid var(--color-default-medium);
    border-radius: 0.25rem;
    background: transparent;
    padding: 0 0.5rem;
    color: var(--color-heading);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .reset:hover:not(:disabled) { background: var(--color-neutral-secondary-medium); }
  .reset:disabled { color: var(--color-body); cursor: default; }
  .param input[type='range'] {
    width: 5.5rem;
    height: auto;
    border: 0;
    padding: 0;
    accent-color: #ca8a04;
  }
  .param input:not([type='color']), .param select {
    width: 4.5rem;
    height: 1.6rem;
    border: 1px solid var(--color-default-medium);
    border-radius: 0.25rem;
    background: var(--color-neutral-primary);
    padding: 0 0.35rem;
    color: var(--color-heading);
    font-size: 0.8rem;
  }
  .param select { width: 5.6rem; }
  .swatch { position: relative; display: flex; }
  .chip {
    width: 1.05rem;
    height: 1.05rem;
    border: 1px solid rgba(17, 24, 39, 0.35);
    border-radius: 0.2rem;
  }
  .swatch input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
</style>
