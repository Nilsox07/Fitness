import { useMemo } from 'react'
import { useAllSets } from './useWorkouts'
import { useAllFoodEntries, useFoodEntries, useNutritionSettings } from './useNutrition'
import { useWater } from './useWater'
import { useNutritionPrefs } from './usePrefsSync'
import { usePrefs } from '../lib/prefs'
import { localDate, trainingDay } from '../lib/day'
import { dailyQuests, weeklyQuests, type Quest } from '../lib/xp'
import { nutritionDailyQuests, nutritionWeeklyQuests } from '../lib/nutritionXp'
import { sumEntries } from '../lib/nutrition'
import { kcalTargetFor, trainedOn } from '../lib/dayTarget'
import { fluidTotal } from '../lib/fluid'

export interface QuestSet {
  daily: Quest[]
  weekly: Quest[]
}

/** Tages- und Wochenquests für Training und (falls aktiv) Ernährung – Quelle der Buddy-XP. */
export function useQuests(): { training: QuestSet; food: QuestSet | null } {
  const { showNutrition } = usePrefs()
  const { kcalBonus } = useNutritionPrefs()
  const { data: sets } = useAllSets()
  const { data: allEntries } = useAllFoodEntries()
  const foodDay = localDate()
  const { data: todayEntries } = useFoodEntries(foodDay)
  const { data: water } = useWater(foodDay)
  const { data: settings } = useNutritionSettings()
  const trainDay = trainingDay()

  return useMemo(() => {
    const s = sets ?? []
    const training = { daily: dailyQuests(s, trainDay), weekly: weeklyQuests(s, trainDay) }
    if (!showNutrition) return { training, food: null }
    const proteinTarget = settings?.protein_target ?? 0
    const totals = sumEntries(todayEntries ?? [])
    const food = {
      daily: nutritionDailyQuests({
        loggedToday: (todayEntries?.length ?? 0) > 0,
        protein: totals.protein,
        proteinTarget,
        kcal: totals.kcal,
        kcalTarget: kcalTargetFor(settings, trainedOn(foodDay, sets), kcalBonus),
        waterMl: (water?.ml ?? 0) + fluidTotal(todayEntries ?? []),
        waterTarget: settings?.water_target_ml || 2500,
      }),
      weekly: nutritionWeeklyQuests(allEntries ?? [], proteinTarget),
    }
    return { training, food }
  }, [sets, allEntries, todayEntries, water, settings, showNutrition, kcalBonus, trainDay, foodDay])
}
