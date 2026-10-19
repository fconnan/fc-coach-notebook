const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;

/** Valid `#rrggbb` for `<input type="color">` (never empty). */
export function toColorInputValue(value: string | undefined | null, fallback: string): string {
  const fb = HEX6.test(fallback) ? fallback : '#808080';
  if (!value || value === 'none') return fb;
  if (HEX6.test(value)) return value.toLowerCase();
  if (HEX3.test(value)) {
    const h = value.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return fb;
}
