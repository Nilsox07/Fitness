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
 * als ein Training zusammen. Standardwert; einstellbar (0–6 Uhr) über die
 * Nutzer-Einstellungen, die den Wert lokal spiegeln (siehe `setDayCutoff`).
 */
export const DAY_CUTOFF_H = 4

const CUTOFF_KEY = 'pref_day_cutoff_h'

function clampCutoff(h: number): number {
  return Math.min(6, Math.max(0, Math.round(h)))
}

/** Eingestellte Tageswechsel-Stunde (lokaler Spiegel der Einstellung, Standard 4). */
export function getDayCutoff(): number {
  try {
    const raw = localStorage.getItem(CUTOFF_KEY)
    if (raw == null || raw === '') return DAY_CUTOFF_H
    const v = Number(raw)
    return Number.isFinite(v) ? clampCutoff(v) : DAY_CUTOFF_H
  } catch {
    return DAY_CUTOFF_H
  }
}

/** Spiegel der Einstellung setzen (null = Standard), damit auch Nicht-React-Code ihn kennt. */
export function setDayCutoff(h: number | null) {
  try {
    if (h == null || h === DAY_CUTOFF_H) localStorage.removeItem(CUTOFF_KEY)
    else localStorage.setItem(CUTOFF_KEY, String(clampCutoff(h)))
  } catch {
    /* ignore */
  }
}

/** Lokales Datum (YYYY-MM-DD) des Trainings-Tags, Wechsel um `cutoffH` Uhr statt 00:00. */
export function trainingDay(now = new Date(), cutoffH = getDayCutoff()): string {
  const d = new Date(now)
  d.setHours(d.getHours() - cutoffH)
  return localDate(d)
}
