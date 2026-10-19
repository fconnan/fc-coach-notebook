import type { FieldTemplate } from '$lib/utils/fieldBounds';

/** Pixels per metre (display & pitch-local coords). */
export const PX_PER_M = 10;

/**
 * Pitch in horizontal layout (same as Pitch.svelte before rotation):
 * X = length (105 m), Y = width (68 m).
 */
export const PITCH = {
  lengthPx: 1050,
  widthPx: 680,
  halfLengthPx: 525,
  halfWidthPx: 340,
  bandPx: 28,
  stripeCount: 18,
  goalAreaW: 55,
  goalAreaH: 183.2,
  penAreaW: 165,
  penAreaH: 403.2,
  centerCircleR: 91.5,
  penSpotX: 110,
  cornerR: 10,
  goalDepthPx: 20,
  goalMouthPx: 73.2
} as const;

/** Official goal dimensions in metres. */
export const GOAL_M = {
  width: 7.32,
  height: 2.44,
  depth: 2,
  postRadius: 0.06
} as const;

export const PLAYER_HEIGHT_M = 1.8;
export const BALL_RADIUS_M = 0.11;
/** Default equipment handle radius in display px (matches 2D Equipment.svelte). */
export const EQUIPMENT_DEFAULT_RADIUS_PX = 14;

/** Real-world equipment dimensions in metres (at scale factor 1). */
export const EQUIPMENT_3D = {
  cone: { height: 0.3, radius: 0.15 },
  coneTall: { height: 0.5, radius: 0.1 },
  pole: { height: 1.8, radius: 0.025 },
  hurdle: { width: 1.2, height: 0.7, depth: 0.08 },
  mannequin: { height: 1.7, radius: 0.2 },
  miniGoal: { width: 1.8, height: 0.8, depth: 0.6 },
  fullGoal: { width: GOAL_M.width, height: GOAL_M.height, depth: GOAL_M.depth }
} as const;

export type LineSeg = { x1: number; y1: number; x2: number; y2: number };
export type RectDef = { x: number; y: number; w: number; h: number };
export type ArcDef = {
  cx: number;
  cy: number;
  r: number;
  startDeg: number;
  endDeg: number;
};

export function pitchDerived() {
  const { widthPx: ph, goalMouthPx, penAreaH, goalAreaH } = PITCH;
  return {
    goalY: (ph - goalMouthPx) / 2,
    penAreaY: (ph - penAreaH) / 2,
    goalAreaY: (ph - goalAreaH) / 2,
    penSpotRightX: PITCH.lengthPx - PITCH.penSpotX,
    stripeWidth: PITCH.lengthPx / PITCH.stripeCount
  };
}

export function lightenGrassColor(hex: string, amt = 18): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return '#32753f';
  const r = Math.min(255, parseInt(m[1], 16) + amt);
  const g = Math.min(255, parseInt(m[2], 16) + amt);
  const b = Math.min(255, parseInt(m[3], 16) + amt);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Grass rect including run-off band (pitch-local px). */
export function grassBackgroundRect(): RectDef {
  const b = PITCH.bandPx;
  return {
    x: -b,
    y: -b,
    w: PITCH.lengthPx + b * 2,
    h: PITCH.widthPx + b * 2
  };
}

/** Mowing stripes along pitch length (pitch-local px). */
export function buildStripeRects(): RectDef[] {
  const d = pitchDerived();
  const rects: RectDef[] = [];
  for (let i = 0; i < PITCH.stripeCount; i++) {
    if (i % 2 !== 1) continue;
    rects.push({
      x: i * d.stripeWidth,
      y: 0,
      w: d.stripeWidth,
      h: PITCH.widthPx
    });
  }
  return rects;
}

function clipRectToLengthRange(rect: RectDef, minX: number, maxX: number): RectDef | null {
  const x1 = Math.max(rect.x, minX);
  const x2 = Math.min(rect.x + rect.w, maxX);
  if (x2 <= x1) return null;
  return { x: x1, y: rect.y, w: x2 - x1, h: rect.h };
}

/** Stripe rects visible for the active field template (same data as 2D). */
export function buildVisibleStripeRects(template: FieldTemplate): RectDef[] {
  const { min, max } = visibleLengthRange(template);
  return buildStripeRects()
    .map((r) => clipRectToLengthRange(r, min, max))
    .filter(Boolean) as RectDef[];
}

