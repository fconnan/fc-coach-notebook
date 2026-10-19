<script lang="ts">
  let { template = 'Complet', orientation = 'horizontal', showStripes = true } = $props<{ 
    template: 'Complet' | 'Demi' | 'DemiBas', 
    orientation: 'horizontal' | 'vertical',
    showStripes?: boolean
  }>();
  
  // Dimensions 1m = 10px
  // Official Pitch: 105m x 68m -> 1050 x 680
  const pw = 1050; // pitch width
  const ph = 680;  // pitch height
  
  const hw = pw / 2; // half width
  const hh = ph / 2; // half height
  
  const goalAreaW = 55; // 5.5m
  const goalAreaH = 183.2; // 18.32m
  const goalAreaY = (ph - goalAreaH) / 2;
  
  const penAreaW = 165; // 16.5m
  const penAreaH = 403.2; // 40.32m
  const penAreaY = (ph - penAreaH) / 2;
  
  const centerCircleR = 91.5; // 9.15m
  const penSpotX = 110; // 11m
  const penSpotRightX = pw - 110;

  // Goals
  const goalW = 20; // 2m (depth)
  const goalH = 73.2; // 7.32m (official width)
  const goalY = (ph - goalH) / 2;

  // Corner arc
  const cornerR = 10; // 1m

  // Vertical Centering:
  // We ALWAYS use the Full Pitch transformation now to enable "zoom" behavior.
  // Rotation of horizontal (1050x680) around its center (525, 340) stays at center.
  // Translate to reach target (340, 525): dx = -185, dy = 185.
  const dx = -185;
  const dy = 185;

  // Stripe configuration
  const stripeCount = 18;
  const stripeWidth = pw / stripeCount;
</script>

<!-- We always render the full pitch lines to ensure 1:1 coordinate parity for zoom -->
<g class="pitch-container" 
  pointer-events="none"
  transform="
    {orientation === 'vertical' 
      ? `translate(${dx}, ${dy}) rotate(90, ${hw}, ${hh})` 
      : ''}
  "
>
  <!-- Grass -->
  <rect width={pw} height={ph} fill="#2b6b39" fill-opacity="1" />
  
  {#if showStripes}
    <g class="stripes">
      {#each Array(stripeCount) as _, i}
        {#if i % 2 === 1}
          <rect x={i * stripeWidth} y="0" width={stripeWidth} height={ph} fill="#32753f" />
        {/if}
      {/each}
    </g>
  {/if}
  
  <!-- Main border -->
  <rect width={pw} height={ph} fill="none" class="line" />

  <!-- Halfway line -->
  <line x1={hw} y1="0" x2={hw} y2={ph} class="line" />
  
  <!-- Center circle and spot -->
  <circle cx={hw} cy={hh} r={centerCircleR} fill="none" class="line" />
  <circle cx={hw} cy={hh} r="3" fill="#ffffff" />

  <!-- Corner Arcs -->
  <path d="M 0,{cornerR} A {cornerR},{cornerR} 0 0 0 {cornerR},0" fill="none" class="line" />
  <path d="M {pw-cornerR},0 A {cornerR},{cornerR} 0 0 0 {pw},{cornerR}" fill="none" class="line" />
  <path d="M {pw},{ph-cornerR} A {cornerR},{cornerR} 0 0 0 {pw-cornerR},{ph}" fill="none" class="line" />
  <path d="M {cornerR},{ph} A {cornerR},{cornerR} 0 0 0 0,{ph-cornerR}" fill="none" class="line" />

  <!-- Left Goal -->
  <rect x={-goalW} y={goalY} width={goalW} height={goalH} fill="none" class="line" stroke-opacity="0.5" />
  <!-- Left Penalty Area -->
  <rect x="0" y={penAreaY} width={penAreaW} height={penAreaH} fill="none" class="line" />
  <rect x="0" y={goalAreaY} width={goalAreaW} height={goalAreaH} fill="none" class="line" />
  <circle cx={penSpotX} cy={hh} r="3" fill="#ffffff" />
  <g>
    <clipPath id="left-pen-clip">
      <rect x={penAreaW} y="0" width={pw} height={ph} />
    </clipPath>
    <circle cx={penSpotX} cy={hh} r={centerCircleR} fill="none" class="line" clip-path="url(#left-pen-clip)" />
  </g>

  <!-- Right Goal -->
  <rect x={pw} y={goalY} width={goalW} height={goalH} fill="none" class="line" stroke-opacity="0.5" />
  <!-- Right Penalty Area -->
  <rect x={pw - penAreaW} y={penAreaY} width={penAreaW} height={penAreaH} fill="none" class="line" />
  <rect x={pw - goalAreaW} y={goalAreaY} width={goalAreaW} height={goalAreaH} fill="none" class="line" />
  <circle cx={penSpotRightX} cy={hh} r="3" fill="#ffffff" />
  <g>
    <clipPath id="right-pen-clip">
      <rect x="0" y="0" width={pw - penAreaW} height={ph} />
    </clipPath>
    <circle cx={penSpotRightX} cy={hh} r={centerCircleR} fill="none" class="line" clip-path="url(#right-pen-clip)" />
  </g>
</g>

<style>
  .line {
    stroke: #ffffff;
    stroke-width: 2.5;
    stroke-opacity: 0.9;
  }
</style>
