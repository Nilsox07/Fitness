// Schlafbedarf für heute Nacht + Journal-Auswertung (Logik in src/lib/sleepNeed.ts und src/lib/journal.ts).

import { useMemo } from 'react'
import { usePrefs } from '../lib/prefs'
import { localDate } from '../lib/day'
import { isPerformed } from '../lib/analytics'
import { dailyLoad, loadByDay, readinessHistory } from '../lib/insights'
import { bedtimePlan, sleepEfficiency, sleepNeed, typicalWake, type SleepNeed } from '../lib/sleepNeed'
import { buildOutcomes, habitImpacts, trackedHabits, type HabitImpact } from '../lib/journal'
import { useHealthActivities, useHealthDaily, useHealthSleep } from './useHealth'
import { useAllSets } from './useWorkouts'
import { useUserPrefs } from './usePrefsSync'
import { useJournal } from './useJournal'

export interface SleepPlan extends SleepNeed {
  bedAt: string
  wake: string
  /** Aufstehzeit aus den letzten Nächten geschätzt (nicht selbst eingestellt) */
  wakeAuto: boolean
  inBedMin: number
}

/** Kraft-Arbeitssätze je Datum (ohne Aufwärmen). */
function useSetDates(): string[] {
  const { data: sets } = useAllSets()
  return useMemo(() => (sets ?? []).filter((s) => s.set_type !== 'warmup' && isPerformed(s)).map((s) => s.date), [sets])
}

/** Schlafbedarf + Zubettgehzeit für heute Nacht (nur mit Uhr). */
export function useSleepPlan(): SleepPlan | null {
  const { hasWatch } = usePrefs()
  const { prefs } = useUserPrefs()
  const { data: sleep } = useHealthSleep(30)
  const { data: acts } = useHealthActivities(30)
  const setDates = useSetDates()
  const today = localDate()
  return useMemo(() => {
    if (!hasWatch || !sleep) return null
    const need = sleepNeed({
      baseMin: prefs.sleepGoalMin,
      today,
      load: dailyLoad(acts ?? [], setDates),
      sleep,
    })
    const auto = typicalWake(sleep, today)
    const wake = prefs.wakeTime ?? auto ?? '7:00'
    const plan = bedtimePlan(need.needMin, wake, sleepEfficiency(sleep, today))
    return { ...need, ...plan, wake: wake.replace(/^0(\d)/, '$1'), wakeAuto: !prefs.wakeTime }
  }, [hasWatch, sleep, acts, setDates, prefs.sleepGoalMin, prefs.wakeTime, today])
}

/** Wirkung der Journal-Gewohnheiten auf Schlaf, Erholung und das Gefühl am Morgen. */
export function useJournalImpacts(): { impacts: HabitImpact[]; loading: boolean } {
  const { hasWatch } = usePrefs()
  const { prefs } = useUserPrefs()
  const { data: entries } = useJournal()
  const { data: sleep } = useHealthSleep(60)
  const { data: daily } = useHealthDaily(120)
  const { data: acts } = useHealthActivities(60)
  const setDates = useSetDates()
  const today = localDate()
  const impacts = useMemo(() => {
    const s = hasWatch ? (sleep ?? []) : []
    const d = hasWatch ? (daily ?? []) : []
    const readiness = hasWatch
      ? readinessHistory(
          d,
          s,
          loadByDay(acts ?? [], setDates),
          s.map((n) => n.date),
          prefs.sleepGoalMin,
        )
      : new Map<string, number>()
    const outcomes = buildOutcomes({ sleep: s, daily: d, readiness, entries: entries ?? [] })
    const auto = new Map<string, string[]>()
    for (const date of new Set(setDates)) auto.set(date, ['trained'])
    const habits = [...trackedHabits(prefs.journalHabits), ...(setDates.length ? ['trained'] : [])]
    return habitImpacts(entries ?? [], outcomes, habits, today, auto, 60)
  }, [hasWatch, sleep, daily, acts, setDates, entries, prefs.journalHabits, prefs.sleepGoalMin, today])
  return { impacts, loading: entries === undefined }
}
