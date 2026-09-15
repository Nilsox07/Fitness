import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MK, type SetInput, type SetPatch } from '../lib/mutationDefaults'
import type { SetWithDate, Workout, WorkoutSet } from '../types'

export type { SetInput } from '../lib/mutationDefaults'

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
export function useCreateWorkout() {
  return useMutation<Workout, Error, { date: string; name?: string | null }>({
    mutationKey: MK.workoutCreate,
  })
}

export function useAddSet() {
  return useMutation<WorkoutSet, Error, SetInput>({ mutationKey: MK.setAdd })
}

/** Mehrere Sätze auf einmal anlegen (z. B. die Satz-Vorlage). */
export function useAddSets() {
  return useMutation<WorkoutSet[], Error, SetInput[]>({ mutationKey: MK.setAddMany })
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
