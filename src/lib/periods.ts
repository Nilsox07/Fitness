// Kalender-Zeiträume für die Statistik (Woche / Monat / Jahr) — rein, testbar.
// Alle Datumswerte sind lokale Tage im Format YYYY-MM-DD.

import { localDate, shiftDate } from './day'

export type Period = 'week' | 'month' | 'year'

export const PERIOD_LABELS: Record<Period, string> = {
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
}

export interface PeriodRange {
  /** erster Tag des laufenden Zeitraums */
  start: string
  /** letzter Tag des laufenden Zeitraums (inkl.) */
  end: string
  /** letzter Kalendertag des Zeitraums (auch in der Zukunft) — für Diagramme */
  periodEnd: string
  /** Vergleichszeitraum: gleich lange Spanne im Vorzeitraum */
  prevStart: string
  prevEnd: string
}

function parse(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

function ymd(y: number, m: number, d: number): string {
  return localDate(new Date(y, m - 1, d))
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

/**
 * Laufender Kalender-Zeitraum bis heute und der gleich lange Abschnitt des
 * Vorzeitraums („bis heute" vs. „bis zum selben Tag davor"), damit der Vergleich
 * fair bleibt (z. B. 1.–15. September vs. 1.–15. August).
 */
export function periodRange(period: Period, today: string): PeriodRange {
  const [y, m, d] = parse(today)
  if (period === 'week') {
    const dow = (new Date(y, m - 1, d).getDay() + 6) % 7 // Mo = 0
    const start = shiftDate(today, -dow)
    return {
      start,
      end: today,
      periodEnd: shiftDate(start, 6),
      prevStart: shiftDate(start, -7),
      prevEnd: shiftDate(today, -7),
    }
  }
  if (period === 'month') {
    const py = m === 1 ? y - 1 : y
    const pm = m === 1 ? 12 : m - 1
    return {
      start: ymd(y, m, 1),
      end: today,
      periodEnd: ymd(y, m, daysInMonth(y, m)),
      prevStart: ymd(py, pm, 1),
      prevEnd: ymd(py, pm, Math.min(d, daysInMonth(py, pm))),
    }
  }
  return {
    start: ymd(y, 1, 1),
    end: today,
    periodEnd: ymd(y, 12, 31),
    prevStart: ymd(y - 1, 1, 1),
    prevEnd: ymd(y - 1, m, Math.min(d, daysInMonth(y - 1, m))),
  }
}

export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

/** Prozentuale Veränderung (gerundet); null, wenn es keinen Vergleichswert gibt. */
export function pctChange(cur: number, prev: number): number | null {
  if (!(prev > 0)) return null
  return Math.round(((cur - prev) / prev) * 100)
}

export interface Bucket {
  label: string
  start: string
  end: string
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function ddmm(date: string): string {
  const [, m, d] = parse(date)
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`
}

/**
 * Diagramm-Abschnitte eines Zeitraums: Woche → Tage, Monat → Kalenderwochen
 * (am Monatsrand gekappt), Jahr → Monate. Umfasst den ganzen Zeitraum.
 */
export function periodBuckets(period: Period, today: string): Bucket[] {
  const r = periodRange(period, today)
  if (period === 'week') {
    return WEEKDAYS.map((label, i) => {
      const day = shiftDate(r.start, i)
      return { label, start: day, end: day }
    })
  }
  if (period === 'year') {
    const [y] = parse(today)
    return MONTHS.map((label, i) => ({
      label,
      start: ymd(y, i + 1, 1),
      end: ymd(y, i + 1, daysInMonth(y, i + 1)),
    }))
  }
  const out: Bucket[] = []
  let cur = r.start
  while (cur <= r.periodEnd) {
    const [y, m, d] = parse(cur)
    const dow = (new Date(y, m - 1, d).getDay() + 6) % 7
    const sunday = shiftDate(cur, 6 - dow)
    const end = sunday < r.periodEnd ? sunday : r.periodEnd
    out.push({ label: ddmm(cur), start: cur, end })
    cur = shiftDate(end, 1)
  }
  return out
}

/** Summiert Werte je Abschnitt. */
export function sumByBucket(
  items: { date: string; value: number }[],
  buckets: Bucket[],
): { label: string; value: number }[] {
  const sums = buckets.map(() => 0)
  for (const it of items) {
    const i = buckets.findIndex((b) => it.date >= b.start && it.date <= b.end)
    if (i >= 0) sums[i] += it.value
  }
  return buckets.map((b, i) => ({ label: b.label, value: Math.round(sums[i]) }))
}
