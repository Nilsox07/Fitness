import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAllSets } from './useWorkouts'
import { useAllFoodEntries, useNutritionSettings } from './useNutrition'
import { useBodyScans } from './useBodyScans'
import { useUserPrefs } from './usePrefsSync'
import { frequencyStats, sessionDates } from '../lib/analytics'
import { byDay } from '../lib/nutritionXp'
import { daysBetween } from '../components/social/format'
import { achievementProgress, type AchievementId } from '../lib/unlocks'

/** Lokal mitgezählte Anstupser (Empfänger können Anstupser löschen). */
export const POKES_SENT_KEY = 'pokes_sent'

function localPokes(): number {
  try {
    return Number(localStorage.getItem(POKES_SENT_KEY) || '0') || 0
  } catch {
    return 0
  }
}

/**
 * Erfolge (verhaltensbasiert) mit Fortschritt. Einmal erreichte Erfolge werden im
 * Profil gemerkt (prefs.achievements) und bleiben – auch wenn z. B. die Serie reißt.
 */
export function useAchievements() {
  const { user } = useAuth()
  const { data: sets } = useAllSets()
  const { data: food } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()
  const { data: scans } = useBodyScans()
  const { prefs, save, ready } = useUserPrefs()

  const { data: pokesDb = 0 } = useQuery({
    queryKey: ['pokes_sent', user?.id],
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('pokes')
        .select('id', { count: 'exact', head: true })
        .eq('from_user', user!.id)
      return error ? 0 : (count ?? 0)
    },
  })

  const progress = useMemo(() => {
    const dates = sessionDates(sets ?? [])
    const target = settings?.protein_target ?? 0
    const proteinDays = target > 0 ? [...byDay(food ?? []).values()].filter((d) => d.protein >= target).length : 0
    const photos = (scans ?? [])
      .filter((s) => s.photo_path)
      .map((s) => s.date)
      .sort()
    return achievementProgress({
      sessions: dates.length,
      proteinDays,
      weekStreak: frequencyStats(dates).weekStreak,
      photoSpanDays: photos.length >= 2 ? daysBetween(photos[0], photos[photos.length - 1]) : 0,
      pokesSent: Math.max(pokesDb, localPokes()),
      prestige: prefs.prestige.count,
    })
  }, [sets, food, settings, scans, pokesDb, prefs.prestige.count])

  const earned = useMemo(() => {
    const set = new Set<string>(prefs.achievements)
    for (const [id, p] of Object.entries(progress)) if (p.done) set.add(id)
    return set
  }, [prefs.achievements, progress])

  // Neu erreichte Erfolge dauerhaft merken (erst wenn alle Daten da sind)
  useEffect(() => {
    if (!ready || !sets) return
    const fresh = (Object.keys(progress) as AchievementId[]).filter(
      (id) => progress[id].done && !prefs.achievements.includes(id),
    )
    if (fresh.length) void save({ achievements: [...prefs.achievements, ...fresh] })
  }, [ready, sets, progress, prefs.achievements, save])

  return { progress, earned }
}
