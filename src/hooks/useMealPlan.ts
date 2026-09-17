import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { MealRoutine, PlanDay, SavedMealPlan, ShoppingCat } from '../types'

// ---- Routinen (feste, wiederkehrende Mahlzeiten) -------------------------

export function useMealRoutines() {
  return useQuery({
    queryKey: ['meal_routines'],
    queryFn: async (): Promise<MealRoutine[]> => {
      const { data, error } = await supabase
        .from('meal_routines')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as MealRoutine[]
    },
  })
}

export type MealRoutineInput = Pick<
  MealRoutine,
  'meal' | 'title' | 'kcal' | 'protein' | 'carbs' | 'fat'
>

export function useAddMealRoutine() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: MealRoutineInput) => {
      const { data, error } = await supabase
        .from('meal_routines')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as MealRoutine
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal_routines'] }),
  })
}

export function useDeleteMealRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_routines').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal_routines'] }),
  })
}

// ---- Gespeicherte Pläne ---------------------------------------------------

export function useMealPlans() {
  return useQuery({
    queryKey: ['meal_plans'],
    queryFn: async (): Promise<SavedMealPlan[]> => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SavedMealPlan[]
    },
  })
}

export interface MealPlanInput {
  name: string
  days: number
  plan: PlanDay[]
  shopping: ShoppingCat[]
}

export function useAddMealPlan() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: MealPlanInput) => {
      const { data, error } = await supabase
        .from('meal_plans')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as SavedMealPlan
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal_plans'] }),
  })
}

export function useUpdateMealPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<MealPlanInput>) => {
      const { data, error } = await supabase
        .from('meal_plans')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as SavedMealPlan
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal_plans'] }),
  })
}

export function useDeleteMealPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal_plans'] }),
  })
}
