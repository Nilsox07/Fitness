/** Lokales Datum als YYYY-MM-DD (keine UTC-Verschiebung). */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Tage zu einem YYYY-MM-DD addieren. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + days))
}

/** „Heute", „Gestern" oder „Mo., 28. Sep.". */
export function dayLabel(date: string, today = localDate()): string {
  if (date === today) return 'Heute'
  if (date === shiftDate(today, -1)) return 'Gestern'
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })
}
