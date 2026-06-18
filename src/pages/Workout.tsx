import { useMemo, useState } from 'react'
import { useExercises } from '../hooks/useExercises'
import {
  useAddSet,
  useAddSets,
  useAllSets,
  useCreateWorkout,
  useDeleteSet,
  useUpdateSet,
  useWorkoutSets,
  useWorkouts,
} from '../hooks/useWorkouts'
import { Stepper } from '../components/Stepper'
import { progressionSuggestion, summarizeSessions } from '../lib/analytics'
import { SET_TYPES, SET_TYPE_SHORT, type Exercise, type SetType, type SetWithDate } from '../types'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

const roundHalf = (v: number) => Math.round(v * 2) / 2

const tipStyles: Record<string, string> = {
  increase: 'text-brand',
  hold: 'text-sky-300',
  deload: 'text-amber-300',
  start: 'text-slate-400',
}

// Farbe der Typ-Chips
const typeChip: Record<SetType, string> = {
  warmup: 'bg-amber-500 text-slate-900',
  working: 'bg-brand text-slate-900',
  drop: 'bg-sky-500 text-slate-900',
}

// Deine Standard-Struktur
const TEMPLATE: SetType[] = ['warmup', 'working', 'working', 'drop']

/** Vorschlag für Wdh/Gewicht je Satz-Typ, abgeleitet vom Arbeitsgewicht. */
function deriveSet(type: SetType, base: number, ex: Exercise): { reps: number; weight: number } {
  switch (type) {
    case 'warmup':
      return { reps: 10, weight: roundHalf(base * 0.5) }
    case 'drop':
      return { reps: ex.target_rep_max, weight: roundHalf(base * 0.7) }
    default:
      return { reps: ex.target_rep_min, weight: base }
  }
}

/** Nächster Satz-Typ nach deinem Muster (Aufwärm, Arbeit, Arbeit, Drop, …). */
function patternType(index: number): SetType {
  return TEMPLATE[index] ?? 'working'
}

export default function Workout() {
  const today = todayLocal()
  const { data: workouts } = useWorkouts()
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const createWorkout = useCreateWorkout()
  const addSet = useAddSet()
  const addSets = useAddSets()
  const updateSet = useUpdateSet()
  const deleteSet = useDeleteSet()

  const todaysWorkout = workouts?.find((w) => w.date === today)
  const { data: workoutSets } = useWorkoutSets(todaysWorkout?.id)

  const [exerciseId, setExerciseId] = useState('')
  const selectedExercise = exercises?.find((e) => e.id === exerciseId)

  // Historie der gewählten Übung (ohne heute) → für Tipp & letzte Leistung
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

  const setsForExercise = (workoutSets ?? [])
    .filter((s) => s.exercise_id === exerciseId)
    .sort((a, b) => a.set_number - b.set_number)
  const nextSetNumber = setsForExercise.reduce((max, s) => Math.max(max, s.set_number), 0) + 1

  // Arbeitsgewicht als Basis für Vorschläge
  const workingBase = suggestion && suggestion.suggestedWeight > 0 ? suggestion.suggestedWeight : 20

  async function addTemplate() {
    if (!todaysWorkout || !selectedExercise) return
    const inputs = TEMPLATE.map((type, i) => {
      const d = deriveSet(type, workingBase, selectedExercise!)
      return {
        workout_id: todaysWorkout.id,
        exercise_id: exerciseId,
        set_number: nextSetNumber + i,
        reps: d.reps,
        weight: d.weight,
        set_type: type,
        to_failure: type !== 'warmup',
      }
    })
    await addSets.mutateAsync(inputs)
  }

  async function addOne() {
    if (!todaysWorkout || !selectedExercise) return
    const type = patternType(setsForExercise.length)
    const d = deriveSet(type, workingBase, selectedExercise)
    await addSet.mutateAsync({
      workout_id: todaysWorkout.id,
      exercise_id: exerciseId,
      set_number: nextSetNumber,
      reps: d.reps,
      weight: d.weight,
      set_type: type,
      to_failure: type !== 'warmup',
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
            onChange={(e) => setExerciseId(e.target.value)}
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

            {/* Editierbare Satz-Zeilen */}
            {setsForExercise.length > 0 && (
              <ul className="space-y-2">
                {setsForExercise.map((s) => (
                  <li key={s.id} className="rounded-xl bg-slate-900/50 p-2.5 ring-1 ring-slate-700/50">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex gap-1">
                        {SET_TYPES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateSet.mutate({ id: s.id, set_type: t })}
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              s.set_type === t ? typeChip[t] : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {SET_TYPE_SHORT[t]}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateSet.mutate({ id: s.id, to_failure: !s.to_failure })}
                          aria-label="Bis zum Versagen umschalten"
                          title="Antippen, wenn du diesen Satz NICHT bis zum Versagen gemacht hast"
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            s.to_failure
                              ? 'bg-orange-500 text-slate-900'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {s.to_failure ? '🔥 Versagen' : 'nicht ans Limit'}
                        </button>
                        <button
                          className="px-2 text-slate-500 hover:text-red-400"
                          aria-label="Satz löschen"
                          onClick={() => deleteSet.mutate(s)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Stepper
                        label="Wdh"
                        hideLabel
                        compact
                        value={s.reps}
                        step={1}
                        min={0}
                        onChange={(reps) => updateSet.mutate({ id: s.id, reps })}
                      />
                      <Stepper
                        label="Gewicht"
                        hideLabel
                        compact
                        suffix="kg"
                        value={s.weight}
                        step={selectedExercise.increment}
                        min={0}
                        onChange={(weight) => updateSet.mutate({ id: s.id, weight })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Aktionen */}
            {setsForExercise.length === 0 ? (
              <div className="space-y-2">
                <button
                  className="btn-primary w-full"
                  onClick={addTemplate}
                  disabled={addSets.isPending}
                >
                  Standard-Sätze anlegen
                </button>
                <p className="text-center text-xs text-slate-500">
                  1 Aufwärmen · 2 Arbeitssätze · 1 Dropsatz — danach nur noch Gewicht/Wdh anpassen
                </p>
                <button className="btn-ghost w-full" onClick={addOne} disabled={addSet.isPending}>
                  + Einzelnen Satz
                </button>
              </div>
            ) : (
              <button className="btn-ghost w-full" onClick={addOne} disabled={addSet.isPending}>
                + Satz hinzufügen
              </button>
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

      {/* Kleine Erklärung */}
      <div className="rounded-xl bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-500">
        <p className="mb-1 font-semibold text-slate-400">So erfasst du am besten</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Trag nur <span className="text-slate-300">saubere Wdh</span> ein (volle Bewegung, eigene
            Kraft) — die letzte halbe/erzwungene Wdh lässt du weg.
          </li>
          <li>
            <span className="text-orange-400">🔥 Versagen</span> ist Standard. Tipp es nur{' '}
            <span className="text-slate-300">aus</span> („nicht ans Limit"), wenn du den Satz mal
            nicht bis zum Limit gemacht hast.
          </li>
          <li>
            Der Tipp oben sagt dir dann, ob du das Gewicht <span className="text-slate-300">halten,
            steigern</span> oder reduzieren solltest.
          </li>
        </ul>
      </div>
    </div>
  )
}
