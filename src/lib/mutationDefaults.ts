import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Workout, WorkoutSet } from '../types'

// ---------------------------------------------------------------------------
// Wiederaufnehmbare Schreibvorgänge für den Trainings-Pfad.
//
// Diese Mutationen werden per mutationKey als Defaults am QueryClient
// registriert. Dadurch kann React Query sie nach einem App-Neustart aus dem
// (auf der Platte persistierten) Cache wieder aufnehmen — die mutationFn
// existiert dann auch ohne gemountete Komponente. So gehen Sätze, die offline
// erfasst wurden, selbst dann nicht verloren, wenn die App vorher geschlossen
// oder neu geladen wird.
// ---------------------------------------------------------------------------

export interface SetInput {
  workout_id: string
  exercise_id: string
  set_number: number
  reps: number
  weight: number
  reps_right?: number | null
  weight_right?: number | null
  set_type: WorkoutSet['set_type']
  to_failure: boolean
}

export type SetPatch = { id: string } & Partial<
  Pick<WorkoutSet, 'reps' | 'weight' | 'reps_right' | 'weight_right' | 'set_type' | 'to_failure'>
>

export const MK = {
  workoutCreate: ['workout', 'create'] as const,
  setAdd: ['sets', 'add'] as const,
  setAddMany: ['sets', 'addMany'] as const,
  setUpdate: ['sets', 'update'] as const,
  setDelete: ['sets', 'delete'] as const,
}

/** Aktuelle User-ID aus der (lokal gespeicherten) Supabase-Session — offline-fähig. */
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Nicht angemeldet')
  return id
}

export function registerMutationDefaults(qc: QueryClient) {
  const invalidateSets = (workoutId?: string) => {
    if (workoutId) qc.invalidateQueries({ queryKey: ['sets', 'workout', workoutId] })
    qc.invalidateQueries({ queryKey: ['sets', 'all'] })
  }

  qc.setMutationDefaults(MK.workoutCreate, {
    mutationFn: async (input: { date: string; name?: string | null }) => {
      const user_id = await currentUserId()
      const { data, error } = await supabase
        .from('workouts')
        .insert({ user_id, date: input.date, name: input.name ?? null })
        .select()
        .single()
      if (error) throw error
      return data as Workout
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })

  qc.setMutationDefaults(MK.setAdd, {
    mutationFn: async (input: SetInput) => {
      const user_id = await currentUserId()
      const { data, error } = await supabase
        .from('workout_sets')
        .insert({ ...input, user_id })
        .select()
        .single()
      if (error) throw error
      return data as WorkoutSet
    },
    onSuccess: (s) => invalidateSets((s as WorkoutSet).workout_id),
  })

  qc.setMutationDefaults(MK.setAddMany, {
    mutationFn: async (inputs: SetInput[]) => {
      const user_id = await currentUserId()
      const rows = inputs.map((i) => ({ ...i, user_id }))
      const { data, error } = await supabase.from('workout_sets').insert(rows).select()
      if (error) throw error
      return data as WorkoutSet[]
    },
    onSuccess: (rows) => invalidateSets((rows as WorkoutSet[])[0]?.workout_id),
  })

  qc.setMutationDefaults(MK.setUpdate, {
    mutationFn: async ({ id, ...patch }: SetPatch) => {
      const { data, error } = await supabase
        .from('workout_sets')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as WorkoutSet
    },
    onSuccess: (s) => invalidateSets((s as WorkoutSet).workout_id),
  })

  qc.setMutationDefaults(MK.setDelete, {
    mutationFn: async (set: WorkoutSet) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', set.id)
      if (error) throw error
      return set
    },
    onSuccess: (s) => invalidateSets((s as WorkoutSet).workout_id),
  })
}
