// Kalorienziel je Tag – fest (Profil + Trainings-Bonus) oder nach Aktivität (src/lib/energy.ts).
// Schritte nur mit Uhr/Health-Connect-Bereich; ohne Schritte zählt die Alltags-Einstellung.

import { useCallback, useMemo } from 'react'
import { usePrefs } from '../lib/prefs'
import { localDate } from '../lib/day'
import { kcalTargetFor } from '../lib/dayTarget'
import { activityTarget, dayNeed, hasBody, stepsFor, type DayNeed, type TargetMode } from '../lib/energy'
import { useTrainingKcal } from './useTrainingKcal'
import { useNutritionSettings } from './useNutrition'
import { useHealthDaily } from './useHealth'
import { useUserPrefs } from './usePrefsSync'

export interface KcalTarget {
  /** Kalorienziel eines Tages (0 = kein Ziel gesetzt) */
  targetOn: (date: string) => number
  /** Bedarf eines Tages (null = Körperdaten fehlen) */
  needOn: (date: string) => DayNeed | null
  /** Gesamtverbrauch laut Uhr (falls geliefert) */
  watchTotalOn: (date: string) => number | null
  /** Wirksamer Modus (Aktivität nur mit vollständigen Körperdaten, nicht bei PSMF) */
  mode: TargetMode
  /** Trainings-Bonus (nur im festen Modus sichtbar) */
  bonusOn: (date: string) => number
}

export function useKcalTarget(): KcalTarget {
  const { hasWatch } = usePrefs()
  const { prefs } = useUserPrefs()
  const { data: settings } = useNutritionSettings()
  const { data: daily } = useHealthDaily(30)
  const { kgOn, burnedOn, bonusOn } = useTrainingKcal()
  const today = localDate()

  const steps = useMemo(
    () => new Map(hasWatch ? (daily ?? []).filter((d) => d.steps != null).map((d) => [d.date, d.steps!]) : []),
    [daily, hasWatch],
  )
  const totals = useMemo(
    () => new Map((daily ?? []).filter((d) => d.total_kcal).map((d) => [d.date, d.total_kcal as number])),
    [daily],
  )
  const canActivity = hasBody(settings) && settings?.diet_macro !== 'psmf'
  const mode: TargetMode = prefs.kcalTargetMode === 'activity' && canActivity ? 'activity' : 'fixed'

  const body = useCallback(
    (date: string) => (hasBody(settings) ? { ...settings, weight_kg: kgOn(date) } : null),
    [settings, kgOn],
  )
  const needOn = useCallback(
    (date: string) => {
      const b = body(date)
      return b ? dayNeed(b, stepsFor(date, today, steps), burnedOn(date)) : null
    },
    [body, steps, today, burnedOn],
  )
  const targetOn = useCallback(
    (date: string) => {
      const base = kcalTargetFor(settings, true, bonusOn(date))
      if (mode !== 'activity' || base <= 0) return base
      const b = body(date)
      return b ? activityTarget(b, stepsFor(date, today, steps), burnedOn(date)) : base
    },
    [settings, bonusOn, burnedOn, mode, body, steps, today],
  )
  const watchTotalOn = useCallback((date: string) => (hasWatch ? (totals.get(date) ?? null) : null), [totals, hasWatch])
  return { targetOn, needOn, watchTotalOn, mode, bonusOn }
}
