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

/** Chronological key for an ISO date (`2026-09-01`) or a French date. */
export function frenchDateOrder(value: string): number {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const match = /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/.exec(value || '');
  if (!match) return Number.MAX_SAFE_INTEGER;
  const month = MONTHS[match[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()];
  if (month === undefined) return Number.MAX_SAFE_INTEGER;
  return Date.UTC(Number(match[3]), month, Number(match[1]));
}

/** ISO `YYYY-MM-DD` when the value is that date, or a French date that parses. */
export function canonicalIso(value: string): string {
  const order = frenchDateOrder(value);
  if (order === Number.MAX_SAFE_INTEGER) return '';
  const date = new Date(order);
  const iso = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  const raw = (value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return iso === raw ? raw : '';
  return iso;
}

export const WEEKDAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const;

export interface MonthDay {
  iso: string;
  day: number;
  inMonth: boolean;
}

function isoFromUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Local calendar day, the one the « Aujourd’hui » button returns to. */
export function todayParts(): { year: number; month: number; iso: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { year, month, iso };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

/** `octobre 2026`. */
export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month, 1)))
    .replace(/[\u202f\u00a0]/g, ' ');
}

/** Weeks of the month, Monday first. Days outside the month stay empty so the columns stay aligned. */
export function monthGrid(year: number, month: number): MonthDay[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const total = Math.ceil((offset + last) / 7) * 7;
  const start = Date.UTC(year, month, 1 - offset);
  const days: MonthDay[] = [];
  for (let index = 0; index < total; index++) {
    const date = new Date(start + index * 86400000);
    days.push({
      iso: isoFromUtc(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month && date.getUTCFullYear() === year
    });
  }
  return days;
}

/** Weekday, day, month and year, e.g. `mardi 1 septembre 2026`. */
export function longFrenchDate(value: string): string {
  const order = frenchDateOrder(value);
  if (order === Number.MAX_SAFE_INTEGER) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(order)).replace(/[\u202f\u00a0]/g, ' ');
}