/** Stripe rect (pitch-local px) → ground placement on world XZ. */
export function stripeRectToWorld(rect: RectDef): { cx: number; cz: number; w: number; d: number } {
  return {
    cx: (rect.y + rect.h / 2 - PITCH.halfWidthPx) / PX_PER_M,
    cz: (rect.x + rect.w / 2 - PITCH.halfLengthPx) / PX_PER_M,
    w: rect.h / PX_PER_M,
    d: rect.w / PX_PER_M
  };
}

export function equipmentScaleFactor(radiusPx?: number): number {
  return (radiusPx ?? EQUIPMENT_DEFAULT_RADIUS_PX) / EQUIPMENT_DEFAULT_RADIUS_PX;
}

export function halfFieldClip(template: FieldTemplate) {
  const { lengthPx: pw, widthPx: ph, halfLengthPx: hw, bandPx: band } = PITCH;
  if (template === 'Demi') {
    return {
      grass: { x: -band, y: -band, w: hw + band * 2, h: ph + band * 2 },
      playing: { x: -9999, y: -9999, w: hw + 9999, h: 19999 }
    };
  }
  if (template === 'DemiBas') {
    return {
      grass: { x: hw - band, y: -band, w: pw - hw + band * 2, h: ph + band * 2 },
      playing: { x: hw, y: -9999, w: 19999, h: 19999 }
    };
  }
  return null;
}

function visibleLengthRange(template: FieldTemplate): { min: number; max: number } {
  const hw = PITCH.halfLengthPx;
  if (template === 'Demi') return { min: 0, max: hw };
  if (template === 'DemiBas') return { min: hw, max: PITCH.lengthPx };
  return { min: 0, max: PITCH.lengthPx };
}

/** Visible grass footprint (half-field + run-off band), matching Pitch.svelte clip. */
export function visibleGrassRect(template: FieldTemplate): RectDef {
  const half = halfFieldClip(template);
  if (half) return half.grass;
  return grassBackgroundRect();
}

/** Penalty spots visible for the template (excludes centre spot, like 2D). */
export function buildVisibleSpotMarkers(template: FieldTemplate): { cx: number; cy: number }[] {
  const { min, max } = visibleLengthRange(template);
  return buildSpotMarkers().filter((s, i) => i > 0 && s.cx >= min && s.cx <= max);
}

function appendArcSegmentsClipped(
  pts: number[],
  arc: ArcDef,
  minX: number,
  maxX: number,
  y: number
) {
  const segCount = arc.endDeg - arc.startDeg >= 359 ? 64 : 24;
  const samples = sampleArc(arc, segCount);
  let prev: [number, number, number] | null = null;
  for (const [px, py] of samples) {
    if (px < minX || px > maxX) {
      prev = null;
      continue;
    }
    const w = pitchPxToWorld(px, py, y);
    if (prev) pts.push(prev[0], prev[1], prev[2], w[0], w[1], w[2]);
    prev = w;
  }
}

/** Touchline / halfway outline segments for the active template. */
export function buildOutlineSegments(template: FieldTemplate): LineSeg[] {
  const { lengthPx: pw, widthPx: ph, halfLengthPx: hw } = PITCH;
  if (template === 'Demi') {
    return [
      { x1: 0, y1: 0, x2: hw, y2: 0 },
      { x1: hw, y1: 0, x2: hw, y2: ph },
      { x1: hw, y1: ph, x2: 0, y2: ph },
      { x1: 0, y1: ph, x2: 0, y2: 0 }
    ];
  }
  if (template === 'DemiBas') {
    return [
      { x1: hw, y1: 0, x2: pw, y2: 0 },
      { x1: pw, y1: 0, x2: pw, y2: ph },
      { x1: pw, y1: ph, x2: hw, y2: ph },
      { x1: hw, y1: ph, x2: hw, y2: 0 }
    ];
  }
  return [
    { x1: 0, y1: 0, x2: pw, y2: 0 },
    { x1: pw, y1: 0, x2: pw, y2: ph },
    { x1: pw, y1: ph, x2: 0, y2: ph },
    { x1: 0, y1: ph, x2: 0, y2: 0 },
    { x1: hw, y1: 0, x2: hw, y2: ph }
  ];
}

function rectEdges(x: number, y: number, w: number, h: number): LineSeg[] {
  return [
    { x1: x, y1: y, x2: x + w, y2: y },
    { x1: x + w, y1: y, x2: x + w, y2: y + h },
    { x1: x + w, y1: y + h, x2: x, y2: y + h },
    { x1: x, y1: y + h, x2: x, y2: y }
  ];
}

