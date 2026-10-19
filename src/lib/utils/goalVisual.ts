/** Default semi-transparency for goal net faces (page + equipment). */
export const DEFAULT_GOAL_NET_OPACITY = 0.25;

export type LineSeg = { x1: number; y1: number; x2: number; y2: number };
export type BandRect = { x: number; y: number; w: number; h: number };

/** 2D front-view layout for draggable goal equipment (mini / full). */
export type GoalEquipmentFrontLayout = {
  hw: number;
  frontY: number;
  depth: number;
  backY: number;
  footY: number;
  box: { w: number; h: number };
  strokeWidth: number;
};

export const GOAL_EQUIPMENT_2D: Record<'miniGoal' | 'fullGoal', GoalEquipmentFrontLayout> = {
  miniGoal: {
    hw: 18,
    depth: 12,
    frontY: -6,
    backY: 6,
    footY: 6,
    box: { w: 36, h: 8 },
    strokeWidth: 3
  },
  fullGoal: {
    hw: 36,
    depth: 20,
    frontY: -10,
    backY: 10,
    footY: 10,
    box: { w: 73, h: 12 },
    strokeWidth: 3
  }
};

export function goalEquipmentFrontLayout(kind: 'miniGoal' | 'fullGoal'): GoalEquipmentFrontLayout {
  return GOAL_EQUIPMENT_2D[kind];
}

/** Post rails in plan view (mouth open toward pitch — no back bar, no mouth line). */
export function goalPlanFrameSegments(
  side: 'left' | 'right',
  rect: { x: number; y: number; w: number; h: number }
): LineSeg[] {
  const { x, y, w, h } = rect;
  if (side === 'left') {
    const mouthX = x + w;
    const backX = x;
    return [
      { x1: mouthX, y1: y, x2: backX, y2: y },
      { x1: mouthX, y1: y + h, x2: backX, y2: y + h }
    ];
  }
  const mouthX = x;
  const backX = x + w;
  return [
    { x1: mouthX, y1: y, x2: backX, y2: y },
    { x1: mouthX, y1: y + h, x2: backX, y2: y + h }
  ];
}

/** Net face bands in plan view (back, sides, mouth-edge “top”). */
export function goalPlanNetBands(
  side: 'left' | 'right',
  rect: { x: number; y: number; w: number; h: number }
): BandRect[] {
  const { x, y, w, h } = rect;
  const mouthX = side === 'left' ? x + w : x;
  const backX = side === 'left' ? x : x + w;
  const depth = Math.abs(backX - mouthX);
  const t = Math.max(1.5, Math.min(depth, h) * 0.12);
  const x0 = Math.min(mouthX, backX);

  return [
    side === 'left'
      ? { x: backX, y, w: t, h }
      : { x: backX - t, y, w: t, h },
    { x: x0, y, w: depth, h: t },
    { x: x0, y: y + h - t, w: depth, h: t },
    side === 'left'
      ? { x: mouthX - t, y, w: t, h }
      : { x: mouthX, y, w: t, h }
  ];
}

/** U-shaped post frame in front view (no bottom bar). */
export function goalFrontFramePath(hw: number, frontY: number, backY: number): string {
  return `M ${-hw} ${backY} L ${-hw} ${frontY} L ${hw} ${frontY} L ${hw} ${backY}`;
}

/** Net face bands in front view (top, left, right, back). */
export function goalFrontNetBands(hw: number, frontY: number, depth: number): BandRect[] {
  const t = Math.max(2, depth * 0.15);
  return [
    { x: -hw, y: frontY, w: hw * 2, h: t },
    { x: -hw, y: frontY + depth - t, w: hw * 2, h: t },
    { x: -hw, y: frontY, w: t, h: depth },
    { x: hw - t, y: frontY, w: t, h: depth }
  ];
}
