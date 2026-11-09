// Kalorien pro Training – bewusst als grobe Schätzung (kein „pro Übung“, das wäre Scheingenauigkeit).
// Krafttraining: MET-Werte aus dem Compendium of Physical Activities (locker ≈ 3,5, intensiv ≈ 6),
// die Intensität kommt aus Satzdichte (Sätze pro Minute) und dem Anteil großer Muskelgruppen.
// Gezählt wird der Mehrverbrauch über dem Ruheumsatz: (MET − 1) × kg × Stunden.
// Uhr-Werte nur, wenn sie zur Schätzung passen (Uhren übertreiben bei Kraft gern) – sonst begrenzt.
// Reine Logik – getestet in trainingKcal.test.ts.

import type { HybridTemplate } from './hybridSessions'

export type KcalSource = 'estimate' | 'watch' | 'watch-capped'

export interface KcalEstimate {
  kcal: number
  lo: number
  hi: number
  source: KcalSource
  minutes: number
}

export interface KcalSet {
  created_at: string
  set_type: string
  reps: number | null
  exercise_id: string
}

/** Große Muskelgruppen verbrauchen mehr (Beine, Rücken, Ganzkörper) */
const BIG = new Set(['Beine', 'Beinbeuger', 'Gesäß', 'Rücken', 'Ganzkörper'])
export const DEFAULT_KG = 75
/** Halbe Gutschrift: Kalorien vom Training nie ganz „zurückessen“ */
export const BONUS_SHARE = 0.5
export const BONUS_MAX = 600

const round10 = (n: number) => Math.round(n / 10) * 10
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const performed = (s: KcalSet) => (s.reps ?? 0) > 0

/** Dauer aus den Satz-Zeitstempeln (+2 min für den ersten Satz); unplausibel → 2,5 min je Satz. */
export function sessionMinutes(sets: readonly KcalSet[]): number {
  const done = sets.filter(performed)
  const t = done.map((s) => Date.parse(s.created_at)).filter(Number.isFinite)
  const span = t.length > 1 ? (Math.max(...t) - Math.min(...t)) / 60000 + 2 : 0
  if (span >= 10 && span <= 240) return Math.round(span)
  return clamp(Math.round(done.length * 2.5), 5, 180)
}

/** MET des Krafttrainings: dichter und mehr große Muskeln = intensiver. */
export function strengthMet(workingSets: number, minutes: number, bigShare: number): number {
  const density = minutes > 0 ? workingSets / minutes : 0
  return clamp(3.5 + (density - 0.25) * 8 + bigShare * 0.8, 3, 6.5)
}

/** Schätzung für eine Kraft-Einheit (Sätze eines Trainings). null ohne erledigte Sätze. */
export function strengthKcal(
  sets: readonly KcalSet[],
  kg: number,
  muscleOf: (exerciseId: string) => string | undefined,
): KcalEstimate | null {
  const done = sets.filter(performed)
  if (!done.length) return null
  const working = done.filter((s) => s.set_type !== 'warmup')
  const minutes = sessionMinutes(done)
  const big = working.length ? working.filter((s) => BIG.has(muscleOf(s.exercise_id) ?? '')).length / working.length : 0
  const met = strengthMet(working.length, minutes, big)
  const kcal = round10(((met - 1) * (kg || DEFAULT_KG) * minutes) / 60)
  return { kcal, lo: round10(kcal * 0.8), hi: round10(kcal * 1.2), source: 'estimate', minutes }
}

/**
 * Uhr-Wert einbeziehen: passt er (60–160 % der Schätzung), gilt er; sonst begrenzt auf diese Spanne.
 * Ohne Uhr-Wert bleibt die Schätzung.
 */
export function withWatch(est: KcalEstimate, watchKcal: number | null | undefined): KcalEstimate {
  if (!watchKcal || watchKcal <= 0) return est
  const lo = est.kcal * 0.6
  const hi = est.kcal * 1.6
  const v = round10(clamp(watchKcal, lo, hi))
  const capped = watchKcal < lo || watchKcal > hi
  return {
    ...est,
    kcal: v,
    lo: round10(v * 0.9),
    hi: round10(v * 1.1),
    source: capped ? 'watch-capped' : 'watch',
  }
}

