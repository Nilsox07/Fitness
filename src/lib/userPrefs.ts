// Persönliche Einstellungen der neuen App (Trainingsrhythmus, Kalorien-Bonus,
// Mahlzeiten-Aufteilung, Tageswechsel). Gespeichert in `profiles.prefs` (jsonb,
// Migration 0028); fehlt die Spalte noch, lokal als Fallback. Reine Logik hier.

import type { Meal } from '../types'
import { DAY_CUTOFF_H } from './day'
import type { Schedule } from './schedule'

/** Prozent je Mahlzeit (Summe = 100). */
export type MealSplit = Record<Meal, number>

export interface UserPrefs {
  schedule: Schedule | null
  /** Zusätzliche kcal an Trainingstagen (0–600). */
  kcalBonus: number
  mealSplit: MealSplit
  /** Stunde (0–6), ab der ein neuer Trainings-Tag beginnt. */
  dayCutoff: number
}

export const DEFAULT_KCAL_BONUS = 250
export const DEFAULT_MEAL_SPLIT: MealSplit = { breakfast: 25, lunch: 35, dinner: 30, snack: 10 }

export const DEFAULT_PREFS: UserPrefs = {
  schedule: null,
  kcalBonus: DEFAULT_KCAL_BONUS,
  mealSplit: DEFAULT_MEAL_SPLIT,
  dayCutoff: DAY_CUTOFF_H,
}

const num = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback
}

/** Summe der Mahlzeiten-Anteile in Prozent. */
export function mealSplitSum(m: MealSplit): number {
  return m.breakfast + m.lunch + m.dinner + m.snack
}

function normalizeSchedule(v: unknown): Schedule | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = (x: unknown) => (typeof x === 'string' && x ? x : null)
  if (s.type === 'weekdays' && Array.isArray(s.days)) {
    return { type: 'weekdays', days: Array.from({ length: 7 }, (_, i) => id((s.days as unknown[])[i])) }
  }
  if (s.type === 'rotation' && Array.isArray(s.steps)) {
    const steps = (s.steps as unknown[]).slice(0, 14).map(id)
    const a = s.anchor as Record<string, unknown> | null | undefined
    const anchor =
      a && typeof a.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && steps.length > 0
        ? { stepIndex: num(a.stepIndex, 0, steps.length - 1, 0), date: a.date }
        : null
    return { type: 'rotation', steps, anchor }
  }
  if (s.type === 'flexible') return { type: 'flexible', perWeek: num(s.perWeek, 1, 7, 3) }
  return null
}

/** Beliebiges (DB-/localStorage-)Objekt → gültige Einstellungen mit Standardwerten. */
export function normalizePrefs(raw: unknown): UserPrefs {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  let mealSplit = DEFAULT_MEAL_SPLIT
  const m = r.mealSplit as Record<string, unknown> | undefined
  if (m && typeof m === 'object') {
    const cand: MealSplit = {
      breakfast: num(m.breakfast, 0, 100, -1),
      lunch: num(m.lunch, 0, 100, -1),
      dinner: num(m.dinner, 0, 100, -1),
      snack: num(m.snack, 0, 100, -1),
    }
    if (Object.values(cand).every((x) => x >= 0) && mealSplitSum(cand) === 100) mealSplit = cand
  }
  return {
    schedule: normalizeSchedule(r.schedule),
    kcalBonus: num(r.kcalBonus, 0, 600, DEFAULT_KCAL_BONUS),
    mealSplit,
    dayCutoff: num(r.dayCutoff, 0, 6, DAY_CUTOFF_H),
  }
}
