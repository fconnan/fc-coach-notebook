/** Visible run-off around the playing area (matches CanvasArea viewBox margin). */
export const FIELD_MARGIN = 55;

export const PITCH_W = 680;
export const PITCH_H_FULL = 1050;
export const PITCH_H_HALF = 525;

export type FieldTemplate = 'Complet' | 'Demi' | 'DemiBas';

/** Playing-area box in SVG display coordinates (centre + size). */
export function contentBox(template: FieldTemplate) {
  if (template === 'Demi') return { cx: 340, cy: 262.5, W: PITCH_W, H: PITCH_H_HALF };
  if (template === 'DemiBas') return { cx: 340, cy: 787.5, W: PITCH_W, H: PITCH_H_HALF };
  return { cx: 340, cy: 525, W: PITCH_W, H: PITCH_H_FULL };
}

/** Clip rect (display coords) for the visible field + margin. */
export function fieldClipRect(template: FieldTemplate, margin = FIELD_MARGIN) {
  const b = contentBox(template);
  return {
    x: b.cx - b.W / 2 - margin,
    y: b.cy - b.H / 2 - margin,
    w: b.W + margin * 2,
    h: b.H + margin * 2
  };
}

export function pitchCenter(template: FieldTemplate) {
  const b = contentBox(template);
  return { x: b.cx, y: b.cy };
}

/** Base viewBox for export (legacy layout, margin included). */
export function exportViewBox(template: FieldTemplate) {
  const clip = fieldClipRect(template);
  return { x: clip.x, y: clip.y, w: clip.w, h: clip.h };
}
