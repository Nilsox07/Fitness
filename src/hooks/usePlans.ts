import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { PlanWithExercises } from '../types'

type PlanRow = {
  id: string
  user_id: string
  name: string
  position: number
  created_at: string
  plan_exercises: { exercise_id: string; position: number }[]
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async (): Promise<PlanWithExercises[]> => {
      const { data, error } = await supabase
        .from('plans')
        .select('*, plan_exercises(exercise_id, position)')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as PlanRow[]).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        name: p.name,
        position: p.position,
        created_at: p.created_at,
        exercise_ids: [...(p.plan_exercises ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((pe) => pe.exercise_id),
      }))
    },
  })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { name: string; position: number }) => {
      const { data, error } = await supabase
        .from('plans')
        .insert({ user_id: user!.id, name: input.name, position: input.position })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function useRenamePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('plans').update({ name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function useAddPlanExercise() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { plan_id: string; exercise_id: string; position: number }) => {
      const { error } = await supabase.from('plan_exercises').insert({
        user_id: user!.id,
        plan_id: input.plan_id,
        exercise_id: input.exercise_id,
        position: input.position,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

export function useRemovePlanExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { plan_id: string; exercise_id: string }) => {
      const { error } = await supabase
        .from('plan_exercises')
        .delete()
        .eq('plan_id', input.plan_id)
        .eq('exercise_id', input.exercise_id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}

/** Reihenfolge der Übungen eines Plans neu setzen (Positionen per Übungs-ID). */
export function useReorderPlanExercises() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { plan_id: string; exercise_ids: string[] }) => {
      await Promise.all(
        input.exercise_ids.map((exercise_id, position) =>
          supabase
            .from('plan_exercises')
            .update({ position })
            .eq('plan_id', input.plan_id)
            .eq('exercise_id', exercise_id)
            .then(({ error }) => {
              if (error) throw error
            }),
        ),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}
