import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { MUSCLE_GROUPS } from '../types'
import type { SharedExercise } from './useFeed'

/**
 * Training eines Freundes als eigenen Plan übernehmen: gleichnamige eigene
 * Übungen werden wiederverwendet, fehlende angelegt. Gibt die Plan-ID zurück.
 */
export function useCopyWorkout() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { name: string; exercises: SharedExercise[] }): Promise<string> => {
      const { data: own, error: ownErr } = await supabase.from('exercises').select('id, name')
      if (ownErr) throw ownErr
      const byName = new Map((own ?? []).map((e) => [String(e.name).trim().toLowerCase(), e.id as string]))

      const ids: string[] = []
      for (const ex of input.exercises) {
        const key = ex.name.trim().toLowerCase()
        let id = byName.get(key)
        if (!id) {
          const muscle = (MUSCLE_GROUPS as readonly string[]).includes(ex.muscle_group ?? '') ? ex.muscle_group : undefined
          const { data, error } = await supabase
            .from('exercises')
            .insert({ user_id: user!.id, name: ex.name.trim(), ...(muscle ? { muscle_group: muscle } : {}) })
            .select('id')
            .single()
          if (error) throw error
          id = data.id as string
          byName.set(key, id)
        }
        if (!ids.includes(id)) ids.push(id)
      }

      const { data: plan, error: planErr } = await supabase
        .from('plans')
        .insert({ user_id: user!.id, name: input.name, position: 9999 })
        .select('id')
        .single()
      if (planErr) throw planErr
      if (ids.length) {
        const { error } = await supabase
          .from('plan_exercises')
          .insert(ids.map((exercise_id, position) => ({ user_id: user!.id, plan_id: plan.id, exercise_id, position })))
        if (error) throw error
      }
      return plan.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      qc.invalidateQueries({ queryKey: ['exercises'] })
    },
  })
}
