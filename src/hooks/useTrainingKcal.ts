// Kalorien je Training (Kraft + Hybrid) und daraus der Kalorien-Bonus je Tag (Logik in src/lib/trainingKcal.ts).
// Uhr-Werte nur mit Uhr-Bereich, Hybrid-Einheiten nur mit Hybrid-Bereich.

import { useCallback, useMemo } from 'react'
import { usePrefs } from '../lib/prefs'
import { trainedOn } from '../lib/dayTarget'
import { templateById } from '../lib/hybridSessions'
import {
  dayBonus,
  hybridKcal,
  matchWatchKcal,
  strengthKcal,
  weightOn,
  withWatch,
  type BonusMode,
  type KcalEstimate,
} from '../lib/trainingKcal'
import { useAllSets } from './useWorkouts'
import { useExercises } from './useExercises'
import { useBodyWeights } from './useBodyWeight'
import { useNutritionSettings } from './useNutrition'
import { useHealthActivities } from './useHealth'
import { useUserPrefs } from './usePrefsSync'
import type { SetWithDate } from '../types'

export interface TrainingKcal {
  /** Schätzung je Training (workout_id) */
  byWorkout: Map<string, KcalEstimate>
  /** Mehrverbrauch an einem Tag (Kraft + Hybrid) */
  burnedOn: (date: string) => number
  /** Krafttraining eines Tages zusammengefasst (mehrere Einheiten addiert) */
  strengthOn: (date: string) => KcalEstimate | null
  /** Kalorien-Bonus für das Tagesziel */
  bonusOn: (date: string) => number
  mode: BonusMode
  /** Körpergewicht an einem Tag (für eigene Schätzungen) */
  kgOn: (date: string) => number
}

export function useTrainingKcal(): TrainingKcal {
  const { hasWatch, hasHybrid } = usePrefs()
  const { prefs } = useUserPrefs()
  const { data: allSets } = useAllSets()
  const { data: exercises } = useExercises()
  const { data: weights } = useBodyWeights()
  const { data: settings } = useNutritionSettings()
  const { data: acts } = useHealthActivities(60)

  const { byWorkout, byDate, strengthByDate } = useMemo(() => {
    const muscle = new Map((exercises ?? []).map((e) => [e.id, e.muscle_group as string]))
    const kgList = (weights ?? []).map((w) => ({ date: w.date, kg: Number(w.weight_kg) }))
    const groups = new Map<string, SetWithDate[]>()
    for (const s of allSets ?? []) {
      const g = groups.get(s.workout_id)
      if (g) g.push(s)
      else groups.set(s.workout_id, [s])
    }
    const byWorkout = new Map<string, KcalEstimate>()
    const byDate = new Map<string, number>()
    const strengthByDate = new Map<string, KcalEstimate>()
    for (const [id, sets] of groups) {
      const date = sets[0].date
      const kg = weightOn(date, kgList, settings?.weight_kg)
      const est = strengthKcal(sets, kg, (ex) => muscle.get(ex))
      if (!est) continue
      const e = hasWatch ? withWatch(est, matchWatchKcal(acts ?? [], sets)) : est
      byWorkout.set(id, e)
      byDate.set(date, (byDate.get(date) ?? 0) + e.kcal)
      const prev = strengthByDate.get(date)
      strengthByDate.set(
        date,
        prev
          ? {
              kcal: prev.kcal + e.kcal,
              lo: prev.lo + e.lo,
              hi: prev.hi + e.hi,
              minutes: prev.minutes + e.minutes,
              source: prev.source === 'estimate' || e.source === 'estimate' ? 'estimate' : e.source,
            }
          : e,
      )
    }
    if (hasHybrid)
      for (const r of prefs.hybridRuns) {
        const t = templateById(r.template)
        if (!t) continue
        const e = hybridKcal(t, r.splits, weightOn(r.date, kgList, settings?.weight_kg))
        byDate.set(r.date, (byDate.get(r.date) ?? 0) + e.kcal)
      }
    return { byWorkout, byDate, strengthByDate }
  }, [allSets, exercises, weights, settings?.weight_kg, acts, hasWatch, hasHybrid, prefs.hybridRuns])

  const strengthOn = useCallback((date: string) => strengthByDate.get(date) ?? null, [strengthByDate])
  const burnedOn = useCallback((date: string) => byDate.get(date) ?? 0, [byDate])
  const bonusOn = useCallback(
    (date: string) => {
      const burned = byDate.get(date) ?? 0
      const trained = prefs.kcalBonusMode === 'fixed' ? trainedOn(date, allSets) : burned > 0
      return dayBonus(prefs.kcalBonusMode, prefs.kcalBonus, trained, burned)
    },
    [byDate, allSets, prefs.kcalBonusMode, prefs.kcalBonus],
  )
  const kgOn = useCallback(
    (date: string) =>
      weightOn(
        date,
        (weights ?? []).map((w) => ({ date: w.date, kg: Number(w.weight_kg) })),
        settings?.weight_kg,
      ),
    [weights, settings?.weight_kg],
  )
  return { byWorkout, burnedOn, strengthOn, bonusOn, mode: prefs.kcalBonusMode, kgOn }
}
