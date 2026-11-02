// Körpermaße (Taille, Brust, Oberarm, Hüfte, Oberschenkel) – Auswertung je Maß. Rein und testbar.

export type MeasureKey = 'waist' | 'chest' | 'arm' | 'hip' | 'thigh'

export interface MeasurementRow {
  id?: string
  /** YYYY-MM-DD */
  date: string
  waist: number | null
  chest: number | null
  arm: number | null
  hip: number | null
  thigh: number | null
}

export const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: 'waist', label: 'Taille' },
  { key: 'chest', label: 'Brust' },
  { key: 'arm', label: 'Oberarm' },
  { key: 'hip', label: 'Hüfte' },
  { key: 'thigh', label: 'Oberschenkel' },
]

/** Plausible Spanne in cm. */
export const MEASURE_MIN = 10
export const MEASURE_MAX = 250

export interface MeasureSummary {
  key: MeasureKey
  label: string
  latest: number
  latestDate: string
  first: number
  /** Veränderung seit der ersten Messung (cm, 0,1 genau) */
  change: number
  /** Werte in Datumsreihenfolge (für den Mini-Verlauf) */
  series: number[]
}

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Je Maß: letzter Wert, Veränderung zur ersten Messung, Verlauf. Nie eingetragene Maße fehlen. */
export function summarizeMeasurements(rows: MeasurementRow[]): MeasureSummary[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const out: MeasureSummary[] = []
  for (const { key, label } of MEASURES) {
    const pts = sorted.flatMap((r) => {
      const v = toNum(r[key])
      return v === null ? [] : [{ date: r.date, v }]
    })
    if (!pts.length) continue
    const first = pts[0].v
    const last = pts[pts.length - 1]
    out.push({
      key,
      label,
      latest: last.v,
      latestDate: last.date,
      first,
      change: Math.round((last.v - first) * 10) / 10,
      series: pts.map((p) => p.v).slice(-12),
    })
  }
  return out
}

/**
 * Eingaben aus dem Formular („92,5“, leer …) → nur die ausgefüllten Maße.
 * `errors` nennt die Maße mit unplausiblen Werten.
 */
export function parseMeasureInput(input: Partial<Record<MeasureKey, string>>): {
  values: Partial<Record<MeasureKey, number>>
  errors: MeasureKey[]
} {
  const values: Partial<Record<MeasureKey, number>> = {}
  const errors: MeasureKey[] = []
  for (const { key } of MEASURES) {
    const raw = input[key]?.trim()
    if (!raw) continue
    const n = Number(raw.replace(',', '.'))
    if (!Number.isFinite(n) || n < MEASURE_MIN || n > MEASURE_MAX) errors.push(key)
    else values[key] = Math.round(n * 10) / 10
  }
  return { values, errors }
}

/** „92 cm“ bzw. „92,5 cm“. */
export const cm = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} cm`

/** „−4 cm“, „+1,5 cm“, „±0 cm“. */
export const signedCm = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toLocaleString('de-DE', { maximumFractionDigits: 1 })} cm`