/** Interior markings (penalty areas, goal areas, etc.). */
export function buildMarkingSegments(template: FieldTemplate): LineSeg[] {
  const { lengthPx: pw, halfLengthPx: hw, halfWidthPx: hh, penAreaW, goalAreaW } = PITCH;
  const d = pitchDerived();
  const segs: LineSeg[] = [];

  segs.push(
    ...rectEdges(0, d.penAreaY, penAreaW, PITCH.penAreaH),
    ...rectEdges(0, d.goalAreaY, goalAreaW, PITCH.goalAreaH),
    ...rectEdges(pw - penAreaW, d.penAreaY, penAreaW, PITCH.penAreaH),
    ...rectEdges(pw - goalAreaW, d.goalAreaY, goalAreaW, PITCH.goalAreaH)
  );

  const range = visibleLengthRange(template);
  if (range.min <= hw && range.max >= hw) {
    // halfway line already in outline for full pitch
  }

  return segs;
}

export function buildCornerArcs(): ArcDef[] {
  const { lengthPx: pw, widthPx: ph, cornerR: r } = PITCH;
  return [
    { cx: 0, cy: r, r, startDeg: 180, endDeg: 270 },
    { cx: pw - r, cy: 0, r, startDeg: 270, endDeg: 360 },
    { cx: pw, cy: ph - r, r, startDeg: 0, endDeg: 90 },
    { cx: r, cy: ph, r, startDeg: 90, endDeg: 180 }
  ];
}

export function buildCenterCircle(): ArcDef {
  return {
    cx: PITCH.halfLengthPx,
    cy: PITCH.halfWidthPx,
    r: PITCH.centerCircleR,
    startDeg: 0,
    endDeg: 360
  };
}

/** Penalty-area arc (outside the box). */
export function buildPenaltyArcs(): ArcDef[] {
  const { lengthPx: pw, halfWidthPx: hh, centerCircleR: r, penSpotX } = PITCH;
  const d = pitchDerived();
  return [
    { cx: penSpotX, cy: hh, r, startDeg: -53, endDeg: 53 },
    { cx: d.penSpotRightX, cy: hh, r, startDeg: 127, endDeg: 233 }
  ];
}

export function buildSpotMarkers(): { cx: number; cy: number }[] {
  const { halfLengthPx: hw, halfWidthPx: hh, penSpotX } = PITCH;
  const d = pitchDerived();
  return [
    { cx: hw, cy: hh },
    { cx: penSpotX, cy: hh },
    { cx: d.penSpotRightX, cy: hh }
  ];
}

/** Goal mouth rectangles in pitch-local px (for 2D). */
export function buildGoalRects(): { side: 'left' | 'right'; rect: RectDef }[] {
  const { lengthPx: pw, goalDepthPx: gd, goalMouthPx: gh } = PITCH;
  const gy = pitchDerived().goalY;
  return [
    { side: 'left', rect: { x: -gd, y: gy, w: gd, h: gh } },
    { side: 'right', rect: { x: pw, y: gy, w: gd, h: gh } }
  ];
}

export type Goal3DSpec = {
  side: 'left' | 'right';
  /** World-space centre of the goal mouth line on the pitch edge. */
  mouthCenter: { x: number; y: number; z: number };
  /** Unit vector from pitch into the goal (into the net). */
  intoGoal: { x: number; z: number };
};

export function buildGoal3DSpecs(template: FieldTemplate): Goal3DSpec[] {
  const halfLenM = PITCH.lengthPx / PX_PER_M / 2;
  const goals: Goal3DSpec[] = [
    {
      side: 'left',
      mouthCenter: { x: 0, y: 0, z: -halfLenM },
      intoGoal: { x: 0, z: -1 }
    },
    {
      side: 'right',
      mouthCenter: { x: 0, y: 0, z: halfLenM },
      intoGoal: { x: 0, z: 1 }
    }
  ];
  if (template === 'Demi') return [goals[0]];
  if (template === 'DemiBas') return [goals[1]];
  return goals;
}

/** Pitch-local px → world metres (Y up, ground XZ). */
export function pitchPxToWorld(px: number, py: number, y = 0.02): [number, number, number] {
  return [
    (py - PITCH.halfWidthPx) / PX_PER_M,
    y,
    (px - PITCH.halfLengthPx) / PX_PER_M
  ];
}

export function sampleArc(arc: ArcDef, segments = 20): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const deg = arc.startDeg + ((arc.endDeg - arc.startDeg) * i) / segments;
    const rad = (deg * Math.PI) / 180;
    pts.push([arc.cx + Math.cos(rad) * arc.r, arc.cy + Math.sin(rad) * arc.r]);
  }
  return pts;
}

