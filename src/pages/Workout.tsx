import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExercises } from '../hooks/useExercises'
import { usePlans } from '../hooks/usePlans'
import {
  useAddSet,
  useAddSets,
  useAllSets,
  useCreateWorkout,
  useWorkoutSets,
  useWorkouts,
} from '../hooks/useWorkouts'
import { EditableSetRow } from '../components/EditableSetRow'
import { parseLadder, snapToLadder } from '../lib/weights'
import { progressionSuggestion, summarizeSessions } from '../lib/analytics'
import { type Exercise, type PlanWithExercises, type SetType, type SetWithDate } from '../types'

// Trainings-Tag: der Tag wechselt nicht um Mitternacht, sondern erst um DAY_CUTOFF_H
// Uhr morgens. So bleibt eine Session, die vor 0 Uhr startet und danach weiterläuft,
// als ein Training zusammen (statt beim Datumswechsel zu zerreißen).
const DAY_CUTOFF_H = 4

function todayLocal(): string {
  const d = new Date()
  d.setHours(d.getHours() - DAY_CUTOFF_H)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

const roundHalf = (v: number) => Math.round(v * 2) / 2

const tipStyles: Record<string, string> = {
  increase: 'text-brand',
  hold: 'text-cocoa',
  deload: 'text-amber-600 dark:text-amber-400',
  start: 'text-cocoa-light',
}

// Deine Standard-Struktur. Der Aufwärmsatz wird nur vorangestellt, wenn er
// gebraucht wird (siehe needsWarmup) — sonst geht's direkt mit den Arbeitssätzen los.
const TEMPLATE: SetType[] = ['warmup', 'working', 'working', 'drop']
const TEMPLATE_NO_WARMUP: SetType[] = ['working', 'working', 'drop']

/**
 * Aufwärmsatz nötig? Spezifisches Warm-up gilt pro Muskelgruppe: die erste Übung
 * einer Muskelgruppe in der Session bekommt einen Aufwärmsatz, Folgeübungen
 * derselben Gruppe nicht (Muskel ist schon warm). warmedGroups = die Muskel-
 * gruppen, die heute bereits mindestens einen Satz gesehen haben.
 */
function needsWarmup(ex: Exercise, warmedGroups: Set<string>): boolean {
  return !warmedGroups.has(ex.muscle_group)
}

/** Muskelgruppen, die in den gegebenen Sätzen heute schon trainiert wurden. */
function warmedMuscleGroups(sets: { exercise_id: string }[], exercises: Exercise[]): Set<string> {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const groups = new Set<string>()
  for (const s of sets) {
    const ex = byId.get(s.exercise_id)
    if (ex) groups.add(ex.muscle_group)
  }
  return groups
}

/** Vorschlag je Satz-Typ: Gewicht vorbefüllt (vom Arbeitsgewicht abgeleitet),
 *  Wdh bleiben leer (0) und werden im Gym eingetragen. */
function deriveSet(type: SetType, base: number): { reps: number; weight: number } {
  switch (type) {
    case 'warmup':
      return { reps: 0, weight: roundHalf(base * 0.5) }
    case 'drop':
      return { reps: 0, weight: roundHalf(base * 0.7) }
    default:
      return { reps: 0, weight: base }
  }
}

/** Nächster Satz-Typ nach deinem Muster (Aufwärm, Arbeit, Arbeit, Drop, …). */
function patternType(index: number): SetType {
  return TEMPLATE[index] ?? 'working'
}

/** Gewicht auf die Geräte-Leiter einrasten (falls hinterlegt). */
function snapWeight(ex: Exercise, w: number): number {
  const ladder = parseLadder(ex.weight_steps)
  return ladder.length ? snapToLadder(w, ladder) : w
}

/** Baut die Standard-Sätze für eine Übung (Wdh leer, Gewicht vorbefüllt).
 *  Mit Aufwärmsatz nur, wenn withWarmup=true (default). */
function templateInputs(
  workoutId: string,
  ex: Exercise,
  base: number,
  startNo: number,
  withWarmup = true,
) {
  const template = withWarmup ? TEMPLATE : TEMPLATE_NO_WARMUP
  return template.map((type, i) => {
    const d = deriveSet(type, base)
    const weight = snapWeight(ex, d.weight)
    return {
      workout_id: workoutId,
      exercise_id: ex.id,
      set_number: startNo + i,
      reps: d.reps,
      weight,
      reps_right: ex.unilateral ? d.reps : null,
      weight_right: ex.unilateral ? weight : null,
      set_type: type,
      to_failure: type !== 'warmup',
    }
  })
}

function baseFor(ex: Exercise, history: SetWithDate[]): number {
  const sug = progressionSuggestion(ex, history)
  return sug.suggestedWeight > 0 ? sug.suggestedWeight : 20
}

export default function Workout() {
  const navigate = useNavigate()
  const today = todayLocal()
  const { data: workouts } = useWorkouts()
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const { data: plans } = usePlans()
  const createWorkout = useCreateWorkout()
  const addSet = useAddSet()
  const addSets = useAddSets()

  const todaysWorkout = workouts?.find((w) => w.date === today)
  const { data: workoutSets } = useWorkoutSets(todaysWorkout?.id)

  const [exerciseId, setExerciseId] = useState('')
  const selectedExercise = exercises?.find((e) => e.id === exerciseId)

  // Aktiver Plan filtert die Übungsauswahl (kein langes Scrollen).
  const [planId, setPlanId] = useState('')
  const activePlan = plans?.find((p) => p.id === planId)
  const visibleExercises = useMemo<Exercise[]>(() => {
    if (!exercises) return []
    if (!activePlan) return exercises
    return activePlan.exercise_ids
      .map((id) => exercises.find((e) => e.id === id))
      .filter((e): e is Exercise => Boolean(e))
  }, [exercises, activePlan])

  // Fehler aus den Schreibvorgängen sichtbar machen (statt still zu scheitern)
  const saveError = (addSet.error ||
    addSets.error ||
    createWorkout.error) as Error | null

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

  // Übungen, für die heute schon mind. ein Satz erfasst wurde → Haken in der Auswahl
  const doneExerciseIds = new Set((workoutSets ?? []).map((s) => s.exercise_id))

  // Arbeitsgewicht als Basis für Vorschläge
  const workingBase = suggestion && suggestion.suggestedWeight > 0 ? suggestion.suggestedWeight : 20

  // Bekommt die gewählte Übung einen Aufwärmsatz? (nur wenn ihre Muskelgruppe heute noch kalt ist)
  const willWarmup = selectedExercise
    ? needsWarmup(
        selectedExercise,
        warmedMuscleGroups(
          (workoutSets ?? []).filter((s) => s.exercise_id !== selectedExercise.id),
          exercises ?? [],
        ),
      )
    : true

  // Übung auswählen → bei leerem Stand automatisch die Standard-Sätze anlegen
  function selectExercise(id: string) {
    setExerciseId(id)
    if (!id || !todaysWorkout || !exercises) return
    const ex = exercises.find((e) => e.id === id)
    if (!ex) return
    const existing = (workoutSets ?? []).filter((s) => s.exercise_id === id)
    if (existing.length > 0) return
    const hist = (allSets ?? []).filter((s) => s.exercise_id === id && s.date !== today)
    const warmed = warmedMuscleGroups(workoutSets ?? [], exercises)
    addSets.mutate(
      templateInputs(todaysWorkout.id, ex, baseFor(ex, hist), 1, needsWarmup(ex, warmed)),
    )
  }

  // Ganzen Plan laden: Standard-Sätze für alle noch nicht erfassten Übungen anlegen.
  function loadPlan(plan: PlanWithExercises) {
    if (!todaysWorkout || !exercises) return
    // Bereits heute trainierte Muskelgruppen; wächst mit, während wir den Plan durchgehen,
    // damit die zweite Übung derselben Gruppe keinen Aufwärmsatz mehr bekommt.
    const warmed = warmedMuscleGroups(workoutSets ?? [], exercises)
    const inputs = plan.exercise_ids.flatMap((exId) => {
      const ex = exercises.find((e) => e.id === exId)
      if (!ex) return []
      const already = (workoutSets ?? []).some((s) => s.exercise_id === exId)
      if (already) return []
      const hist = (allSets ?? []).filter((s) => s.exercise_id === exId && s.date !== today)
      const rows = templateInputs(todaysWorkout.id, ex, baseFor(ex, hist), 1, needsWarmup(ex, warmed))
      warmed.add(ex.muscle_group)
      return rows
    })
    if (inputs.length) addSets.mutate(inputs)
  }

  async function addTemplate() {
    if (!todaysWorkout || !selectedExercise) return
    const warmed = warmedMuscleGroups(
      (workoutSets ?? []).filter((s) => s.exercise_id !== selectedExercise.id),
      exercises ?? [],
    )
    await addSets.mutateAsync(
      templateInputs(
        todaysWorkout.id,
        selectedExercise,
        workingBase,
        nextSetNumber,
        needsWarmup(selectedExercise, warmed),
      ),
    )
  }

  async function addOne() {
    if (!todaysWorkout || !selectedExercise) return
    const type = patternType(setsForExercise.length)
    const d = deriveSet(type, workingBase)
    const uni = selectedExercise.unilateral
    const weight = snapWeight(selectedExercise, d.weight)
    await addSet.mutateAsync({
      workout_id: todaysWorkout.id,
      exercise_id: exerciseId,
      set_number: nextSetNumber,
      reps: d.reps,
      weight,
      reps_right: uni ? d.reps : null,
      weight_right: uni ? weight : null,
      set_type: type,
      to_failure: type !== 'warmup',
    })
  }

  if (!todaysWorkout) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Training</h1>
        <div className="card space-y-3 text-center">
          <p className="text-cocoa">Heute noch kein Training erfasst.</p>
          <button
            className="btn-primary w-full"
            onClick={() => createWorkout.mutate({ date: today })}
            disabled={createWorkout.isPending}
          >
            Training starten
          </button>
          {saveError && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {saveError.message}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Training heute</h1>
        <p className="text-sm text-cocoa-light">
          {new Date(today).toLocaleDateString('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </header>

      {saveError && (
        <div className="card border border-red-400 text-sm text-red-500 dark:text-red-400">
          ⚠️ Konnte nicht speichern: {saveError.message}
          <div className="mt-1 text-xs text-cocoa-light">
            Tipp: Sind die Datenbank-Updates (Migrationen 0002 & 0003) in Supabase ausgeführt?
          </div>
        </div>
      )}

      {plans && plans.length > 0 && (
        <div className="card space-y-2">
          <label className="label">Plan</label>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 ${
                planId === ''
                  ? 'bg-ruby text-white ring-ruby'
                  : 'bg-sand-light text-cocoa ring-sand-dark'
              }`}
              onClick={() => setPlanId('')}
            >
              Alle
            </button>
            {plans.map((p) => (
              <button
                key={p.id}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 ${
                  planId === p.id
                    ? 'bg-ruby text-white ring-ruby'
                    : 'bg-sand-light text-cocoa ring-sand-dark'
                }`}
                onClick={() => setPlanId(planId === p.id ? '' : p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          {activePlan && activePlan.exercise_ids.length > 0 && (
            <button
              className="btn-ghost w-full text-sm"
              onClick={() => loadPlan(activePlan)}
              disabled={addSets.isPending}
            >
              ⬇️ Ganzen Plan laden ({activePlan.exercise_ids.length} Übungen)
            </button>
          )}
        </div>
      )}

      <div className="card space-y-3">
        <div>
          <label className="label">Übung</label>
          <select
            className="input"
            value={exerciseId}
            onChange={(e) => selectExercise(e.target.value)}
          >
            <option value="">— wählen —</option>
            {visibleExercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {doneExerciseIds.has(ex.id) ? '✓ ' : ''}
                {ex.name}
              </option>
            ))}
          </select>
          {exercises?.length === 0 && (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
              Lege zuerst unter „Übungen" eine Übung an.
            </p>
          )}
          {activePlan && visibleExercises.length === 0 && (
            <p className="mt-1 text-sm text-cocoa-muted">
              Dieser Plan hat noch keine Übungen. Füge sie unter „Übungen → 🗂️ Pläne" hinzu.
            </p>
          )}
        </div>

        {selectedExercise && (
          <>
            {suggestion && (
              <div className="rounded-xl bg-sand/50 p-3 text-sm ring-1 ring-sand-dark">
                <span className="font-semibold">💡 Tipp: </span>
                <span className={tipStyles[suggestion.action]}>{suggestion.reason}</span>
                {lastSession && (
                  <div className="mt-1 text-xs text-cocoa-muted">
                    Letztes Training (
                    {new Date(lastSession.date).toLocaleDateString('de-DE')}):{' '}
                    {lastSession.sets.map((s) => `${s.reps}×${s.weight}kg`).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Editierbare Satz-Zeilen */}
            {setsForExercise.length > 0 && (
              <div className="space-y-2">
                {setsForExercise.map((s) => (
                  <EditableSetRow key={s.id} set={s} exercise={selectedExercise} />
                ))}
              </div>
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
                <p className="text-center text-xs text-cocoa-muted">
                  {willWarmup
                    ? '1 Aufwärmen · 2 Arbeitssätze · 1 Dropsatz'
                    : '2 Arbeitssätze · 1 Dropsatz (Muskel schon warm → kein Aufwärmsatz)'}{' '}
                  — danach nur noch Gewicht/Wdh anpassen
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
          <ul className="space-y-1 text-sm text-cocoa">
            {Object.entries(
              workoutSets.reduce<Record<string, number>>((acc, s) => {
                acc[s.exercise_id] = (acc[s.exercise_id] ?? 0) + 1
                return acc
              }, {}),
            ).map(([exId, count]) => (
              <li key={exId} className="flex justify-between">
                <span>{exercises?.find((e) => e.id === exId)?.name ?? 'Übung'}</span>
                <span className="text-cocoa-muted">{count} Sätze</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Training abschließen */}
      {workoutSets && workoutSets.length > 0 && (
        <div className="space-y-1">
          <button className="btn-primary w-full" onClick={() => navigate('/history')}>
            Training speichern
          </button>
          <p className="text-center text-xs text-cocoa-muted">
            Deine Sätze sind automatisch gesichert — hier kommst du zum Verlauf.
          </p>
        </div>
      )}

      {/* Kleine Erklärung */}
      <div className="rounded-xl bg-sand/40 p-3 text-xs leading-relaxed text-cocoa-muted">
        <p className="mb-1 font-semibold text-cocoa-light">So erfasst du am besten</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Trag nur <span className="text-cocoa">saubere Wdh</span> ein (volle Bewegung, eigene
            Kraft) — die letzte halbe/erzwungene Wdh lässt du weg.
          </li>
          <li>
            <span className="text-orange-400">🔥 Versagen</span> ist Standard. Tipp es nur{' '}
            <span className="text-cocoa">aus</span> („nicht ans Limit"), wenn du den Satz mal
            nicht bis zum Limit gemacht hast.
          </li>
          <li>
            Der Tipp oben sagt dir dann, ob du das Gewicht <span className="text-cocoa">halten,
            steigern</span> oder reduzieren solltest.
          </li>
          <li>
            Der <span className="text-cocoa">Aufwärmsatz</span> kommt nur bei der ersten Übung
            einer Muskelgruppe — ist der Muskel schon warm, wird er weggelassen.
          </li>
        </ul>
      </div>
    </div>
  )
}
