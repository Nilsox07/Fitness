import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAllSets } from '../../hooks/useWorkouts'
import { useExercises } from '../../hooks/useExercises'
import { useAllFoodEntries, useFoodEntries, useNutritionSettings } from '../../hooks/useNutrition'
import { useStreakState } from '../../hooks/useStreak'
import { usePrefs } from '../../lib/prefs'
import { getSkinId, mascotStageIndex } from '../../lib/cosmetics'
import { lastTrainedPerMuscle, sessionDates } from '../../lib/analytics'
import { weekStreakWithFreezes } from '../../lib/streaks'
import { weekPrCount } from '../../lib/weeklyReview'
import { recoveryLevel, sessionsInWeek } from '../../lib/home'
import { useWeeklyGoal } from '../../hooks/usePrefsSync'
import { localDate, trainingDay } from '../../lib/day'
import { buddyMood, type BuddyState } from '../../lib/buddyMood'
import { buddyXpParts, checkBuddyLevelUp } from '../../lib/buddyLevel'
import { levelInfo, type LevelInfo } from '../../lib/xp'
import { playLevelUp } from '../../lib/sound'

/** Event, das Profil/Sammlung nach einem Skin-Wechsel feuern. */
export const BUDDY_SKIN_EVENT = 'buddy-skin-change'

const SKIP_MUSCLES = new Set(['Sonstige', 'Ganzkörper'])

/** Gewählter Skin; aktualisiert sich bei Wechsel im Profil, Fokus oder anderem Tab. */
export function useBuddySkin(): string {
  const [skin, setSkin] = useState(getSkinId)
  useEffect(() => {
    const sync = () => setSkin(getSkinId())
    window.addEventListener(BUDDY_SKIN_EVENT, sync)
    window.addEventListener('focus', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(BUDDY_SKIN_EVENT, sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return skin
}

/** Aussehen des eigenen Buddys: Wachstumsstufe (Trainings gesamt) + Skin. */
export function useBuddyLook(): { stage: number; skin: string } {
  const { data: allSets } = useAllSets()
  const skin = useBuddySkin()
  const sessions = useMemo(() => sessionDates(allSets ?? []).length, [allSets])
  return { stage: mascotStageIndex(sessions), skin }
}

/** Stimmung + Spruch des eigenen Buddys aus den echten Daten. */
export function useBuddy(opts: { activeWorkout?: boolean } = {}): BuddyState & { stage: number; skin: string } {
  const { data: allSets } = useAllSets()
  const { data: exercises } = useExercises()
  const { data: streakState } = useStreakState()
  const { data: settings } = useNutritionSettings()
  const { data: food } = useFoodEntries(localDate())
  const { showNutrition } = usePrefs()
  const skin = useBuddySkin()
  const weeklyGoal = useWeeklyGoal()
  const today = trainingDay()

  const facts = useMemo(() => {
    const sets = allSets ?? []
    const dates = sessionDates(sets)
    const last = dates.filter((d) => d <= today).sort().pop() ?? null
    const daysSince =
      last == null ? null : Math.round((Date.parse(today) - Date.parse(last)) / 86400000)

    let allTired = false
    if (exercises && exercises.length) {
      const own = new Set(exercises.map((e) => e.muscle_group as string).filter((m) => !SKIP_MUSCLES.has(m)))
      const rec = lastTrainedPerMuscle(sets, exercises, new Date(today + 'T12:00:00')).filter((r) =>
        own.has(r.muscle),
      )
      allTired = own.size > 0 && rec.length === own.size && rec.every((r) => recoveryLevel(r.daysAgo) === 'tired')
    }

    return {
      sessions: dates.length,
      trainedToday: dates.includes(today),
      daysSince,
      weekly: sessionsInWeek(dates, today),
      pr: sets.length > 0 && weekPrCount(sets, today, today) > 0,
      streak: weekStreakWithFreezes(dates, streakState?.frozen_weeks ?? []),
      allTired,
    }
  }, [allSets, exercises, streakState, today])

  const protein = useMemo(() => (food ?? []).reduce((s, e) => s + (e.protein ?? 0), 0), [food])

  const state = buddyMood({
    activeWorkout: opts.activeWorkout,
    newPrToday: facts.pr,
    weeklySessions: facts.weekly,
    weeklyGoal,
    trainedToday: facts.trainedToday,
    daysSinceLastWorkout: facts.daysSince,
    recoveryAllTired: facts.allTired,
    showNutrition,
    hour: new Date().getHours(),
    proteinToday: protein,
    proteinTarget: settings?.protein_target ?? 0,
    streakWeeks: facts.streak,
    date: today,
  })

  return { ...state, stage: mascotStageIndex(facts.sessions), skin }
}

/**
 * Das eine Buddy-Level der neuen App: XP aus Training (+ Ernährung, wenn aktiv).
 * `ready` = alle nötigen Daten geladen (vorher nicht für Level-up-Vergleiche nutzen).
 */
export function useBuddyLevel(): LevelInfo & {
  ready: boolean
  sessions: number
  fitnessXp: number
  nutritionXp: number
} {
  const { data: sets } = useAllSets()
  const { data: food } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()
  const { showNutrition } = usePrefs()
  const proteinTarget = settings?.protein_target ?? 0
  const today = localDate()
  const parts = useMemo(
    () =>
      buddyXpParts({
        sets: sets ?? [],
        foodEntries: food ?? [],
        proteinTarget,
        showNutrition,
        today,
      }),
    [sets, food, proteinTarget, showNutrition, today],
  )
  const sessions = useMemo(() => sessionDates(sets ?? []).length, [sets])
  // settings: undefined = lädt noch, null = keine Einstellungen gespeichert
  const ready = Boolean(sets) && (!showNutrition || (Boolean(food) && settings !== undefined))
  return {
    ...levelInfo(parts.total),
    ready,
    sessions,
    fitnessXp: parts.fitness,
    nutritionXp: parts.nutrition,
  }
}

/**
 * Level-up-Feier des Buddy-Levels (einzige Quelle in der neuen App). Merkt sich den
 * gefeierten Level unter `seen_buddy_level`; beim ersten Start wird der aktuelle
 * Level übernommen, ohne zu feiern.
 */
export function useBuddyLevelUp() {
  const info = useBuddyLevel()
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (!info.ready) return
    if (checkBuddyLevelUp(info.level)) {
      setCelebrate(true)
      playLevelUp()
    }
  }, [info.level, info.ready])
  const dismiss = useCallback(() => setCelebrate(false), [])
  return { info, celebrate, dismiss }
}
