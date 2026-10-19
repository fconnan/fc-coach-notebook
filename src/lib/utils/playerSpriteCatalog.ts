import { resolveYaw, YAW_STEPS } from '$lib/utils/resolveYaw';

export type Morphology = 'man' | 'woman' | 'child';

export interface SheetLayout {
  /** Horizontal strip: frame i at x = i * cell.w */
  layout: 'row';
  cell: { w: number; h: number };
}

export interface PoseManifest {
  standingHeightPx: number;
  /** Default cell size for pose sheets. */
  sheet: SheetLayout;
  anchor: { x: number; y: number };
  /** Canonical yaw order for full sheets (15° steps). */
  yaws: number[];
  postures: PoseEntry[];
}

export interface PoseEntry {
  id: string;
  label: string;
  tags: string[];
  /**
   * Yaws present in the sheet, left → right, for each morphology.
   * File is always `poses/{morph}/{id}.png`.
   */
  yaws: Partial<Record<Morphology, number[]>>;
}

export interface EquipmentManifest {
  sheet: SheetLayout;
  yaws: number[];
  items: EquipmentEntry[];
}

export interface EquipmentEntry {
  id: string;
  label: string;
  oriented: boolean;
  /** Yaws in sheet left → right. File: `equipment/{id}.png`. */
  yaws: number[];
  anchor?: { x: number; y: number };
  recolor?: 'ball';
}

export interface ResolvedSprite {
  /** Sheet URL (not a single frame). */
  url: string;
  flip: boolean;
  yaw: number;
  frameIndex: number;
  cellW: number;
  cellH: number;
  postureId: string;
  meta: PoseEntry;
  standingHeightPx: number;
  canvasW: number;
  canvasH: number;
  anchorX: number;
  anchorY: number;
}

export interface ResolvedEquipment {
  url: string;
  flip: boolean;
  yaw: number;
  frameIndex: number;
  cellW: number;
  cellH: number;
  equipmentId: string;
  meta: EquipmentEntry;
  canvasW: number;
  canvasH: number;
}

let poseManifest: PoseManifest | null = null;
let equipManifest: EquipmentManifest | null = null;
let poseLoad: Promise<PoseManifest> | null = null;
let equipLoad: Promise<EquipmentManifest> | null = null;

const POSE_URL = '/players/poses/manifest.json';
const EQUIP_URL = '/players/equipment/manifest.json';

const ANIM_TO_SPRITE: Record<string, string> = {
  idle: 'idle',
  standing: 'idle',
  ready: 'idle',
  run: 'run',
  running: 'run',
  run_back: 'run',
  walk: 'run',
  kick: 'kick',
  kicking: 'kick',
  jump: 'idle',
  jumping: 'idle',
  header: 'idle',
  side_step: 'run',
  gk_ready: 'idle',
  gk_dive: 'idle',
  dribbling: 'run'
};

export const EQUIPMENT_SPRITE_IDS: Record<string, string> = {
  cone: 'cone',
  coneTall: 'cone',
  ladder: 'ladder',
  hurdle: 'hurdle',
  ball: 'ball'
};

export async function loadPoseManifest(): Promise<PoseManifest> {
  if (poseManifest) return poseManifest;
  if (!poseLoad) {
    poseLoad = fetch(POSE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`pose manifest ${r.status}`);
        return r.json();
      })
      .then((m: PoseManifest) => {
        poseManifest = m;
        return m;
      })
      .catch((e) => {
        poseLoad = null;
        throw e;
      });
  }
  return poseLoad;
}

export async function loadEquipmentManifest(): Promise<EquipmentManifest> {
  if (equipManifest) return equipManifest;
  if (!equipLoad) {
    equipLoad = fetch(EQUIP_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`equipment manifest ${r.status}`);
        return r.json();
      })
      .then((m: EquipmentManifest) => {
        equipManifest = m;
        return m;
      })
      .catch((e) => {
        equipLoad = null;
        throw e;
      });
  }
  return equipLoad;
}

export function normalizePostureId(postureOrAnim: string | undefined): string {
  if (!postureOrAnim) return 'idle';
  return ANIM_TO_SPRITE[postureOrAnim] ?? postureOrAnim;
}

/** One sheet per posture: `poses/{morph}/{id}.png` */
export function spriteSheetUrl(morphology: Morphology, postureId: string): string {
  return `/players/poses/${morphology}/${postureId}.png`;
}

export function equipmentSheetUrl(equipmentId: string): string {
  return `/players/equipment/${equipmentId}.png`;
}

export function listPostures(manifest: PoseManifest, tags?: string[]): PoseEntry[] {
  if (!tags?.length) return manifest.postures;
  return manifest.postures.filter((p) => tags.some((t) => p.tags.includes(t)));
}

export function resolveSpriteSync(
  manifest: PoseManifest,
  opts: { morphology: Morphology; postureId: string; angle: number }
): ResolvedSprite | null {
  const postureId = normalizePostureId(opts.postureId);
  const meta = manifest.postures.find((p) => p.id === postureId);
  if (!meta) return null;
  const available = meta.yaws[opts.morphology] ?? meta.yaws.man ?? [0];
  if (!available.length) return null;
  const { yaw, flip, frameIndex } = resolveYaw(opts.angle, available);
  const cellW = manifest.sheet.cell.w;
  const cellH = manifest.sheet.cell.h;
  return {
    url: spriteSheetUrl(opts.morphology, postureId),
    flip,
    yaw,
    frameIndex,
    cellW,
    cellH,
    postureId,
    meta,
    standingHeightPx: manifest.standingHeightPx,
    canvasW: cellW,
    canvasH: cellH,
    anchorX: manifest.anchor.x * cellW,
    anchorY: manifest.anchor.y * cellH
  };
}

export async function resolveSprite(opts: {
  morphology: Morphology;
  postureId: string;
  angle: number;
}): Promise<ResolvedSprite | null> {
  const manifest = await loadPoseManifest();
  return resolveSpriteSync(manifest, opts);
}

export function resolveEquipmentSync(
  manifest: EquipmentManifest,
  opts: { equipmentId: string; angle: number }
): ResolvedEquipment | null {
  const meta = manifest.items.find((i) => i.id === opts.equipmentId);
  if (!meta) return null;
  const available = meta.oriented ? meta.yaws : [meta.yaws[0] ?? 0];
  const resolved = meta.oriented
    ? resolveYaw(opts.angle, available)
    : { yaw: available[0] ?? 0, flip: false, frameIndex: 0 };
  const cellW = manifest.sheet.cell.w;
  const cellH = manifest.sheet.cell.h;
  return {
    url: equipmentSheetUrl(opts.equipmentId),
    flip: meta.oriented ? resolved.flip : false,
    yaw: resolved.yaw,
    frameIndex: resolved.frameIndex,
    cellW,
    cellH,
    equipmentId: opts.equipmentId,
    meta,
    canvasW: cellW,
    canvasH: cellH
  };
}

export async function resolveEquipment(opts: {
  equipmentId: string;
  angle: number;
}): Promise<ResolvedEquipment | null> {
  const manifest = await loadEquipmentManifest();
  return resolveEquipmentSync(manifest, opts);
}

export function getPoseManifestSync(): PoseManifest | null {
  return poseManifest;
}

export { YAW_STEPS };
