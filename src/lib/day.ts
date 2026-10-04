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

/**
 * Trainings-Tag: wechselt nicht um Mitternacht, sondern erst um DAY_CUTOFF_H Uhr
 * morgens. So bleibt eine Session, die vor 0 Uhr startet und danach weiterläuft,
 * als ein Training zusammen.
 */
export const DAY_CUTOFF_H = 4

/** Lokales Datum (YYYY-MM-DD) des Trainings-Tags, Wechsel um 04:00 statt 00:00. */
export function trainingDay(now = new Date()): string {
  const d = new Date(now)
  d.setHours(d.getHours() - DAY_CUTOFF_H)
  return localDate(d)
}
