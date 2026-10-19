import { get } from 'svelte/store';
import { currentPage } from '$lib/stores/workspace';
import type { Page } from '$lib/stores/workspace';

// SVG presentation properties to inline before rasterisation (component-scoped
// CSS is lost when the SVG is serialised standalone, so we bake computed styles in).
const SVG_STYLE_PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'opacity',
  'font-size', 'font-weight', 'font-family', 'font-style', 'text-anchor',
  'dominant-baseline', 'text-decoration', 'paint-order'
];

function inlineStyles(src: Element, clone: Element) {
  const srcNodes = [src, ...Array.from(src.querySelectorAll('*'))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))];
  for (let i = 0; i < srcNodes.length; i++) {
    const cs = getComputedStyle(srcNodes[i]);
    let style = '';
    for (const prop of SVG_STYLE_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v) style += `${prop}:${v};`;
    }
    const target = cloneNodes[i] as HTMLElement;
    if (target && target.setAttribute) {
      target.setAttribute('style', style + (target.getAttribute('style') || ''));
    }
  }
}

function baseViewBox(page: Page) {
  if (page.fieldTemplate === 'Complet') return { x: -40, y: -40, w: 760, h: 1130 };
  if (page.fieldTemplate === 'Demi') return { x: -40, y: -40, w: 760, h: 566.25 };
  return { x: -40, y: 523.75, w: 760, h: 566.25 };
}

const RES_WIDTH: Record<string, number> = { high: 2000, medium: 1400, low: 760 };

export interface ImageExportOptions {
  format: 'png' | 'jpeg';
  resolution: 'high' | 'medium' | 'low';
  crop: boolean;
}

async function renderToCanvas(opts: { resolution: string; crop: boolean }): Promise<HTMLCanvasElement> {
  const page = get(currentPage);
  const live = document.querySelector('svg.drawing-surface-vertical') as SVGSVGElement | null;
  if (!live) throw new Error('Canvas SVG introuvable');

  // Determine the viewBox to capture
  let vb = baseViewBox(page);
  if (opts.crop) {
    const group = live.querySelector('g.elements') as SVGGElement | null;
    try {
      const bb = group?.getBBox();
      if (bb && bb.width > 1 && bb.height > 1) {
        const pad = 30;
        vb = { x: bb.x - pad, y: bb.y - pad, w: bb.width + pad * 2, h: bb.height + pad * 2 };
      }
    } catch { /* getBBox can throw if not rendered; fall back to base */ }
  }

  const targetW = RES_WIDTH[opts.resolution] || 1400;
  const targetH = Math.round(targetW * (vb.h / vb.w));

  const clone = live.cloneNode(true) as SVGSVGElement;
  inlineStyles(live, clone);
  clone.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  clone.setAttribute('width', String(targetW));
  clone.setAttribute('height', String(targetH));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('style');

  const svgStr = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;
    // Fill with the pitch background so JPEG has no black margins
    ctx.fillStyle = page.backgroundColor || '#2b6b39';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime, quality);
  });
}

export async function exportImage(opts: ImageExportOptions) {
  const page = get(currentPage);
  const canvas = await renderToCanvas(opts);
  const mime = opts.format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, mime, opts.format === 'jpeg' ? 0.92 : undefined);
  const ext = opts.format === 'png' ? 'png' : 'jpg';
  download(blob, `${(page.name || 'tactique').replace(/[^\w\-]+/g, '_')}.${ext}`);
}

/** Strip basic markdown markup to readable plain text for the PDF notes block. */
function markdownToPlain(md: string): string {
  return (md || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();
}

export async function exportPDF() {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const page = get(currentPage);

  // Render the pitch at high resolution as PNG for crisp embedding
  const canvas = await renderToCanvas({ resolution: 'high', crop: false });
  const pngBlob = await canvasToBlob(canvas, 'image/png');
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

  const doc = await PDFDocument.create();
  const pdfPage = doc.addPage([595.28, 841.89]); // A4 portrait (pts)
  const { width, height } = pdfPage.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 40;
  let y = height - margin;

  const dark = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.45);

  // Title
  pdfPage.drawText(page.name || 'Séance', { x: margin, y: y - 18, size: 20, font: fontBold, color: dark });
  y -= 34;

  // Session meta line
  const s = page.session || {};
  const meta: string[] = [];
  if (s.date) meta.push(`Date : ${s.date}`);
  if (s.durationMin) meta.push(`Durée : ${s.durationMin} min`);
  if (s.level) meta.push(`Niveau : ${s.level}`);
  if (meta.length) {
    pdfPage.drawText(meta.join('    '), { x: margin, y, size: 10, font, color: muted });
    y -= 16;
  }
  if (s.objective) {
    y -= 2;
    drawWrapped(pdfPage, `Objectif : ${s.objective}`, margin, y, width - margin * 2, 11, font, dark);
    y -= 11 * 1.4 * Math.max(1, wrapCount(`Objectif : ${s.objective}`, width - margin * 2, 11, font)) + 6;
  }

  // Pitch image
  const png = await doc.embedPng(pngBytes);
  const maxImgW = width - margin * 2;
  const maxImgH = y - margin - 160; // leave room for notes
  const ratio = png.width / png.height;
  let imgW = maxImgW;
  let imgH = imgW / ratio;
  if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * ratio; }
  const imgX = margin + (maxImgW - imgW) / 2;
  y -= imgH + 10;
  pdfPage.drawImage(png, { x: imgX, y, width: imgW, height: imgH });

  // Notes
  y -= 24;
  const notes = markdownToPlain(page.markdownContent || '');
  if (notes) {
    pdfPage.drawText('Notes', { x: margin, y, size: 12, font: fontBold, color: dark });
    y -= 16;
    for (const line of notes.split('\n')) {
      if (y < margin + 12) break;
      const consumed = drawWrapped(pdfPage, line || ' ', margin, y, width - margin * 2, 10, font, dark);
      y -= consumed;
    }
  }

  const bytes = await doc.save();
  download(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), `${(page.name || 'tactique').replace(/[^\w\-]+/g, '_')}.pdf`);
}

function wrapLines(text: string, maxWidth: number, size: number, font: any): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function wrapCount(text: string, maxWidth: number, size: number, font: any): number {
  return wrapLines(text, maxWidth, size, font).length;
}

function drawWrapped(pdfPage: any, text: string, x: number, y: number, maxWidth: number, size: number, font: any, color: any): number {
  const lines = wrapLines(text, maxWidth, size, font);
  let dy = 0;
  for (const line of lines) {
    pdfPage.drawText(line, { x, y: y - dy, size, font, color });
    dy += size * 1.4;
  }
  return dy;
}
