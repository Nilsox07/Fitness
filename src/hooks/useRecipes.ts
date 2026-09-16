import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { SavedRecipe } from '../types'

/** Eigene + von Freunden geteilte Rezepte (per RLS gefiltert). */
export function useRecipes() {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: async (): Promise<SavedRecipe[]> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SavedRecipe[]
    },
  })
}

export type RecipeInput = Pick<
  SavedRecipe,
  | 'title'
  | 'servings'
  | 'ingredients'
  | 'steps'
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'sugar'
  | 'sat_fat'
  | 'salt'
  | 'shared'
> & { author_name?: string | null }

export function useAddRecipe() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: RecipeInput) => {
      const { data, error } = await supabase
        .from('recipes')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as SavedRecipe
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}

export function useToggleRecipeShared() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, shared }: { id: string; shared: boolean }) => {
      const { error } = await supabase.from('recipes').update({ shared }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}
