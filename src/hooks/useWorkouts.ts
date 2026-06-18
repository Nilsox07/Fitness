import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { SetWithDate, Workout, WorkoutSet } from '../types'

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

export function useCreateWorkout() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { date: string; name?: string | null }) => {
      const { data, error } = await supabase
        .from('workouts')
        .insert({ user_id: user!.id, date: input.date, name: input.name ?? null })
        .select()
        .single()
      if (error) throw error
      return data as Workout
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })
}

export function useAddSet() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: {
      workout_id: string
      exercise_id: string
      set_number: number
      reps: number
      weight: number
    }) => {
      const { data, error } = await supabase
        .from('workout_sets')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as WorkoutSet
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['sets', 'workout', s.workout_id] })
      qc.invalidateQueries({ queryKey: ['sets', 'all'] })
    },
  })
}

export function useDeleteSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (set: WorkoutSet) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', set.id)
      if (error) throw error
      return set
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['sets', 'workout', s.workout_id] })
      qc.invalidateQueries({ queryKey: ['sets', 'all'] })
    },
  })
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