/** Uhr-Aktivität(en), die zeitlich zum Training passen (±20 min um den ersten/letzten Satz). */
export function matchWatchKcal(
  acts: readonly { started_at: string; duration_s: number; kcal: number | null }[],
  sets: readonly KcalSet[],
): number | null {
  const t = sets
    .filter(performed)
    .map((s) => Date.parse(s.created_at))
    .filter(Number.isFinite)
  if (!t.length) return null
  const from = Math.min(...t) - 20 * 60000
  const to = Math.max(...t) + 20 * 60000
  let sum = 0
  for (const a of acts) {
    const start = Date.parse(a.started_at)
    const end = start + a.duration_s * 1000
    if (a.kcal && end >= from && start <= to) sum += a.kcal
  }
  return sum > 0 ? sum : null
}

/** „1 km“ → 1, „800 m“ → 0,8, sonst null */
export function parseKm(target: string): number | null {
  const m = /^([\d.,]+)\s*(km|m)$/.exec(target.trim())
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  return m[2] === 'km' ? n : n / 1000
}

/** Laufen: ≈ 0,95 kcal je kg und km über dem Ruheumsatz (gut belegt, unabhängig vom Tempo). */
export const runKcal = (km: number, kg: number) => km * (kg || DEFAULT_KG) * 0.95

/** Hybrid-Einheit: Laufabschnitte nach Strecke, Stationen nach Zeit (≈ 8 MET). */
export function hybridKcal(t: HybridTemplate, splits: readonly number[], kg: number): KcalEstimate {
  let kcal = 0
  splits.forEach((sec, i) => {
    const p = t.parts[i]
    if (!p) return
    const km = p.kind === 'run' ? parseKm(p.target) : null
    kcal += km != null ? runKcal(km, kg) : ((8 - 1) * (kg || DEFAULT_KG) * sec) / 3600
  })
  const v = round10(kcal)
  const minutes = Math.round(splits.reduce((a, b) => a + b, 0) / 60)
  return { kcal: v, lo: round10(v * 0.85), hi: round10(v * 1.15), source: 'estimate', minutes }
}

/** Anzeige: Uhr als Einzelwert, Schätzung als Spanne. */
export function kcalText(e: KcalEstimate): string {
  return e.source === 'estimate' ? `≈ ${e.lo}–${e.hi} kcal` : `≈ ${e.kcal} kcal`
}

export function kcalSourceText(e: KcalEstimate): string {
  if (e.source === 'watch') return 'Von deiner Uhr – passt zur Schätzung aus Dauer und Sätzen.'
  if (e.source === 'watch-capped')
    return 'Deine Uhr lag weit daneben (bei Krafttraining häufig), deshalb auf eine plausible Spanne begrenzt.'
  return 'Grobe Schätzung aus Dauer, Satzdichte, Muskelgruppen und deinem Gewicht – Mehrverbrauch über dem Ruheumsatz.'
}

export type BonusMode = 'fixed' | 'auto'

/** Kalorien-Bonus eines Tages: pauschal (wenn trainiert) oder die Hälfte des geschätzten Verbrauchs. */
export function dayBonus(mode: BonusMode, fixed: number, trained: boolean, burned: number): number {
  if (!trained) return 0
  if (mode === 'fixed') return Math.max(0, fixed)
  return clamp(round10(burned * BONUS_SHARE), 0, BONUS_MAX)
}

/** Letztes Körpergewicht bis zu einem Datum (sonst Profilwert, sonst 75 kg). */
export function weightOn(
  date: string,
  weights: readonly { date: string; kg: number }[],
  fallback: number | null | undefined,
): number {
  let best: { date: string; kg: number } | null = null
  for (const w of weights) if (w.date <= date && (!best || w.date > best.date)) best = w
  return best?.kg || fallback || DEFAULT_KG
}
