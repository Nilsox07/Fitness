// Alles, was „Heute“ und die Homescreen-Widgets brauchen, an einer Stelle.
// Ernährungs- und Uhr-Daten werden nur geladen, wenn die Module an sind.

import { useMemo } from 'react'
import { usePrefs } from '../lib/prefs'
import { localDate, shiftDate, trainingDay } from '../lib/day'
import { sumEntries } from '../lib/nutrition'
import { kcalTargetFor, trainedOn } from '../lib/dayTarget'
import { sessionDates } from '../lib/analytics'
import { weekStreakWithFreezes } from '../lib/streaks'
import { weekDates } from '../lib/home'
import {
  activityLoad,
  baseline,
  capabilities,
  cardioSummary,
  readiness,
  type Capabilities,
  type Readiness,
} from '../lib/health'
import { useFoodEntries, useNutritionSettings } from './useNutrition'
import { useWater } from './useWater'
import { useAllSets } from './useWorkouts'
import { usePlans } from './usePlans'
import { useStreakState } from './useStreak'
import { useNutritionPrefs, useTrainingRhythm } from './usePrefsSync'
import { useHealthActivities, useHealthDaily, useHealthSleep } from './useHealth'
import type { HealthActivity, HealthSleep } from '../types'

export interface TodaySummary {
  day: string
  trainingDay: string
  kcalEaten: number
  kcalTarget: number
  proteinEaten: number
  proteinTarget: number
  waterMl: number
  waterTarget: number
  nextWorkout: string | null
  restDay: boolean
  trainedToday: boolean
  streakWeeks: number
  weekDone: number
  weekGoal: number
  readiness: Readiness | null
  /** Was die Uhr überhaupt liefert (null ohne Uhr-Modul) */
  caps: Capabilities | null
  sleep: HealthSleep | null
  steps: number | null
  restingHr: number | null
  hrv: number | null
  lastActivity: HealthActivity | null
  cardioWeek: ReturnType<typeof cardioSummary> | null
  loading: boolean
}

export function useToday(): TodaySummary {
  const { showNutrition, hasWatch } = usePrefs()
  const day = localDate() // Ernährung zählt nach Kalendertag
  const tday = trainingDay()
  const yesterday = shiftDate(day, -1)

  const { data: allSets } = useAllSets()
  const { data: plans } = usePlans()
  const { data: streakState } = useStreakState()
  const rhythm = useTrainingRhythm(tday)
  const { kcalBonus } = useNutritionPrefs()
  const { data: settings } = useNutritionSettings()
  const { data: entries } = useFoodEntries(day)
  const { data: entriesY } = useFoodEntries(yesterday)
  const { data: water } = useWater(day)
  const { data: waterY } = useWater(yesterday)
  const { data: activities } = useHealthActivities(30)
  const { data: sleepList } = useHealthSleep(30)
  const { data: daily } = useHealthDaily(30)

  return useMemo(() => {
    const dates = sessionDates(allSets ?? [])
    const week = weekDates(tday)
    const totals = sumEntries(entries ?? [])
    const trainedToday = trainedOn(tday, allSets)
    const planName =
      rhythm.today.kind === 'train'
        ? ((plans ?? []).find((p) => rhythm.today.kind === 'train' && p.id === rhythm.today.planId)?.name ?? null)
        : null

    // Uhr: letzte Nacht, Schritte heute, Tagesform
    const sleep = hasWatch ? ((sleepList ?? []).find((s) => s.date === day) ?? null) : null
    const today = hasWatch ? ((daily ?? []).find((d) => d.date === day) ?? null) : null
    let ready: Readiness | null = null
    if (hasWatch) {
      // Belastung der letzten zwei Tage: gestern voll, vorgestern halb
      const before = shiftDate(yesterday, -1)
      const loadOn = (d: string) =>
        (activities ?? []).filter((a) => a.started_at.slice(0, 10) === d).reduce((s, a) => s + activityLoad(a), 0)
      const setsOn = (d: string) =>
        (allSets ?? []).filter((s) => s.date === d && s.set_type !== 'warmup' && (s.reps ?? 0) > 0).length
      const totY = sumEntries(entriesY ?? [])
      const targetY = kcalTargetFor(settings, trainedOn(yesterday, allSets), kcalBonus)
      const nutritionKnown = showNutrition && (entriesY?.length ?? 0) > 0
      ready = readiness({
        sleepMin: sleep?.asleep_min ?? null,
        hrv: today?.hrv_ms ?? null,
        hrvBaseline: baseline(daily ?? [], 'hrv_ms', day),
        restingHr: today?.resting_hr ?? null,
        restingHrBaseline: baseline(daily ?? [], 'resting_hr', day),
        cardioLoad: loadOn(yesterday) + loadOn(before) / 2,
        strengthSets: setsOn(yesterday) + setsOn(before) / 2,
        deepMin: sleep?.deep_min ?? null,
        waterRatioYesterday:
          showNutrition && waterY && settings?.water_target_ml ? waterY.ml / settings.water_target_ml : null,
        kcalBalanceYesterday: nutritionKnown && targetY ? totY.kcal - targetY : null,
        proteinRatioYesterday:
          nutritionKnown && settings?.protein_target ? totY.protein / settings.protein_target : null,
      })
    }

    return {
      day,
      trainingDay: tday,
      kcalEaten: Math.round(totals.kcal),
      kcalTarget: kcalTargetFor(settings, trainedOn(day, allSets), kcalBonus),
      proteinEaten: Math.round(totals.protein),
      proteinTarget: settings?.protein_target ?? 0,
      waterMl: water?.ml ?? 0,
      waterTarget: settings?.water_target_ml ?? 2500,
      nextWorkout: planName,
      restDay: rhythm.today.kind === 'rest',
      trainedToday,
      streakWeeks: weekStreakWithFreezes(dates, streakState?.frozen_weeks ?? []),
      weekDone: dates.filter((d) => week.includes(d)).length,
      weekGoal: rhythm.goal,
      readiness: ready,
      caps: hasWatch ? capabilities(daily ?? [], sleepList ?? [], activities ?? []) : null,
      sleep,
      steps: today?.steps ?? null,
      restingHr: today?.resting_hr ?? null,
      hrv: today?.hrv_ms ?? null,
      lastActivity: hasWatch ? ((activities ?? [])[0] ?? null) : null,
      cardioWeek: hasWatch ? cardioSummary(activities ?? [], week[0], week[6]) : null,
      loading: allSets === undefined,
    }
  }, [
    allSets,
    plans,
    streakState,
    rhythm.today,
    rhythm.goal,
    kcalBonus,
    settings,
    entries,
    entriesY,
    water,
    waterY,
    activities,
    sleepList,
    daily,
    hasWatch,
    showNutrition,
    day,
    tday,
    yesterday,
  ])
}
