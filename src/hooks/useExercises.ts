import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Exercise } from '../types'

export function useExercises() {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data as Exercise[]
    },
  })
}

export type ExerciseInput = Pick<
  Exercise,
  | 'name'
  | 'muscle_group'
  | 'notes'
  | 'target_rep_min'
  | 'target_rep_max'
  | 'increment'
  | 'unilateral'
>

export function useCreateExercise() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: ExerciseInput) => {
      const { data, error } = await supabase
        .from('exercises')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as Exercise
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useUpdateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: ExerciseInput & { id: string }) => {
      const { data, error } = await supabase
        .from('exercises')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Exercise
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercises').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] })
      qc.invalidateQueries({ queryKey: ['sets'] })
    },
  })
}
