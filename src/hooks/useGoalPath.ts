import { useMemo } from 'react'
import { useBodyWeights } from './useBodyWeight'
import { useNutritionSettings } from './useNutrition'
import { useUserPrefs } from './usePrefsSync'
import { goalPath, type GoalPath } from '../lib/goalPath'

/**
 * Ungefährer Weg zum Zielgewicht (Zielgewicht aus `profiles.prefs`, Ziel-Art aus den
 * Ernährungs-Einstellungen, Gewichte aus `body_weights`). Für Körper-Seite und Fortschritt-Kachel.
 */
export function useGoalPath(): GoalPath {
  const { data: weights } = useBodyWeights()
  const { data: settings } = useNutritionSettings()
  const { prefs } = useUserPrefs()
  return useMemo(
    () =>
      goalPath({
        weights: (weights ?? []).map((w) => ({ date: w.date, kg: Number(w.weight_kg) })),
        target: prefs.targetWeight,
        goal: settings?.goal ?? null,
        since: prefs.targetWeightSince,
      }),
    [weights, settings?.goal, prefs.targetWeight, prefs.targetWeightSince],
  )
}
