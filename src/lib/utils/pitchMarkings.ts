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

/**
 * Ordered corner points of the touchline border for the template (closed loop).
 * Rendered as a single path so miter joins finish the corners cleanly.
 */
export function buildOutlinePolygon(template: FieldTemplate): { x: number; y: number }[] {
  const { lengthPx: pw, widthPx: ph, halfLengthPx: hw } = PITCH;
  if (template === 'Demi') {
    return [{ x: 0, y: 0 }, { x: hw, y: 0 }, { x: hw, y: ph }, { x: 0, y: ph }];
  }
  if (template === 'DemiBas') {
    return [{ x: hw, y: 0 }, { x: pw, y: 0 }, { x: pw, y: ph }, { x: hw, y: ph }];
  }
  return [{ x: 0, y: 0 }, { x: pw, y: 0 }, { x: pw, y: ph }, { x: 0, y: ph }];
}

/** Closed SVG path for the touchline border. */
export function outlinePolygonPath(template: FieldTemplate): string {
  const pts = buildOutlinePolygon(template);
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
}

/** Halfway line (full pitch only; half templates have it as a border edge). */
export function buildHalfwayLine(template: FieldTemplate): LineSeg | null {
  if (template !== 'Complet') return null;
  const { widthPx: ph, halfLengthPx: hw } = PITCH;
  return { x1: hw, y1: 0, x2: hw, y2: ph };
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
  // Quarter circles centred on each pitch corner, curving into the field.
  return [
    { cx: 0, cy: 0, r, startDeg: 0, endDeg: 90 },       // top-left
    { cx: pw, cy: 0, r, startDeg: 90, endDeg: 180 },    // top-right
    { cx: pw, cy: ph, r, startDeg: 180, endDeg: 270 },  // bottom-right
    { cx: 0, cy: ph, r, startDeg: 270, endDeg: 360 }    // bottom-left
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

export function arcToSvgPath(arc: ArcDef): string {
  const pts = sampleArc(arc, arc.endDeg - arc.startDeg >= 359 ? 64 : 20);
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}

export function cornerArcToSvgPath(arc: ArcDef): string {
  const pts = sampleArc(arc, 12);
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}
