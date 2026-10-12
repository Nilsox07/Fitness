import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAllSets } from './useWorkouts'
import { useExercises } from './useExercises'
import { useAllFoodEntries, useNutritionSettings } from './useNutrition'
import { useAllWater } from './useWater'
import { useUserPrefs } from './usePrefsSync'
import { byDay } from '../lib/nutritionXp'
import { seasonProgress, type SeasonTheme } from '../lib/seasonTheme'
import { rememberSeasonBadge } from '../lib/seasonBadges'

async function fetchSeason(): Promise<SeasonTheme> {
  const r = await fetch('/api/season')
  if (!r.ok) throw new Error('Saison nicht verfügbar')
  return (await r.json()) as SeasonTheme
}

/** Saison des Monats (KI-Thema) mit Fortschritt; vergibt das Abzeichen beim Abschluss. */
export function useSeason() {
  const { data: theme } = useQuery({
    queryKey: ['season', new Date().toISOString().slice(0, 7)],
    queryFn: fetchSeason,
    staleTime: 1000 * 60 * 60 * 6,
    retry: 1,
  })
  const { data: sets } = useAllSets()
  const { data: exercises } = useExercises()
  const { data: food } = useAllFoodEntries()
  const { data: water } = useAllWater()
  const { data: settings } = useNutritionSettings()
  const { prefs, save, ready } = useUserPrefs()

  const progress = useMemo(() => {
    if (!theme) return null
    const muscle = new Map((exercises ?? []).map((e) => [e.id, e.muscle_group as string]))
    const drank = new Map<string, number>()
    for (const w of water ?? []) drank.set(w.date, (drank.get(w.date) ?? 0) + w.ml)
    for (const e of food ?? []) {
      const ml = (e as { fluid_ml?: number | null }).fluid_ml
      if (ml) drank.set(e.date, (drank.get(e.date) ?? 0) + ml)
    }
    return seasonProgress(theme, {
      sets: sets ?? [],
      muscleOf: (id) => muscle.get(id),
      foodDays: byDay(food ?? []),
      proteinTarget: settings?.protein_target ?? 0,
      drankByDate: drank,
      waterTarget: settings?.water_target_ml || 2500,
      today: new Date(),
    })
  }, [theme, sets, exercises, food, water, settings])

  const badgeId = theme ? `season-${theme.id}` : null
  const earned = !!badgeId && prefs.achievements.includes(badgeId)

  // Abzeichen vergeben, sobald alle Saison-Quests erledigt sind
  useEffect(() => {
    if (!theme || !badgeId || !progress?.done || !ready || !sets) return
    rememberSeasonBadge(badgeId, { emoji: theme.badge.emoji, label: theme.badge.label })
    if (!prefs.achievements.includes(badgeId)) void save({ achievements: [...prefs.achievements, badgeId] })
  }, [theme, badgeId, progress?.done, ready, sets, prefs.achievements, save])

  // Name/Emoji früherer Abzeichen merken (Anzeige ohne Netz)
  useEffect(() => {
    if (theme && earned && badgeId) rememberSeasonBadge(badgeId, theme.badge)
  }, [theme, earned, badgeId])

  return { theme: theme ?? null, progress, earned }
}
