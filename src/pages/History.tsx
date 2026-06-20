import { useState } from 'react'
import { useExercises } from '../hooks/useExercises'
import { useAllSets, useDeleteWorkout, useWorkouts } from '../hooks/useWorkouts'
import { totalVolume } from '../lib/analytics'

export default function History() {
  const { data: workouts, isLoading } = useWorkouts()
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const deleteWorkout = useDeleteWorkout()
  const [openId, setOpenId] = useState<string | null>(null)

  const exName = (id: string) => exercises?.find((e) => e.id === id)?.name ?? 'Übung'

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Verlauf</h1>
      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      <ul className="space-y-2">
        {workouts?.map((w) => {
          const sets = (allSets ?? []).filter((s) => s.workout_id === w.id)
          const isOpen = openId === w.id
          return (
            <li key={w.id} className="card">
              <div className="flex items-center justify-between">
                <button
                  className="flex-1 text-left"
                  onClick={() => setOpenId(isOpen ? null : w.id)}
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
                  className="ml-2 px-2 text-cocoa-muted hover:text-red-600"
                  aria-label="Training löschen"
                  onClick={() => {
                    if (confirm('Dieses Training löschen?')) deleteWorkout.mutate(w.id)
                  }}
                >
                  ✕
                </button>
              </div>

              {isOpen && (
                <ul className="mt-3 space-y-2 border-t border-sand-dark pt-3 text-sm">
                  {Object.entries(
                    sets.reduce<Record<string, typeof sets>>((acc, s) => {
                      ;(acc[s.exercise_id] ??= []).push(s)
                      return acc
                    }, {}),
                  ).map(([exId, exSets]) => (
                    <li key={exId}>
                      <div className="font-medium">{exName(exId)}</div>
                      <div className="text-cocoa-light">
                        {exSets
                          .sort((a, b) => a.set_number - b.set_number)
                          .map((s) => {
                            const prefix =
                              s.set_type === 'warmup'
                                ? 'Aufw. '
                                : s.set_type === 'drop'
                                  ? 'Drop '
                                  : ''
                            return `${prefix}${s.reps}×${s.weight}kg${s.to_failure ? ' 🔥' : ''}`
                          })
                          .join(' · ')}
                      </div>
                    </li>
                  ))}
                  {sets.length === 0 && <li className="text-cocoa-muted">Keine Sätze.</li>}
                </ul>
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
