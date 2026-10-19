<script lang="ts">
  import type { PlayerPostureId } from '$lib/utils/playerPostures';
  import type { ShirtPattern } from '$lib/stores/workspace';

  let {
    posture = 'standing' as PlayerPostureId,
    shirt = '#5e6ad2',
    short = '#1c1c1c',
    skin = '#e8b58c',
    pattern = 'solid' as ShirtPattern,
    patternColor = '#ffffff',
    stroke = '#111',
    scale = 1,
    uid = 'pf'
  } = $props<{
    posture?: PlayerPostureId;
    shirt?: string;
    short?: string;
    skin?: string;
    pattern?: ShirtPattern;
    patternColor?: string;
    stroke?: string;
    scale?: number;
    uid?: string;
  }>();

  /** Lighten (pct > 0) or darken (pct < 0) a hex colour. */
  function shade(hex: string, pct: number): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const f = pct / 100;
    const adj = (c: number) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
    const out = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
      .map((v) => adj(v).toString(16).padStart(2, '0'))
      .join('');
    return `#${out}`;
  }

  const sw = 0.6;
  const sock = $derived(shirt);
  const sockSh = $derived(shade(shirt, -22));
  const shirtLight = $derived(shade(shirt, 16));
  const shirtSh = $derived(shade(shirt, -20));
  const shortSh = $derived(shade(short, -25));
  const shoe = '#15171c';
  const hair = '#2e2118';
  const isGK = $derived(posture === 'gk_ready' || posture === 'gk_diving');
  const hand = $derived(isGK ? '#f1f1f1' : skin);
  const clipId = $derived(`pfig-${uid}`);
  const gradId = $derived(`pfgrad-${uid}`);

  type SymCfg = { foot: number; arm: number; knee: number; mode: 'down' | 'wide' | 'up' };
  type StrideCfg = { kick: boolean; back: boolean };
  const SYM: Partial<Record<PlayerPostureId, SymCfg>> = {
    standing: { foot: 2.5, arm: 0.5, knee: 0, mode: 'down' },
    ready: { foot: 5, arm: 2.5, knee: 1.5, mode: 'down' },
    defensive: { foot: 8, arm: 5, knee: 2.5, mode: 'wide' },
    side_step: { foot: 10, arm: 6, knee: 2, mode: 'wide' },
    jumping: { foot: 4, arm: 5, knee: 3.5, mode: 'up' },
    gk_ready: { foot: 7, arm: 7, knee: 2.5, mode: 'wide' }
  };
  const STRIDE: Partial<Record<PlayerPostureId, StrideCfg>> = {
    running: { kick: false, back: false },
    dribbling: { kick: false, back: false },
    kicking: { kick: true, back: false },
    running_back: { kick: false, back: true }
  };

  const symCfg = $derived(SYM[posture]);
  const strideCfg = $derived(STRIDE[posture]);
</script>

