// Persönliche Einstellungen der neuen App (Trainingsrhythmus, Kalorien-Bonus,
// Mahlzeiten-Aufteilung, Tageswechsel). Gespeichert in `profiles.prefs` (jsonb,
// Migration 0028); fehlt die Spalte noch, lokal als Fallback. Reine Logik hier.

import type { Meal } from '../types'
import { DAY_CUTOFF_H } from './day'
import type { Schedule } from './schedule'
import { NOTIFY_DEFAULTS, normalizeNotify, type NotifyPrefs } from './notify'
import { normalizePrestige, type PrestigeState } from './unlocks'
import type { CardioKind, CardioPlan, CardioType, FitGoal } from './onboarding'

/** Prozent je Mahlzeit (Summe = 100). */
export type MealSplit = Record<Meal, number>

export interface UserPrefs {
  schedule: Schedule | null
  /** Zusätzliche kcal an Trainingstagen (0–600). */
  kcalBonus: number
  mealSplit: MealSplit
  /** Stunde (0–6), ab der ein neuer Trainings-Tag beginnt. */
  dayCutoff: number
  /** Push-Erinnerungen je Art (Profil → Benachrichtigungen) */
  notify: NotifyPrefs
  /** Zeitzone des Geräts – der Server rechnet die Uhrzeiten damit um */
  tz: string | null
  /** Prestige-Runden ab Level 50 */
  prestige: PrestigeState
  /** jemals erreichte Erfolge (bleiben, auch wenn z. B. die Serie reißt) */
  achievements: string[]
  /** Reihenfolge der Widgets auf „Heute“ (null = Standard je nach Modulen) */
  dashboard: string[] | null
  /** Intro beim ersten Start durchlaufen (oder übersprungen) */
  onboarded: boolean
  /** Ziel aus dem Intro */
  fitGoal: FitGoal | null
  /** Ausdauer-Plan aus dem Intro (null = keiner) */
  cardioPlan: CardioPlan | null
  /** Tage (YYYY-MM-DD), an denen die Ausdauer-Einheit abgehakt wurde */
  cardioDone: string[]
  /** Cheat-Meals den Freunden melden (nur mit Community) – Standard aus */
  shareCheat: boolean
  /** Eingeschaltete Module (für den Server, z. B. Erinnerungen); null = noch nie gespeichert */
  modules: Modules | null
  /** Zuletzt gesehene „Was ist neu?“-Version (geräteübergreifend) */
  seenVersion: string | null
}

export interface Modules {
  nutrition: boolean
  social: boolean
  watch: boolean
}

export const DEFAULT_KCAL_BONUS = 250
export const DEFAULT_MEAL_SPLIT: MealSplit = { breakfast: 25, lunch: 35, dinner: 30, snack: 10 }

export const DEFAULT_PREFS: UserPrefs = {
  schedule: null,
  kcalBonus: DEFAULT_KCAL_BONUS,
  mealSplit: DEFAULT_MEAL_SPLIT,
  dayCutoff: DAY_CUTOFF_H,
  notify: NOTIFY_DEFAULTS,
  tz: null,
  prestige: { count: 0, xpOffset: 0 },
  achievements: [],
  dashboard: null,
  onboarded: false,
  fitGoal: null,
  cardioPlan: null,
  cardioDone: [],
  shareCheat: false,
  modules: null,
  seenVersion: null,
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

const FIT_GOALS: FitGoal[] = ['muscle', 'lose', 'fit', 'strength', 'endurance']
const CARDIO_KINDS: CardioKind[] = ['run', 'bike', 'walk', 'any']
const CARDIO_TYPES: CardioType[] = ['easy', 'interval', 'long']

function normalizeCardioPlan(v: unknown): CardioPlan | null {
  if (!v || typeof v !== 'object') return null
  const p = v as Record<string, unknown>
  if (!CARDIO_KINDS.includes(p.kind as CardioKind) || !Array.isArray(p.sessions)) return null
  const sessions = (p.sessions as unknown[])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      day: num(x.day, 0, 6, 0),
      kind: CARDIO_KINDS.includes(x.kind as CardioKind) ? (x.kind as CardioKind) : (p.kind as CardioKind),
      type: CARDIO_TYPES.includes(x.type as CardioType) ? (x.type as CardioType) : 'easy',
      minutes: num(x.minutes, 5, 240, 30),
    }))
    .slice(0, 7)
  return sessions.length ? { kind: p.kind as CardioKind, sessions } : null
}

function normalizeModules(v: unknown): Modules | null {
  if (!v || typeof v !== 'object') return null
  const m = v as Record<string, unknown>
  if (typeof m.nutrition !== 'boolean' || typeof m.social !== 'boolean' || typeof m.watch !== 'boolean') return null
  return { nutrition: m.nutrition, social: m.social, watch: m.watch }
}

export const sameModules = (a: Modules | null, b: Modules | null): boolean =>
  !!a && !!b && a.nutrition === b.nutrition && a.social === b.social && a.watch === b.watch

/**
 * Module mit dem Konto abgleichen: Auf einem neuen Gerät die gespeicherten übernehmen
 * ('adopt'), sonst die Geräte-Einstellung ins Konto schreiben ('push').
 */
export function modulesSyncAction(
  local: Modules,
  remote: Modules | null,
  deviceSynced: boolean,
): 'adopt' | 'push' | 'none' {
  if (!remote) return 'push'
  if (sameModules(local, remote)) return 'none'
  return deviceSynced ? 'push' : 'adopt'
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
    notify: normalizeNotify(r.notify),
    tz: typeof r.tz === 'string' && r.tz.length < 64 ? r.tz : null,
    prestige: normalizePrestige(r.prestige),
    achievements: Array.isArray(r.achievements)
      ? [...new Set(r.achievements.filter((a): a is string => typeof a === 'string' && a.length < 40))]
      : [],
    dashboard: Array.isArray(r.dashboard)
      ? [...new Set(r.dashboard.filter((a): a is string => typeof a === 'string' && a.length < 40))].slice(0, 40)
      : null,
    onboarded: r.onboarded === true,
    fitGoal: FIT_GOALS.includes(r.fitGoal as FitGoal) ? (r.fitGoal as FitGoal) : null,
    cardioPlan: normalizeCardioPlan(r.cardioPlan),
    cardioDone: Array.isArray(r.cardioDone)
      ? [...new Set(r.cardioDone.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))]
          .sort()
          .slice(-60)
      : [],
    shareCheat: r.shareCheat === true,
    modules: normalizeModules(r.modules),
    seenVersion: typeof r.seenVersion === 'string' && r.seenVersion.length < 20 ? r.seenVersion : null,
  }
}
