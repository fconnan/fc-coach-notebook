/** `{{nom}}` ou `{{nom|défaut}}` dans un dessin. Le défaut sert à l’aperçu ; un schéma peut le remplacer. */

const TOKEN = /\{\{\s*([A-Za-z][\w-]*)(?:\|([^}]*))?\s*\}\}/g;

export interface SvgParam {
  name: string;
  fallback: string;
}

export function paramsOf(markup: string): SvgParam[] {
  const found = new Map<string, string>();
  for (const match of markup.matchAll(TOKEN)) {
    const name = match[1];
    const fallback = (match[2] ?? '').trim();
    if (!name) continue;
    if (!found.has(name)) found.set(name, fallback);
    else if (!found.get(name) && fallback) found.set(name, fallback);
  }
  return [...found].map(([name, fallback]) => ({ name, fallback }));
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Remplace les jetons. Une valeur fournie, même vide, l’emporte sur le défaut. */
export function applyParams(markup: string, values: Record<string, string | undefined>): string {
  return markup.replace(TOKEN, (full, name: string, fallback: string | undefined) => {
    const given = values[name];
    if (given !== undefined) return esc(given);
    if (fallback !== undefined) return esc(fallback.trim());
    return full;
  });
}

export function isColorValue(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());
}

/** Valeur acceptée par `<input type="color">`. */
export function hexForInput(value: string): string {
  const text = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  if (/^#[0-9a-fA-F]{8}$/.test(text)) return text.slice(0, 7);
  return '#000000';
}