function clipSegmentToXRange(seg: LineSeg, minX: number, maxX: number): LineSeg | null {
  let { x1, y1, x2, y2 } = seg;
  if (x1 < minX && x2 < minX) return null;
  if (x1 > maxX && x2 > maxX) return null;
  if (x1 < minX) {
    const t = (minX - x1) / (x2 - x1);
    y1 = y1 + t * (y2 - y1);
    x1 = minX;
  } else if (x2 < minX) {
    const t = (minX - x2) / (x1 - x2);
    y2 = y2 + t * (y1 - y2);
    x2 = minX;
  }
  if (x1 > maxX) {
    const t = (maxX - x1) / (x2 - x1);
    y1 = y1 + t * (y2 - y1);
    x1 = maxX;
  } else if (x2 > maxX) {
    const t = (maxX - x2) / (x1 - x2);
    y2 = y2 + t * (y1 - y2);
    x2 = maxX;
  }
  return { x1, y1, x2, y2 };
}

function filterSegmentsForTemplate(segs: LineSeg[], template: FieldTemplate): LineSeg[] {
  const { min, max } = visibleLengthRange(template);
  const out: LineSeg[] = [];
  for (const s of segs) {
    const c = clipSegmentToXRange(s, min, max);
    if (c) out.push(c);
  }
  return out;
}

function filterArcForTemplate(arc: ArcDef, template: FieldTemplate): ArcDef | null {
  const { min, max } = visibleLengthRange(template);
  const cx = arc.cx;
  if (arc.endDeg - arc.startDeg >= 359) {
    if (cx < min - arc.r || cx > max + arc.r) return null;
    return arc;
  }
  const pts = sampleArc(arc, 24);
  const visible = pts.some(([x]) => x >= min && x <= max);
  return visible ? arc : null;
}

export function buildAllLineSegments(template: FieldTemplate): LineSeg[] {
  return filterSegmentsForTemplate(
    [...buildOutlineSegments(template), ...buildMarkingSegments(template)],
    template
  );
}

export function buildAllArcs(template: FieldTemplate): ArcDef[] {
  const arcs = [...buildCornerArcs(), buildCenterCircle(), ...buildPenaltyArcs()];
  return arcs.map((a) => filterArcForTemplate(a, template)).filter(Boolean) as ArcDef[];
}

/** Merge segments + arcs into one BufferGeometry positions array for Three.js LineSegments. */
export function buildWorldLinePositions(template: FieldTemplate, y = 0.03): Float32Array {
  const { min, max } = visibleLengthRange(template);
  const pts: number[] = [];
  for (const s of buildAllLineSegments(template)) {
    const a = pitchPxToWorld(s.x1, s.y1, y);
    const b = pitchPxToWorld(s.x2, s.y2, y);
    pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  for (const arc of [...buildCornerArcs(), buildCenterCircle(), ...buildPenaltyArcs()]) {
    appendArcSegmentsClipped(pts, arc, min, max, y);
  }
  return new Float32Array(pts);
}

/** Penalty arc clipped to outside the box (approximate visible arc). */
export function buildPenaltyArcWorldPositions(template: FieldTemplate, y = 0.03): Float32Array {
  const { penAreaW, centerCircleR: r, penSpotX, lengthPx: pw } = PITCH;
  const d = pitchDerived();
  const pts: number[] = [];
  const specs = [
    { cx: penSpotX, minX: penAreaW },
    { cx: d.penSpotRightX, maxX: pw - penAreaW }
  ];
  for (const spec of specs) {
    let prev: [number, number, number] | null = null;
    for (let deg = -60; deg <= 60; deg += 3) {
      const rad = (deg * Math.PI) / 180;
      const px = spec.cx + Math.cos(rad) * r;
      const py = PITCH.halfWidthPx + Math.sin(rad) * r;
      if (spec.minX !== undefined && px < spec.minX) continue;
      if (spec.maxX !== undefined && px > spec.maxX) continue;
      const range = visibleLengthRange(template);
      if (px < range.min || px > range.max) continue;
      const w = pitchPxToWorld(px, py, y);
      if (prev) pts.push(prev[0], prev[1], prev[2], w[0], w[1], w[2]);
      prev = w;
    }
  }
  return new Float32Array(pts);
}

export function arcToSvgPath(arc: ArcDef): string {
  const pts = sampleArc(arc, arc.endDeg - arc.startDeg >= 359 ? 64 : 20);
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}

export function cornerArcToSvgPath(arc: ArcDef): string {
  const pts = sampleArc(arc, 12);
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}
