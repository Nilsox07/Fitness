import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { FoodEntry, NutritionSettings } from '../types'

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

export type FoodEntryInput = Pick<
  FoodEntry,
  'date' | 'name' | 'amount_g' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'barcode'
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
    onSuccess: (e) => qc.invalidateQueries({ queryKey: ['food_entries', e.date] }),
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
    onSuccess: (e) => qc.invalidateQueries({ queryKey: ['food_entries', e.date] }),
  })
}
