// Perioden aus Health Connect zusammenführen: ausdrückliche Perioden (Start/Ende) und
// einzelne Blutungstage. Reine Logik, damit sie testbar bleibt.

import { localDate } from './day'

export interface PeriodInput {
  start: string
  end: string | null
}

export interface MergedPeriod {
  start_date: string
  /** null = läuft noch */
  end_date: string | null
}

/** Höchstens so viele Tage ohne Eintrag dazwischen gehören noch zur selben Periode. */
export const MAX_GAP_DAYS = 2

interface Span {
  s: number
  e: number
  open: boolean
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function dayNum(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400_000)
}

function isDate(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(dayNum(v))
}

/**
 * Kombiniert Perioden mit aus Blutungstagen abgeleiteten Perioden (Lücke ≤ MAX_GAP_DAYS = dieselbe),
 * fasst Überlappendes zusammen (frühester Start, spätestes Ende) und liefert sie nach Start sortiert.
 * Zukünftige Daten werden ignoriert; ein Ende in der Zukunft gilt als „läuft noch“ (null).
 */
export function mergePeriods(
  periods: PeriodInput[] | null | undefined,
  flowDays: string[] | null | undefined,
  today = localDate(),
): MergedPeriod[] {
  const todayN = dayNum(today)
  // Intervalle als Tageszahlen. Offene Perioden (ohne Ende) zählen beim Zusammenfassen nur mit ihrem
  // Start – sonst würde eine nie beendete Periode alle späteren verschlucken.
  const items: Span[] = []

  for (const p of periods ?? []) {
    if (!p || !isDate(p.start)) continue
    const s = dayNum(p.start)
    if (s > todayN) continue
    const e = isDate(p.end) ? dayNum(p.end) : null
    if (e === null || e > todayN) items.push({ s, e: s, open: true })
    else items.push({ s, e: Math.max(s, e), open: false })
  }

  // Blutungstage als Ein-Tages-Abschnitte; das Zusammenfassen unten verbindet sie
  const days = new Set((flowDays ?? []).filter(isDate).map(dayNum))
  for (const d of days) if (d <= todayN) items.push({ s: d, e: d, open: false })

  items.sort((a, b) => a.s - b.s || a.e - b.e)
  const merged: Span[] = []
  for (const it of items) {
    const cur = merged[merged.length - 1]
    if (cur && it.s - cur.e <= MAX_GAP_DAYS + 1) {
      cur.e = Math.max(cur.e, it.e)
      cur.open = cur.open || it.open
    } else {
      merged.push({ ...it })
    }
  }

  const toDate = (n: number) => {
    const d = new Date(n * 86400_000)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  // „Läuft noch“ nur für die jüngste Periode; ältere offene enden mit ihrem letzten bekannten Tag
  return merged.map((m, i) => ({
    start_date: toDate(m.s),
    end_date: m.open && i === merged.length - 1 ? null : toDate(m.e),
  }))
}
