import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MK, withId, type SetInput, type SetPatch, type WorkoutInput } from '../lib/mutationDefaults'
import type { SetWithDate, Workout, WorkoutSet } from '../types'

export type { SetInput, WorkoutInput } from '../lib/mutationDefaults'
export { newId } from '../lib/mutationDefaults'

export function useWorkouts() {
  return useQuery({
    queryKey: ['workouts'],
    queryFn: async (): Promise<Workout[]> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Workout[]
    },
  })
}

export function useWorkoutSets(workoutId: string | undefined) {
  return useQuery({
    queryKey: ['sets', 'workout', workoutId],
    enabled: Boolean(workoutId),
    queryFn: async (): Promise<WorkoutSet[]> => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('workout_id', workoutId!)
        .order('exercise_id', { ascending: true })
        .order('set_number', { ascending: true })
      if (error) throw error
      return data as WorkoutSet[]
    },
  })
}

/** Alle Sätze (mit Workout-Datum) — Basis für die Auswertung. */
export function useAllSets() {
  return useQuery({
    queryKey: ['sets', 'all'],
    queryFn: async (): Promise<SetWithDate[]> => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*, workout:workouts!inner(date)')
      if (error) throw error
      return (data as (WorkoutSet & { workout: { date: string } })[]).map((s) => ({
        ...s,
        date: s.workout.date,
      }))
    },
  })
}

// Die Schreibvorgänge des Trainings-Pfads nutzen die zentral registrierten,
// wiederaufnehmbaren Defaults (siehe lib/mutationDefaults). Die Hooks sind
// deshalb nur dünne Wrapper über den jeweiligen mutationKey — so überleben
// offline gepufferte Sätze auch einen App-Neustart.
//
// Neue Trainings/Sätze bekommen ihre ID schon hier (im Client), damit sie in den
// persistierten Variablen steht: die UI kennt die Zeile sofort, und auch eine
// nach Reload fortgesetzte Mutation schreibt genau diese ID.
export function useCreateWorkout() {
  const m = useMutation<Workout, Error, WorkoutInput>({ mutationKey: MK.workoutCreate })
  return {
    ...m,
    mutate: (v: WorkoutInput, o?: Parameters<typeof m.mutate>[1]) => m.mutate(withId(v), o),
    mutateAsync: (v: WorkoutInput, o?: Parameters<typeof m.mutateAsync>[1]) => m.mutateAsync(withId(v), o),
  }
}

export function useAddSet() {
  const m = useMutation<WorkoutSet, Error, SetInput>({ mutationKey: MK.setAdd })
  return {
    ...m,
    mutate: (v: SetInput, o?: Parameters<typeof m.mutate>[1]) => m.mutate(withId(v), o),
    mutateAsync: (v: SetInput, o?: Parameters<typeof m.mutateAsync>[1]) => m.mutateAsync(withId(v), o),
  }
}

/** Mehrere Sätze auf einmal anlegen (z. B. die Satz-Vorlage). */
export function useAddSets() {
  const m = useMutation<WorkoutSet[], Error, SetInput[]>({ mutationKey: MK.setAddMany })
  return {
    ...m,
    mutate: (v: SetInput[], o?: Parameters<typeof m.mutate>[1]) => m.mutate(v.map(withId), o),
    mutateAsync: (v: SetInput[], o?: Parameters<typeof m.mutateAsync>[1]) =>
      m.mutateAsync(v.map(withId), o),
  }
}

export function useUpdateSet() {
  return useMutation<WorkoutSet, Error, SetPatch>({ mutationKey: MK.setUpdate })
}

export function useDeleteSet() {
  return useMutation<WorkoutSet, Error, WorkoutSet>({ mutationKey: MK.setDelete })
}

export function useDeleteWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['sets', 'all'] })
    },
  })
}
