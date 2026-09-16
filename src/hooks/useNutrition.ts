import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { judgeCheatMeal } from '../lib/ai'
import { notifyFriendsCheat, shareCheatEnabled } from '../lib/push'
import type { FoodEntry, NutritionSettings } from '../types'

/** Prüft ein geloggtes Lebensmittel und postet bei echten „Cheats" einen
 *  Freunde-Alarm (Feed + Push). Läuft im Hintergrund, Fehler werden ignoriert. */
async function maybePostCheat(entry: FoodEntry, userId: string, authorName: string | undefined, qc: QueryClient) {
  try {
    if (!shareCheatEnabled() || (entry.kcal ?? 0) < 400) return
    const res = await judgeCheatMeal({
      name: entry.name,
      kcal: entry.kcal,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
    })
    if (!res.indulgent) return
    const title = `🍕 ${entry.name}`
    const detail = `${Math.round(entry.kcal)} kcal${res.quip ? ` · ${res.quip}` : ''}`
    await supabase
      .from('activities')
      .insert({ user_id: userId, author_name: authorName ?? null, kind: 'cheat', title, detail })
    qc.invalidateQueries({ queryKey: ['activities'] })
    notifyFriendsCheat(`${authorName ?? 'Jemand'} hat gesündigt 🍕`, `${entry.name} · ${detail}`)
  } catch {
    /* egal */
  }
}

export function useNutritionSettings() {
  return useQuery({
    queryKey: ['nutrition_settings'],
    queryFn: async (): Promise<NutritionSettings | null> => {
      const { data, error } = await supabase.from('nutrition_settings').select('*').maybeSingle()
      if (error) throw error
      return (data as NutritionSettings | null) ?? null
    },
  })
}

export type NutritionSettingsInput = Omit<NutritionSettings, 'user_id' | 'updated_at'>

export function useUpsertNutritionSettings() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: NutritionSettingsInput) => {
      const { data, error } = await supabase
        .from('nutrition_settings')
        .upsert({ ...input, user_id: user!.id, updated_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data as NutritionSettings
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition_settings'] }),
  })
}

export function useFoodEntries(date: string) {
  return useQuery({
    queryKey: ['food_entries', date],
    queryFn: async (): Promise<FoodEntry[]> => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('date', date)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as FoodEntry[]
    },
  })
}

/** Alle Essens-Einträge (für die Auswertung / Tagesverlauf). */
export function useAllFoodEntries() {
  return useQuery({
    queryKey: ['food_entries', 'all'],
    queryFn: async (): Promise<FoodEntry[]> => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .order('date', { ascending: true })
      if (error) throw error
      return data as FoodEntry[]
    },
  })
}

export type FoodEntryInput = Pick<
  FoodEntry,
  'date' | 'name' | 'amount_g' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'barcode' | 'meal'
>

export function useAddFoodEntry() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: FoodEntryInput) => {
      const { data, error } = await supabase
        .from('food_entries')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as FoodEntry
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['food_entries'] })
      void maybePostCheat(s, user!.id, user?.email?.split('@')[0], qc)
    },
  })
}

export function useDeleteFoodEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: FoodEntry) => {
      const { error } = await supabase.from('food_entries').delete().eq('id', entry.id)
      if (error) throw error
      return entry
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food_entries'] }),
  })
}
