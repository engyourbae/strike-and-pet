// Logika murni tanggal & zona waktu, dipakai klien.

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Tanggal lokal (YYYY-MM-DD) pada zona waktu tertentu. Pergantian hari mengikuti zona waktu itu. */
export function dateKey(nowMs: number, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(nowMs));
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

export function isDateKey(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toUtcDay(key: string): number {
  const [y = '1970', m = '1', d = '1'] = key.split('-');
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

export function addDays(key: string, n: number): string {
  return new Date(toUtcDay(key) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Selisih hari kalender (to - from). */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtcDay(to) - toUtcDay(from)) / 86_400_000);
}
