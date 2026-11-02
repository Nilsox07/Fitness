// Erkenntnisse aus allen vorhandenen Daten (Logik in src/lib/insights.ts).
// Uhr-Daten nur mit Smartwatch-Bereich, Essen nur mit Ernährungs-Bereich.

import { useMemo } from 'react'
import { usePrefs } from '../lib/prefs'
import { localDate } from '../lib/day'
import { estimateMaxHr } from '../lib/health'
import { isPerformed } from '../lib/analytics'
import { buildInsights, type Insight } from '../lib/insights'
import { useHealthActivities, useHealthDaily, useHealthSleep } from './useHealth'
import { useAllSets } from './useWorkouts'
import { useBodyWeights } from './useBodyWeight'
import { useAllFoodEntries, useNutritionSettings } from './useNutrition'

export function useInsights(): { insights: Insight[]; loading: boolean } {
  const { hasWatch, showNutrition } = usePrefs()
  const { data: acts } = useHealthActivities(60)
  const { data: sleep } = useHealthSleep(60)
  const { data: daily } = useHealthDaily(120)
  const { data: sets } = useAllSets()
  const { data: weights } = useBodyWeights()
  const { data: food } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()
  const today = localDate()

  const insights = useMemo(
    () =>
      buildInsights({
        today,
        hasWatch,
        activities: hasWatch ? acts : [],
        sleep: hasWatch ? sleep : [],
        daily: hasWatch ? daily : [],
        strengthSetDates: (sets ?? []).filter((s) => s.set_type !== 'warmup' && isPerformed(s)).map((s) => s.date),
        weights: (weights ?? []).map((w) => ({ date: w.date, kg: Number(w.weight_kg) })),
        food: showNutrition ? (food ?? []).map((e) => ({ date: e.date, kcal: e.kcal })) : [],
        sex: settings?.sex ?? null,
        age: settings?.age ?? null,
        maxHr: estimateMaxHr(settings?.age, acts ?? []),
      }),
    [today, hasWatch, showNutrition, acts, sleep, daily, sets, weights, food, settings],
  )
  return { insights, loading: sets === undefined || weights === undefined }
}
