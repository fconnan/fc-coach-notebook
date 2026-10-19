export type RecolorChannel = 'shirt' | 'short' | 'sock' | 'ball';

export interface SheetCrop {
  /** 0-based frame index in a horizontal strip. */
  frameIndex: number;
  cellW: number;
  cellH: number;
}

export interface TintOptions {
  /** Absolute or site-relative URL of the source PNG (single frame or sheet). */
  url: string;
  shirt?: string;
  short?: string;
  sock?: string;
  ball?: string;
  /** Horizontal mirror after crop, before tint. */
  flip?: boolean;
  /** If set, crop one cell from a horizontal sprite sheet first. */
  sheet?: SheetCrop;
}

type Rgb = [number, number, number];

/** Mirrors static/players/palette.json — keep in sync. */
export const palette = {
  sources: {
    shirt: { hex: '#0048A0', tolerance: 72 },
    short: { hex: '#C00018', tolerance: 72 },
    sock: { hex: '#F8C008', tolerance: 64 },
    ball: { hex: '#F87800', tolerance: 64 }
  },
  defaults: {
    shirt: '#5e6ad2',
    short: '#1c1c1c',
    sock: '#F8C008',
    ball: '#F87800'
  }
} as const;

const cache = new Map<string, string>();

function hexToRgb(hex: string): Rgb {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function dist(a: Rgb, b: Rgb): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function tintPixel(src: Rgb, target: Rgb): Rgb {
  const srcLum = Math.max(0.08, luminance(...src));
  const tgtLum = Math.max(0.08, luminance(...target));
  const scale = srcLum / tgtLum;
  return [
    Math.min(255, Math.round(target[0] * scale)),
    Math.min(255, Math.round(target[1] * scale)),
    Math.min(255, Math.round(target[2] * scale))
  ];
}

function cacheKey(opts: TintOptions): string {
  const sheet = opts.sheet
    ? `${opts.sheet.frameIndex},${opts.sheet.cellW}x${opts.sheet.cellH}`
    : '';
  return [
    opts.url,
    sheet,
    opts.flip ? '1' : '0',
    opts.shirt ?? '',
    opts.short ?? '',
    opts.sock ?? '',
    opts.ball ?? ''
  ].join('|');
}

async function loadImageData(url: string): Promise<ImageData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load sprite: ${url}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function cropSheetFrame(data: ImageData, sheet: SheetCrop): ImageData {
  const { frameIndex, cellW, cellH } = sheet;
  const sx = frameIndex * cellW;
  if (sx + cellW > data.width || cellH > data.height) {
    throw new Error(
      `Sheet crop out of bounds: frame ${frameIndex} cell ${cellW}x${cellH} on ${data.width}x${data.height}`
    );
  }
  const out = new ImageData(cellW, cellH);
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const si = ((y * data.width) + sx + x) * 4;
      const di = (y * cellW + x) * 4;
      out.data[di] = data.data[si];
      out.data[di + 1] = data.data[si + 1];
      out.data[di + 2] = data.data[si + 2];
      out.data[di + 3] = data.data[si + 3];
    }
  }
  return out;
}

function applyTint(data: ImageData, opts: TintOptions): ImageData {
  const channels: { key: RecolorChannel; target?: string }[] = [
    { key: 'shirt', target: opts.shirt },
    { key: 'short', target: opts.short },
    { key: 'sock', target: opts.sock },
    { key: 'ball', target: opts.ball }
  ];

  const sources = channels
    .filter((c) => c.target)
    .map((c) => {
      const src = palette.sources[c.key];
      return {
        key: c.key,
        source: hexToRgb(src.hex),
        target: hexToRgb(c.target!),
        tolerance: src.tolerance
      };
    });

  if (sources.length === 0) return data;

  const out = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
  const px = out.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a < 16) continue;
    const rgb: Rgb = [px[i], px[i + 1], px[i + 2]];
    if (rgb[0] > 245 && rgb[1] > 245 && rgb[2] > 245) continue;

    let best: (typeof sources)[number] | null = null;
    let bestD = Infinity;
    for (const s of sources) {
      const d = dist(rgb, s.source);
      if (d < s.tolerance && d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (!best) continue;
    const [r, g, b] = tintPixel(rgb, best.target);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  return out;
}

function flipHorizontal(data: ImageData): ImageData {
  const { width, height } = data;
  const out = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = (y * width + (width - 1 - x)) * 4;
      out.data[di] = data.data[si];
      out.data[di + 1] = data.data[si + 1];
      out.data[di + 2] = data.data[si + 2];
      out.data[di + 3] = data.data[si + 3];
    }
  }
  return out;
}

function toBlobUrl(data: ImageData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext('2d')!.putImageData(data, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('toBlob failed'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

/**
 * Crop (optional) + recolor a player/equipment PNG.
 * Returns a blob: URL (cached).
 */
export async function tintPlayerSprite(opts: TintOptions): Promise<string> {
  const key = cacheKey(opts);
  const hit = cache.get(key);
  if (hit) return hit;

  let data = await loadImageData(opts.url);
  if (opts.sheet) data = cropSheetFrame(data, opts.sheet);
  if (opts.flip) data = flipHorizontal(data);
  data = applyTint(data, opts);
  const url = await toBlobUrl(data);
  cache.set(key, url);
  return url;
}

export function clearTintCache(): void {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
}
