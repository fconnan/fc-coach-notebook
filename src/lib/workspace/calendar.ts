const MONTHS: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11
};

/** Chronological key for a date written in French, such as "mardi 1 septembre 2026". */
export function frenchDateOrder(value: string): number {
  const match = /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/.exec(value || '');
  if (!match) return Number.MAX_SAFE_INTEGER;
  const month = MONTHS[match[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()];
  if (month === undefined) return Number.MAX_SAFE_INTEGER;
  return Date.UTC(Number(match[3]), month, Number(match[1]));
}
