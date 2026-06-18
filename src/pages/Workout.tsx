import { useMemo, useState } from 'react'
import { useExercises } from '../hooks/useExercises'
import {
  useAddSet,
  useAllSets,
  useCreateWorkout,
  useDeleteSet,
  useWorkoutSets,
  useWorkouts,
} from '../hooks/useWorkouts'
import { Stepper } from '../components/Stepper'
import { progressionSuggestion, summarizeSessions } from '../lib/analytics'
import type { SetWithDate } from '../types'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

const tipStyles: Record<string, string> = {
  increase: 'text-brand',
  hold: 'text-sky-300',
  deload: 'text-amber-300',
  start: 'text-slate-400',
}

export default function Workout() {
  const today = todayLocal()
  const { data: workouts } = useWorkouts()
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const createWorkout = useCreateWorkout()
  const addSet = useAddSet()
  const deleteSet = useDeleteSet()

  const todaysWorkout = workouts?.find((w) => w.date === today)
  const { data: workoutSets } = useWorkoutSets(todaysWorkout?.id)

  const [exerciseId, setExerciseId] = useState('')
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(20)

  const selectedExercise = exercises?.find((e) => e.id === exerciseId)

  // Historie der gewählten Übung (ohne das heutige Training) → für Tipp & letzte Leistung
  const history = useMemo<SetWithDate[]>(() => {
    if (!exerciseId || !allSets) return []
    return allSets.filter((s) => s.exercise_id === exerciseId && s.date !== today)
  }, [allSets, exerciseId, today])

  const suggestion = useMemo(() => {
    if (!selectedExercise) return null
    return progressionSuggestion(selectedExercise, history)
  }, [selectedExercise, history])

  const lastSession = useMemo(() => {
    const sessions = summarizeSessions(history)
    return sessions[sessions.length - 1] ?? null
  }, [history])

  function selectExercise(id: string) {
    setExerciseId(id)
    const ex = exercises?.find((e) => e.id === id)
    const hist = (allSets ?? []).filter((s) => s.exercise_id === id && s.date !== today)
    const sug = ex ? progressionSuggestion(ex, hist) : null
    if (sug && sug.suggestedWeight > 0) setWeight(sug.suggestedWeight)
    if (ex) setReps(ex.target_rep_min)
  }

  const setsForExercise = (workoutSets ?? []).filter((s) => s.exercise_id === exerciseId)

  async function logSet() {
    if (!todaysWorkout || !exerciseId) return
    await addSet.mutateAsync({
      workout_id: todaysWorkout.id,
      exercise_id: exerciseId,
      set_number: setsForExercise.length + 1,
      reps,
      weight,
    })
  }

  if (!todaysWorkout) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Training</h1>
        <div className="card space-y-3 text-center">
          <p className="text-slate-300">Heute noch kein Training erfasst.</p>
          <button
            className="btn-primary w-full"
            onClick={() => createWorkout.mutate({ date: today })}
            disabled={createWorkout.isPending}
          >
            Training starten
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Training heute</h1>
        <p className="text-sm text-slate-400">
          {new Date(today).toLocaleDateString('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </header>

      <div className="card space-y-3">
        <div>
          <label className="label">Übung</label>
          <select
            className="input"
            value={exerciseId}
            onChange={(e) => selectExercise(e.target.value)}
          >
            <option value="">— wählen —</option>
            {exercises?.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
          {exercises?.length === 0 && (
            <p className="mt-1 text-sm text-amber-300">
              Lege zuerst unter „Übungen" eine Übung an.
            </p>
          )}
        </div>

        {selectedExercise && (
          <>
            {suggestion && (
              <div className="rounded-xl bg-slate-900/70 p-3 text-sm ring-1 ring-slate-700">
                <span className="font-semibold">💡 Tipp: </span>
                <span className={tipStyles[suggestion.action]}>{suggestion.reason}</span>
                {lastSession && (
                  <div className="mt-1 text-xs text-slate-500">
                    Letztes Training (
                    {new Date(lastSession.date).toLocaleDateString('de-DE')}):{' '}
                    {lastSession.sets.map((s) => `${s.reps}×${s.weight}kg`).join(', ')}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Stepper label="Wdh" value={reps} onChange={setReps} step={1} min={0} />
              <Stepper
                label="Gewicht"
                value={weight}
                onChange={setWeight}
                step={selectedExercise.increment}
                min={0}
                suffix="kg"
              />
            </div>

            <button className="btn-primary w-full" onClick={logSet} disabled={addSet.isPending}>
              Satz {setsForExercise.length + 1} hinzufügen
            </button>

            {setsForExercise.length > 0 && (
              <ul className="space-y-1 pt-1">
                {setsForExercise.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2 text-sm"
                  >
                    <span>
                      Satz {s.set_number}: <strong>{s.reps}</strong> Wdh ×{' '}
                      <strong>{s.weight} kg</strong>
                    </span>
                    <button
                      className="text-slate-500 hover:text-red-400"
                      aria-label="Satz löschen"
                      onClick={() => deleteSet.mutate(s)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Übersicht aller heute erfassten Sätze */}
      {workoutSets && workoutSets.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Heute erfasst</h2>
          <ul className="space-y-1 text-sm text-slate-300">
            {Object.entries(
              workoutSets.reduce<Record<string, number>>((acc, s) => {
                acc[s.exercise_id] = (acc[s.exercise_id] ?? 0) + 1
                return acc
              }, {}),
            ).map(([exId, count]) => (
              <li key={exId} className="flex justify-between">
                <span>{exercises?.find((e) => e.id === exId)?.name ?? 'Übung'}</span>
                <span className="text-slate-500">{count} Sätze</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
