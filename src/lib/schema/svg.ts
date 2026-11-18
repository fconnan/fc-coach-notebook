function quoted(source: string, name: string): string {
  const found = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(source);
  return found?.[1] || '';
}

/** Contenu d’un fichier SVG, sans la balise racine. Les métadonnées vivent dans le YAML. */
export function readSvg(source: string): { markup: string; viewBox: string } {
  const opened = /<svg\b([^>]*)>/i.exec(source);
  const markup = source
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
  return { markup, viewBox: quoted(opened?.[1] || '', 'viewBox') };
}

/** Largeur, longueur et marge déduites d’un viewBox de terrain. */
export function pitchBox(viewBox: string): { width: number; length: number; margin: number } | null {
  const [x, y, w, h] = viewBox.trim().split(/[\s,]+/).map(Number);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  const margin = Math.max(x < 0 ? -x : 0, y < 0 ? -y : 0);
  return { width: w - margin * 2, length: h - margin * 2, margin };
}
