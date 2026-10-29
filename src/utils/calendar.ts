export interface MonthGrid {
  label: string;
  /** Sel kalender mulai Senin; null = sel kosong, selain itu YYYY-MM-DD. */
  cells: (string | null)[];
}

export function buildMonthGrid(todayKey: string, locale = 'id-ID'): MonthGrid {
  const [y = '1970', m = '1'] = todayKey.split('-');
  const year = Number(y);
  const month = Number(m);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  return { label, cells };
}
