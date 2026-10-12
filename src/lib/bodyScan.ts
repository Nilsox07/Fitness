// Körperfotos & Körperfett: reine Rechenlogik (testbar, ohne Supabase/KI).

import { daysBetween } from '../components/social/format'
import type { Sex } from '../types'

export type ScanConfidence = 'niedrig' | 'mittel' | 'hoch'

export interface BodyScan {
  id: string
  user_id: string
  date: string
  photo_path: string | null
  bf_low: number | null
  bf_high: number | null
  weight_kg: number | null
  confidence: ScanConfidence | null
  source: 'ai' | 'manual'
  created_at: string
}

/** Vergleichsfotos erst nach ~8 Wochen vorschlagen – vorher sieht man kaum etwas. */
export const PHOTO_INTERVAL_DAYS = 56

export function bfMid(s: Pick<BodyScan, 'bf_low' | 'bf_high'>): number | null {
  if (s.bf_low == null || s.bf_high == null) return null
  return Math.round(((Number(s.bf_low) + Number(s.bf_high)) / 2) * 10) / 10
}

export function bfRangeLabel(s: Pick<BodyScan, 'bf_low' | 'bf_high'>): string {
  if (s.bf_low == null || s.bf_high == null) return '–'
  const lo = Math.round(Number(s.bf_low))
  const hi = Math.round(Number(s.bf_high))
  return lo === hi ? `${lo} %` : `${lo}–${hi} %`
}

/** Fett- und fettfreie Masse aus Gewicht und Körperfett (Mitte des Bereichs). */
export function composition(weightKg: number, bfPercent: number): { fatKg: number; leanKg: number } {
  const fatKg = Math.round(weightKg * (bfPercent / 100) * 10) / 10
  return { fatKg, leanKg: Math.round((weightKg - fatKg) * 10) / 10 }
}

/** Eiweiß nach fettfreier Masse (~2,2 g/kg) – genauer als pro kg Körpergewicht bei viel Körperfett. */
export function proteinFromLean(leanKg: number): number {
  return Math.round((leanKg * 2.2) / 5) * 5
}

/** Grundumsatz nach Katch-McArdle (nutzt die fettfreie Masse). */
export function katchMcArdle(leanKg: number): number {
  return Math.round(370 + 21.6 * leanKg)
}

/** Grobe, wertfreie Einordnung (übliche Bereiche nach Geschlecht). */
export function bfCategory(bf: number, sex: Sex): string {
  const t = sex === 'f' ? [17, 22, 27, 32] : [10, 15, 20, 25]
  if (bf < t[0]) return 'sehr definiert'
  if (bf < t[1]) return 'athletisch'
  if (bf < t[2]) return 'fit'
  if (bf < t[3]) return 'durchschnittlich'
  return 'erhöht'
}

/** Tage seit dem letzten Foto; null wenn es noch keins gibt. */
export function daysSinceLastPhoto(scans: BodyScan[], today: string): number | null {
  const last = [...scans].filter((s) => s.photo_path).sort((a, b) => b.date.localeCompare(a.date))[0]
  return last ? daysBetween(last.date, today) : null
}

/** Neues Vergleichsfoto fällig? (frühestens nach PHOTO_INTERVAL_DAYS) */
export function photoDue(scans: BodyScan[], today: string): boolean {
  const d = daysSinceLastPhoto(scans, today)
  return d !== null && d >= PHOTO_INTERVAL_DAYS
}

export interface BodyFatEstimate {
  ok: boolean
  low: number
  high: number
  confidence: ScanConfidence
  /** Hinweise zur Aufnahme (Licht, Pose …), max. 3 */
  hints: string[]
  /** Grund, falls ok = false (z. B. keine Person erkennbar) */
  reason?: string
}

/** KI-Antwort robust in eine Schätzung übersetzen (Bereich 3–60 %, mind. 2 Punkte breit). */
export function toBodyFatEstimate(raw: unknown): BodyFatEstimate {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const n = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN)
  const hints = Array.isArray(o.hints)
    ? o.hints.filter((h): h is string => typeof h === 'string' && !!h.trim()).slice(0, 3)
    : []
  let low = n(o.low)
  let high = n(o.high)
  const usable = o.ok !== false && Number.isFinite(low) && Number.isFinite(high)
  if (!usable) {
    return {
      ok: false,
      low: 0,
      high: 0,
      confidence: 'niedrig',
      hints,
      reason:
        typeof o.reason === 'string' && o.reason.trim()
          ? o.reason.trim()
          : 'Auf dem Foto ist kein Oberkörper gut erkennbar.',
    }
  }
  if (low > high) [low, high] = [high, low]
  low = Math.max(3, Math.min(60, low))
  high = Math.max(3, Math.min(60, high))
  // Keine Schein-Genauigkeit: mindestens 2, höchstens 8 Prozentpunkte breit
  if (high - low < 2) {
    const mid = (low + high) / 2
    low = mid - 1
    high = mid + 1
  }
  if (high - low > 8) {
    const mid = (low + high) / 2
    low = mid - 4
    high = mid + 4
  }
  const conf = o.confidence === 'hoch' || o.confidence === 'mittel' ? o.confidence : 'niedrig'
  return { ok: true, low: Math.round(low), high: Math.round(high), confidence: conf, hints }
}

/** Veränderung zwischen erster und letzter Messung (Mitte der Bereiche). */
export function bfChange(scans: BodyScan[]): { delta: number; days: number } | null {
  const withBf = [...scans].filter((s) => bfMid(s) !== null).sort((a, b) => a.date.localeCompare(b.date))
  if (withBf.length < 2) return null
  const first = withBf[0]
  const last = withBf[withBf.length - 1]
  return {
    delta: Math.round((bfMid(last)! - bfMid(first)!) * 10) / 10,
    days: daysBetween(first.date, last.date),
  }
}
