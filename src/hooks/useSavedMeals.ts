import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { normalizeItems, type SavedMeal, type SavedMealItem } from '../lib/savedMeals'
import type { Meal } from '../types'

const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /saved_meals/.test(e.message ?? ''))

const NOT_READY = 'Mahlzeiten speichern ist noch nicht eingerichtet (Migration 0042).'

/** Gespeicherte Mahlzeiten; ohne Migration einfach leer. */
export function useSavedMeals() {
  return useQuery({
    queryKey: ['saved_meals'],
    queryFn: async (): Promise<SavedMeal[]> => {
      const { data, error } = await supabase.from('saved_meals').select('*').order('created_at', { ascending: false })
      if (error) {
        if (missing(error)) return []
        throw error
      }
      return (data as SavedMeal[]).map((m) => ({ ...m, items: normalizeItems(m.items) }))
    },
  })
}

export function useAddSavedMeal() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { name: string; meal: Meal; items: SavedMealItem[] }) => {
      const { error } = await supabase.from('saved_meals').insert({ ...input, user_id: user!.id })
      if (error) throw missing(error) ? new Error(NOT_READY) : error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved_meals'] }),
  })
}

export function useDeleteSavedMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_meals').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['saved_meals'] })
      const prev = qc.getQueryData<SavedMeal[]>(['saved_meals'])
      qc.setQueryData<SavedMeal[]>(
        ['saved_meals'],
        (prev ?? []).filter((m) => m.id !== id),
      )
      return { prev }
    },
    onError: (_e, _id, ctx) => ctx && qc.setQueryData(['saved_meals'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved_meals'] }),
  })
}
