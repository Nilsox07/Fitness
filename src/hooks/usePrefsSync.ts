// Persönliche Einstellungen (Trainingsrhythmus, Kalorien-Bonus, Mahlzeiten-
// Aufteilung, Tageswechsel) — gespeichert in `profiles.prefs` (Migration 0028).
//
// Die Migration wird manuell ausgeführt. Fehlt die Spalte noch, landen die
// Einstellungen lokal in `user_prefs_fallback` und alles funktioniert weiter.
// Sobald die Spalte existiert, wird der Fallback beim nächsten Laden in die DB
// übernommen und gelöscht.

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'
import { setDayCutoff } from '../lib/day'
import { DEFAULT_KCAL_BONUS, DEFAULT_MEAL_SPLIT, DEFAULT_PREFS, normalizePrefs, type MealSplit, type UserPrefs } from '../lib/userPrefs'
import { buildHistory, sanitizeSchedule, todayPlan, weeklyGoal, type HistoryEntry, type Schedule, type TodayPlan } from '../lib/schedule'
import { getPlanQueue } from '../lib/workoutSession'
import { usePlans } from './usePlans'
import { useAllSets, useWorkouts } from './useWorkouts'

const FALLBACK_KEY = 'user_prefs_fallback'
const CACHE_KEY = 'user_prefs_cache'

/** Woher kommen die Einstellungen? 'db' = profiles.prefs, 'local' = Spalte fehlt noch. */
export type PrefsSource = 'db' | 'local'

interface PrefsData {
  prefs: UserPrefs
  source: PrefsSource
}

interface Stored {
  userId: string
  prefs: Partial<UserPrefs>
}

function readStored(key: string, userId: string): Partial<UserPrefs> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw) as Stored
    return s && s.userId === userId && s.prefs && typeof s.prefs === 'object' ? s.prefs : null
  } catch {
    return null
  }
}

function writeStored(key: string, userId: string, prefs: Partial<UserPrefs> | null) {
  try {
    if (prefs == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify({ userId, prefs } satisfies Stored))
  } catch {
    /* ignore */
  }
}

/** Fehler „Spalte prefs existiert nicht" (Migration 0028 noch nicht ausgeführt)? */
function isMissingColumn(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  return e.code === '42703' || e.code === 'PGRST204' || /\bprefs\b/.test(e.message ?? '')
}

/** Lokale Spiegel aktualisieren (schneller Start + Tageswechsel für Nicht-React-Code). */
function mirror(userId: string, prefs: UserPrefs) {
  writeStored(CACHE_KEY, userId, prefs)
  setDayCutoff(prefs.dayCutoff)
}

async function writeDb(userId: string, prefs: UserPrefs) {
  return supabase.from('profiles').upsert({ id: userId, prefs })
}

async function loadPrefs(userId: string): Promise<PrefsData> {
  const fallback = readStored(FALLBACK_KEY, userId)
  const { data, error } = await supabase.from('profiles').select('prefs').eq('id', userId).maybeSingle()

  if (error) {
    if (!isMissingColumn(error)) throw error
    const prefs = normalizePrefs(fallback ?? readStored(CACHE_KEY, userId) ?? {})
    mirror(userId, prefs)
    return { prefs, source: 'local' }
  }

  const row = data as { prefs?: unknown } | null
  if (row && !('prefs' in row)) {
    // Sehr alte API-Antwort ohne Spalte → wie fehlende Migration behandeln
    const prefs = normalizePrefs(fallback ?? {})
    mirror(userId, prefs)
    return { prefs, source: 'local' }
  }

  const db = (row?.prefs ?? {}) as Partial<UserPrefs>
  if (fallback) {
    // Spalte existiert jetzt: lokale Einstellungen übernehmen und Fallback löschen
    const prefs = normalizePrefs({ ...db, ...fallback })
    const res = await writeDb(userId, prefs)
    if (!res.error) writeStored(FALLBACK_KEY, userId, null)
    mirror(userId, prefs)
    return { prefs, source: 'db' }
  }
  const prefs = normalizePrefs(db)
  mirror(userId, prefs)
  return { prefs, source: 'db' }
}

/**
 * Eigene Einstellungen lesen + speichern. `save(patch)` aktualisiert sofort
 * (optimistisch) und schreibt in die DB bzw. lokal, solange die Spalte fehlt.
 */
