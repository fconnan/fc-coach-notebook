<script lang="ts">
  let { template = 'Complet', orientation = 'horizontal' } = $props<{ template: 'Complet' | 'Demi', orientation: 'horizontal' | 'vertical' }>();
  
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

  // Centering translations for the 1250x880 canvas
  const txFull = 100;
  const tyFull = 100;
  
  const txDemi = (1250 - hw) / 2; 
  const tyDemi = 100;
</script>

<!-- If orientation is vertical, rotate 90deg -->
<g class="pitch-container" 
  transform="
    {orientation === 'vertical' ? `rotate(90, ${txFull + (template === 'Complet' ? pw/2 : hw/2)}, ${tyFull + ph/2})` : ''}
    translate({template === 'Complet' ? txFull : txDemi}, {tyFull})
  "
>
  <!-- Grass -->
  <rect width={template === 'Complet' ? pw : hw} height={ph} fill="#2b6b39" fill-opacity="1" />
  
  <!-- Main border -->
  <rect width={template === 'Complet' ? pw : hw} height={ph} fill="none" class="line" />

  {#if template === 'Complet'}
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

  {:else}
    <!-- Demi terrain (Left side focus) -->
    <!-- Center circle arc -->
    <g>
      <clipPath id="half-center-clip">
        <rect x="0" y="0" width={hw} height={ph} />
      </clipPath>
      <circle cx={hw} cy={hh} r={centerCircleR} fill="none" class="line" clip-path="url(#half-center-clip)" />
      <circle cx={hw} cy={hh} r="3" fill="#ffffff" />
    </g>

    <!-- Corner Arcs -->
    <path d="M 0,{cornerR} A {cornerR},{cornerR} 0 0 0 {cornerR},0" fill="none" class="line" />
    <path d="M {cornerR},{ph} A {cornerR},{cornerR} 0 0 0 0,{ph-cornerR}" fill="none" class="line" />

    <!-- Left Goal -->
    <rect x={-goalW} y={goalY} width={goalW} height={goalH} fill="none" class="line" stroke-opacity="0.5" />
    <!-- Penalty Area -->
    <rect x="0" y={penAreaY} width={penAreaW} height={penAreaH} fill="none" class="line" />
    <rect x="0" y={goalAreaY} width={goalAreaW} height={goalAreaH} fill="none" class="line" />
    <circle cx={penSpotX} cy={hh} r="3" fill="#ffffff" />
    
    <g>
      <clipPath id="left-pen-clip-demi">
        <rect x={penAreaW} y="0" width={hw} height={ph} />
      </clipPath>
      <circle cx={penSpotX} cy={hh} r={centerCircleR} fill="none" class="line" clip-path="url(#left-pen-clip-demi)" />
    </g>
  {/if}
</g>

<style>
  .line {
    stroke: #ffffff;
    stroke-width: 2.5;
    stroke-opacity: 0.9;
  }
</style>