<g class="player-figure" transform="scale({scale})">
  <defs>
    <clipPath id={clipId}>
      <path d="M -7.5 -20 Q 0 -22.5 7.5 -20 L 6.2 -8.5 L -6.2 -8.5 Z" />
    </clipPath>
    <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color={shirtLight} />
      <stop offset="0.5" stop-color={shirt} />
      <stop offset="1" stop-color={shirtSh} />
    </linearGradient>
  </defs>

  {#snippet head(back: boolean)}
    <rect x="-1.6" y="-21.5" width="3.2" height="2.6" fill={skin} />
    <ellipse cx="0" cy="-24.4" rx="4.1" ry="4.2" fill={skin} stroke={stroke} stroke-width={sw} />
    {#if back}
      <ellipse cx="0" cy="-24.6" rx="4.1" ry="4.1" fill={hair} />
    {:else}
      <path
        d="M -4.1 -24.6 Q -4.6 -29.4 0 -29.5 Q 4.6 -29.4 4.1 -24.6 Q 2 -26.6 0 -26.4 Q -2 -26.6 -4.1 -24.6 Z"
        fill={hair}
      />
    {/if}
  {/snippet}

  {#snippet torso()}
    <path
      d="M -7.5 -20 Q 0 -22.5 7.5 -20 L 6.2 -8.5 L -6.2 -8.5 Z"
      fill="url(#{gradId})"
      stroke={stroke}
      stroke-width={sw}
    />
    {#if pattern === 'stripes'}
      <g clip-path="url(#{clipId})" pointer-events="none" opacity="0.9">
        <rect x="-4.5" y="-23" width="2.4" height="16" fill={patternColor} />
        <rect x="-0.2" y="-23" width="2.4" height="16" fill={patternColor} />
        <rect x="4.1" y="-23" width="2.4" height="16" fill={patternColor} />
      </g>
    {:else if pattern === 'hoops'}
      <g clip-path="url(#{clipId})" pointer-events="none" opacity="0.9">
        <rect x="-8" y="-19" width="16" height="2.6" fill={patternColor} />
        <rect x="-8" y="-13.5" width="16" height="2.6" fill={patternColor} />
      </g>
    {/if}
    <path d="M -2.6 -20.6 Q 0 -19 2.6 -20.6 L 1.4 -18.4 Q 0 -17.6 -1.4 -18.4 Z" fill={shirtSh} opacity="0.55" />
  {/snippet}

  {#if symCfg}
    {@const c = symCfg}
    <!-- ground shadow -->
    <ellipse cx="0" cy="10.6" rx={6 + c.foot * 0.5} ry="2.3" fill="#000" opacity="0.22" />

    <!-- legs (socks = team colour) -->
    <path d="M -3 -2 Q {-3 - c.knee} 4 {-c.foot - 0.5} 8.6" fill="none" stroke={sockSh} stroke-width="4.3" stroke-linecap="round" />
    <path d="M 3 -2 Q {3 + c.knee} 4 {c.foot + 0.5} 8.6" fill="none" stroke={sock} stroke-width="4.3" stroke-linecap="round" />
    <ellipse cx={-c.foot - 0.5} cy="10" rx="2.7" ry="1.5" fill={shoe} />
    <ellipse cx={c.foot + 0.5} cy="10" rx="2.7" ry="1.5" fill={shoe} />

    <!-- shorts -->
    <path d="M -6 -9 L 6 -9 L 4.6 -1 L 0 -2.4 L -4.6 -1 Z" fill={short} stroke={stroke} stroke-width={sw} />
    <line x1="0" y1="-8.6" x2="0" y2="-2.2" stroke={shortSh} stroke-width="0.7" />

    {@render torso()}

    <!-- sleeves + arms -->
    {#if c.mode === 'up'}
      <path d="M -6.6 -19 Q -10.5 -24 -9 -29" fill="none" stroke={skin} stroke-width="3" stroke-linecap="round" />
      <path d="M 6.6 -19 Q 10.5 -24 9 -29" fill="none" stroke={skin} stroke-width="3" stroke-linecap="round" />
      <circle cx="-9" cy="-29.4" r="1.7" fill={hand} />
      <circle cx="9" cy="-29.4" r="1.7" fill={hand} />
    {:else if c.mode === 'wide'}
      <path d="M -6.8 -19 Q {-10 - c.arm} -17 {-11 - c.arm} -12" fill="none" stroke={skin} stroke-width="3" stroke-linecap="round" />
      <path d="M 6.8 -19 Q {10 + c.arm} -17 {11 + c.arm} -12" fill="none" stroke={skin} stroke-width="3" stroke-linecap="round" />
      <circle cx={-11 - c.arm} cy="-11.6" r="1.8" fill={hand} />
      <circle cx={11 + c.arm} cy="-11.6" r="1.8" fill={hand} />
    {:else}
      <path d="M -6.8 -19 Q {-8.5 - c.arm} -13 {-7.5 - c.arm * 0.6} -6.5" fill="none" stroke={skin} stroke-width="3" stroke-linecap="round" />
      <path d="M 6.8 -19 Q {8.5 + c.arm} -13 {7.5 + c.arm * 0.6} -6.5" fill="none" stroke={skin} stroke-width="3" stroke-linecap="round" />
      <circle cx={-7.5 - c.arm * 0.6} cy="-6" r="1.6" fill={hand} />
      <circle cx={7.5 + c.arm * 0.6} cy="-6" r="1.6" fill={hand} />
    {/if}
    <!-- short sleeves -->
    <path d="M -7.5 -20 Q -9.5 -18.5 -8.5 -15.5 L -6 -16.5 Z" fill={shirtSh} />
    <path d="M 7.5 -20 Q 9.5 -18.5 8.5 -15.5 L 6 -16.5 Z" fill={shirtSh} />

    {@render head(false)}

  {:else if strideCfg}
    {@const c = strideCfg}
    <!-- ground shadow (stretched for motion) -->
    <ellipse cx="1" cy="10.6" rx="8.5" ry="2.2" fill="#000" opacity="0.22" />

    <!-- back leg -->
    <path d="M 0 -2.5 Q -3.5 3 -6 8.4" fill="none" stroke={sockSh} stroke-width="4.1" stroke-linecap="round" />
    <ellipse cx="-6" cy="9.6" rx="2.6" ry="1.5" fill={shoe} />

    <!-- front / kicking leg -->
    {#if c.kick}
      <path d="M 1.5 -2.5 Q 7 -1 12 -4.5" fill="none" stroke={sock} stroke-width="4.1" stroke-linecap="round" />
      <ellipse cx="12.3" cy="-4.8" rx="2.6" ry="1.6" fill={shoe} transform="rotate(-25 12.3 -4.8)" />
    {:else}
      <path d="M 1.5 -2.5 Q 5 4 8 8.4" fill="none" stroke={sock} stroke-width="4.1" stroke-linecap="round" />
      <ellipse cx="8" cy="9.6" rx="2.6" ry="1.5" fill={shoe} />
    {/if}

    <!-- shorts -->
    <path d="M -5.5 -9 L 6 -9 L 5 -1.5 L 0 -2.6 L -4.4 -1.5 Z" fill={short} stroke={stroke} stroke-width={sw} />

    <!-- leaning upper body -->
    <g transform="rotate(-13 0 -9)">
      <!-- trailing arm -->
      <path d="M -6.5 -18.5 Q -10 -14 -10.5 -8.5" fill="none" stroke={skin} stroke-width="2.8" stroke-linecap="round" />
      <circle cx="-10.6" cy="-8.2" r="1.6" fill={hand} />

      {@render torso()}

      <!-- leading arm -->
      <path d="M 6.5 -18.5 Q 10 -20 11 -24" fill="none" stroke={skin} stroke-width="2.8" stroke-linecap="round" />
      <circle cx="11.2" cy="-24.2" r="1.6" fill={hand} />
      <path d="M -7.5 -20 Q -9.5 -18.5 -8.5 -15.5 L -6 -16.5 Z" fill={shirtSh} />
      <path d="M 7.5 -20 Q 9.5 -18.5 8.5 -15.5 L 6 -16.5 Z" fill={shirtSh} />

      {@render head(c.back)}
    </g>

  {:else}
    <!-- gk_diving: horizontal full-stretch -->
    <ellipse cx="0" cy="11" rx="11" ry="2.2" fill="#000" opacity="0.2" />
    <g transform="rotate(-72) translate(0 -2)">
      <ellipse cx="0" cy="9.5" rx="4" ry="2" fill="#000" opacity="0.12" />
      <path d="M -2 -2 Q -4 4 -6 9" fill="none" stroke={sockSh} stroke-width="4" stroke-linecap="round" />
      <path d="M 2 -2 Q 4 4 6 9" fill="none" stroke={sock} stroke-width="4" stroke-linecap="round" />
      <ellipse cx="-6" cy="9.6" rx="2.5" ry="1.5" fill={shoe} />
      <ellipse cx="6" cy="9.6" rx="2.5" ry="1.5" fill={shoe} />
      <path d="M -5 -9 L 5 -9 L 4 -1 L 0 -2.4 L -4 -1 Z" fill={short} stroke={stroke} stroke-width={sw} />
      <path d="M -6.5 -19.5 Q 0 -22 6.5 -19.5 L 5.6 -8.5 L -5.6 -8.5 Z" fill="url(#{gradId})" stroke={stroke} stroke-width={sw} />
      <path d="M -6 -19 Q -10 -23 -11 -28" fill="none" stroke={skin} stroke-width="2.8" stroke-linecap="round" />
      <path d="M 6 -19 Q 10 -23 11 -28" fill="none" stroke={skin} stroke-width="2.8" stroke-linecap="round" />
      <circle cx="-11.2" cy="-28.2" r="1.9" fill={hand} />
      <circle cx="11.2" cy="-28.2" r="1.9" fill={hand} />
      {@render head(false)}
    </g>
  {/if}
</g>