export function useUserPrefs(): {
  prefs: UserPrefs
  save: (patch: Partial<UserPrefs>) => Promise<void>
  source: PrefsSource | null
  isLoading: boolean
  /** Erster Abruf abgeschlossen (Erfolg oder Fehler) — erst dann Formulare befüllen. */
  ready: boolean
} {
  const { user } = useAuth()
  const qc = useQueryClient()
  const uid = user?.id ?? null
  const key = useMemo(() => ['user_prefs', uid] as const, [uid])

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(uid),
    queryFn: () => loadPrefs(uid!),
    staleTime: 5 * 60 * 1000,
    placeholderData: () => {
      if (!uid) return undefined
      const cached = readStored(FALLBACK_KEY, uid) ?? readStored(CACHE_KEY, uid)
      return cached ? { prefs: normalizePrefs(cached), source: 'local' as const } : undefined
    },
  })

  const save = useCallback(
    async (patch: Partial<UserPrefs>) => {
      if (!uid) return
      const cur = qc.getQueryData<PrefsData>(key) ?? query.data ?? { prefs: DEFAULT_PREFS, source: 'local' as const }
      const next = normalizePrefs({ ...cur.prefs, ...patch })
      qc.setQueryData<PrefsData>(key, { prefs: next, source: cur.source })
      mirror(uid, next)

      if (cur.source === 'db' || query.isPlaceholderData || !query.data) {
        const res = await writeDb(uid, next)
        if (!res.error) {
          writeStored(FALLBACK_KEY, uid, null)
          qc.setQueryData<PrefsData>(key, { prefs: next, source: 'db' })
          return
        }
        // Spalte fehlt oder offline → lokal merken; wird später übernommen
        if (isMissingColumn(res.error)) qc.setQueryData<PrefsData>(key, { prefs: next, source: 'local' })
      }
      writeStored(FALLBACK_KEY, uid, next)
    },
    [uid, qc, key, query.data, query.isPlaceholderData],
  )

  return {
    prefs: query.data?.prefs ?? DEFAULT_PREFS,
    save,
    source: query.isPlaceholderData ? null : (query.data?.source ?? null),
    isLoading: query.isLoading,
    ready: query.isFetched || !uid,
  }
}

/**
 * Ernährungs-Werte aus den Einstellungen — nur im Neu-Modus, klassisch bleiben
 * die festen Standardwerte (250 kcal, 25/35/30/10).
 */
export function useNutritionPrefs(): { kcalBonus: number; mealSplit: MealSplit } {
  const { isNew } = usePrefs()
  const { prefs } = useUserPrefs()
  return isNew
    ? { kcalBonus: prefs.kcalBonus, mealSplit: prefs.mealSplit }
    : { kcalBonus: DEFAULT_KCAL_BONUS, mealSplit: DEFAULT_MEAL_SPLIT }
}

/** Persönliches Wochenziel (aus dem Rhythmus; klassisch / ohne Rhythmus: 3). */
export function useWeeklyGoal(): number {
  const { isNew } = usePrefs()
  const { prefs } = useUserPrefs()
  return isNew ? weeklyGoal(prefs.schedule) : weeklyGoal(null)
}

/**
 * Trainingsrhythmus mit Bezug zu den echten Trainings: bereinigter Rhythmus
 * (gelöschte Pläne fallen raus), Trainings-Historie mit Plan-Zuordnung und
 * was heute (`today` = Trainings-Tag) ansteht.
 */
export function useTrainingRhythm(today: string): {
  schedule: Schedule | null
  history: HistoryEntry[]
  today: TodayPlan
  goal: number
  /** Pläne geladen und Rhythmus bekannt */
  ready: boolean
} {
  const { prefs, isLoading } = useUserPrefs()
  const { data: plans } = usePlans()
  const { data: workouts } = useWorkouts()
  const { data: allSets } = useAllSets()

  const schedule = useMemo(
    () => (plans ? sanitizeSchedule(prefs.schedule, new Set(plans.map((p) => p.id))) : prefs.schedule),
    [plans, prefs.schedule],
  )

  const history = useMemo(() => {
    const queueByDate = new Map<string, string>()
    for (const w of workouts ?? []) {
      const q = getPlanQueue(w.id)
      if (q) queueByDate.set(w.date, q.planId)
    }
    return buildHistory(plans ?? [], allSets ?? [], queueByDate)
  }, [plans, workouts, allSets])

  return {
    schedule,
    history,
    today: todayPlan(schedule, history, today),
    goal: weeklyGoal(schedule),
    ready: Boolean(plans) && !isLoading,
  }
}
