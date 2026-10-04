import { useState } from 'react'
import { useCreateExercise, useExercises } from '../../hooks/useExercises'
import { newId, useAddSets, useCreateWorkout, useWorkoutSets, useWorkouts, type SetInput } from '../../hooks/useWorkouts'
import {
  findLibraryMatch,
  getLinks,
  libraryToExerciseInput,
  setLink,
  type LibraryExercise,
} from '../../lib/exerciseLibrary'
import { trainingDay } from '../../lib/day'
import { estimateReps, workoutName } from '../../lib/quickWorkout'
import type { Exercise } from '../../types'
import type { QuickResult } from './QuickPlayer'

/**
 * Speichert ein Schnell-Workout als normales Training des heutigen Trainings-Tags
 * (zählt so für Streak, Duell und Buddy): je absolvierter Station und Runde ein
 * Arbeitssatz mit geschätzten Wiederholungen (Sekunden ÷ 3) und 0 kg.
 *
 * Fehlende eigene Übungen werden wie in der Bibliothek angelegt
 * (`libraryToExerciseInput` + Verknüpfung per `setLink`).
 */
export function useSaveQuickWorkout(list: LibraryExercise[] | null) {
  const today = trainingDay()
  const { data: workouts } = useWorkouts()
  const { data: mine } = useExercises()
  const todays = workouts?.find((w) => w.date === today)
  const { data: todaysSets } = useWorkoutSets(todays?.id)
  const createEx = useCreateExercise()
  const createWorkout = useCreateWorkout()
  const addSets = useAddSets()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = !!list && !!mine && !!workouts && (!todays || !!todaysSets)

  async function save(result: QuickResult, minutes: number) {
    if (!ready || saving || saved || result.work.length === 0) return
    setSaving(true)
    setError(null)
    try {
      // Bibliotheks-ID → eigene Übung (Verknüpfung oder gleicher Name)
      const links = getLinks()
      const owned = new Map<string, Exercise>()
      for (const ex of mine!) {
        const m = findLibraryMatch(ex, list!, links)
        if (m && !owned.has(m.id)) owned.set(m.id, ex)
      }
      for (const libId of new Set(result.work.map((w) => w.exerciseId))) {
        if (owned.has(libId)) continue
        const item = list!.find((e) => e.id === libId)
        if (!item) continue
        const created = await createEx.mutateAsync(libraryToExerciseInput(item))
        setLink(created.id, item.id)
        owned.set(libId, created)
      }

      // Heutiges Training (anhängen) oder neu anlegen. Bewusst `mutate`: offline
      // pausiert die Mutation, die Sätze laufen im selben Scope hinterher.
      let workoutId = todays?.id
      if (!workoutId) {
        workoutId = newId()
        createWorkout.mutate({ id: workoutId, date: today, name: workoutName(minutes) })
      }

      const nextNo = new Map<string, number>()
      for (const s of todays ? todaysSets ?? [] : []) {
        nextNo.set(s.exercise_id, Math.max(nextNo.get(s.exercise_id) ?? 0, s.set_number))
      }
      const sets: SetInput[] = []
      for (const w of result.work) {
        const ex = owned.get(w.exerciseId)
        if (!ex) continue
        const n = (nextNo.get(ex.id) ?? 0) + 1
        nextNo.set(ex.id, n)
        sets.push({
          workout_id: workoutId,
          exercise_id: ex.id,
          set_number: n,
          reps: estimateReps(w.seconds),
          weight: 0,
          set_type: 'working',
          to_failure: false,
        })
      }
      if (sets.length) addSets.mutate(sets)
      setSaved(true)
    } catch (e) {
      setError(
        `Konnte nicht speichern: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}. Bitte Verbindung prüfen.`,
      )
    } finally {
      setSaving(false)
    }
  }

  return { save, ready, saving, saved, error, appending: !!todays }
}
