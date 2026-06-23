import { useState } from 'react'
import { useExercises } from '../hooks/useExercises'
import { useAddSet, useAllSets, useDeleteWorkout, useWorkouts } from '../hooks/useWorkouts'
import { EditableSetRow } from '../components/EditableSetRow'
import { totalVolume } from '../lib/analytics'
import type { Exercise, SetWithDate } from '../types'

export default function History() {
  const { data: workouts, isLoading } = useWorkouts()
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const deleteWorkout = useDeleteWorkout()
  const addSet = useAddSet()
  const [openId, setOpenId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const exName = (id: string) => exercises?.find((e) => e.id === id)?.name ?? 'Übung'

  function addSetToGroup(workoutId: string, ex: Exercise, exSets: SetWithDate[]) {
    const sorted = [...exSets].sort((a, b) => a.set_number - b.set_number)
    const last = sorted[sorted.length - 1]
    const next = exSets.reduce((m, s) => Math.max(m, s.set_number), 0) + 1
    addSet.mutate({
      workout_id: workoutId,
      exercise_id: ex.id,
      set_number: next,
      reps: last?.reps ?? ex.target_rep_min,
      weight: last?.weight ?? 20,
      reps_right: ex.unilateral ? (last?.reps_right ?? last?.reps ?? ex.target_rep_min) : null,
      weight_right: ex.unilateral ? (last?.weight_right ?? last?.weight ?? 20) : null,
      set_type: last?.set_type ?? 'working',
      to_failure: last?.to_failure ?? true,
    })
  }

  function addExerciseToWorkout(workoutId: string, exId: string) {
    const ex = exercises?.find((e) => e.id === exId)
    if (!ex) return
    addSet.mutate({
      workout_id: workoutId,
      exercise_id: exId,
      set_number: 1,
      reps: ex.target_rep_min,
      weight: 20,
      reps_right: ex.unilateral ? ex.target_rep_min : null,
      weight_right: ex.unilateral ? 20 : null,
      set_type: 'working',
      to_failure: true,
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Verlauf</h1>
      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      <ul className="space-y-2">
        {workouts?.map((w) => {
          const sets = (allSets ?? []).filter((s) => s.workout_id === w.id)
          const isOpen = openId === w.id
          const editing = editId === w.id
          const groups = Object.entries(
            sets.reduce<Record<string, SetWithDate[]>>((acc, s) => {
              ;(acc[s.exercise_id] ??= []).push(s)
              return acc
            }, {}),
          )
          return (
            <li key={w.id} className="card">
              <div className="flex items-center justify-between">
                <button
                  className="flex-1 text-left"
                  onClick={() => {
                    setOpenId(isOpen ? null : w.id)
                    if (isOpen) setEditId(null)
                  }}
                >
                  <div className="font-semibold">
                    {new Date(w.date).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-sm text-cocoa-light">
                    {sets.length} Sätze · Volumen {Math.round(totalVolume(sets))} kg
                  </div>
                </button>
                <button
                  className="ml-2 px-2 text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
                  aria-label="Training löschen"
                  onClick={() => {
                    if (confirm('Dieses Training löschen?')) deleteWorkout.mutate(w.id)
                  }}
                >
                  ✕
                </button>
              </div>

              {isOpen && (
                <div className="mt-3 space-y-3 border-t border-sand-dark pt-3">
                  <div className="flex justify-end">
                    <button
                      className="btn-ghost text-sm"
                      onClick={() => setEditId(editing ? null : w.id)}
                    >
                      {editing ? 'Fertig' : 'Bearbeiten'}
                    </button>
                  </div>

                  {groups.map(([exId, exSets]) => {
                    const ex = exercises?.find((e) => e.id === exId)
                    const sorted = [...exSets].sort((a, b) => a.set_number - b.set_number)
                    return (
                      <div key={exId} className="space-y-2">
                        <div className="font-medium">{exName(exId)}</div>
                        {editing && ex ? (
                          <>
                            {sorted.map((s) => (
                              <EditableSetRow key={s.id} set={s} exercise={ex} />
                            ))}
                            <button
                              className="btn-ghost w-full text-sm"
                              onClick={() => addSetToGroup(w.id, ex, exSets)}
                            >
                              + Satz
                            </button>
                          </>
                        ) : (
                          <div className="text-sm text-cocoa-light">
                            {sorted
                              .map((s) => {
                                const prefix =
                                  s.set_type === 'warmup'
                                    ? 'Aufw. '
                                    : s.set_type === 'drop'
                                      ? 'Drop '
                                      : ''
                                const flame = s.to_failure ? ' 🔥' : ''
                                if (s.reps_right != null) {
                                  return `${prefix}L ${s.reps}×${s.weight} / R ${s.reps_right}×${s.weight_right}kg${flame}`
                                }
                                return `${prefix}${s.reps}×${s.weight}kg${flame}`
                              })
                              .join(' · ')}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {editing && (
                    <div>
                      <label className="label">Übung hinzufügen</label>
                      <select
                        className="input"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) addExerciseToWorkout(w.id, e.target.value)
                        }}
                      >
                        <option value="">— wählen —</option>
                        {exercises?.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {sets.length === 0 && !editing && (
                    <p className="text-sm text-cocoa-muted">Keine Sätze.</p>
                  )}
                </div>
              )}
            </li>
          )
        })}
        {workouts?.length === 0 && (
          <li className="text-cocoa-light">Noch keine Trainings erfasst.</li>
        )}
      </ul>
    </div>
  )
}
