import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExercises } from '../hooks/useExercises'
import { useAiStatus } from '../hooks/useAi'
import { generatePlan, type PlanSuggestion } from '../lib/ai'
import {
  useAddPlanExercise,
  useCreatePlan,
  useDeletePlan,
  usePlans,
  useRemovePlanExercise,
  useRenamePlan,
  useReorderPlanExercises,
} from '../hooks/usePlans'
import type { PlanWithExercises } from '../types'

export default function Plans() {
  const navigate = useNavigate()
  const { data: plans, isLoading } = usePlans()
  const { data: exercises } = useExercises()
  const { data: ai } = useAiStatus()
  const createPlan = useCreatePlan()
  const addPlanEx = useAddPlanExercise()
  const [newName, setNewName] = useState('')

  // KI-Plangenerator
  const [genOpen, setGenOpen] = useState(false)
  const [wish, setWish] = useState('Push / Pull / Beine, 4× pro Woche')
  const [genBusy, setGenBusy] = useState(false)
  const [genErr, setGenErr] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<PlanSuggestion[] | null>(null)

  const exName = (id: string) => exercises?.find((e) => e.id === id)?.name ?? 'Übung'

  async function addPlan() {
    const name = newName.trim()
    if (!name) return
    await createPlan.mutateAsync({ name, position: plans?.length ?? 0 })
    setNewName('')
  }

  async function runGenerate() {
    if (!exercises?.length) return
    setGenBusy(true)
    setGenErr(null)
    try {
      const res = await generatePlan(
        exercises.map((e) => ({ name: e.name, muscle: e.muscle_group })),
        wish,
      )
      if (res.length === 0) setGenErr('Kein Vorschlag möglich. Formulier den Wunsch anders.')
      else setSuggestions(res)
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setGenBusy(false)
    }
  }

  async function applySuggestions(list: PlanSuggestion[]) {
    let pos = plans?.length ?? 0
    for (const s of list) {
      const plan = await createPlan.mutateAsync({ name: s.name, position: pos++ })
      let exPos = 0
      for (const name of s.exercises) {
        const ex = exercises?.find((e) => e.name.toLowerCase() === name.toLowerCase())
        if (ex) await addPlanEx.mutateAsync({ plan_id: plan.id, exercise_id: ex.id, position: exPos++ })
      }
    }
    setSuggestions(null)
    setGenOpen(false)
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-base"
            onClick={() => navigate('/exercises')}
            aria-label="Zurück zu Übungen"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">Trainingspläne</h1>
        </div>
      </header>

      <p className="text-sm text-cocoa-light">
        Fasse Übungen zu Plänen zusammen (z. B. „Push", „Pull", „Beine"). Beim Training wählst du
        einen Plan und lädst nur dessen Übungen — kein langes Scrollen mehr.
      </p>

      <div className="card space-y-2">
        <label className="label">Neuer Plan</label>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="z. B. Push Day"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addPlan()
            }}
          />
          <button className="btn-primary shrink-0" onClick={addPlan} disabled={createPlan.isPending}>
            + Anlegen
          </button>
        </div>
        {ai?.enabled && (exercises?.length ?? 0) > 0 && (
          <button className="btn-ghost w-full text-sm" onClick={() => setGenOpen(true)}>
            🤖 Plan von KI vorschlagen lassen
          </button>
        )}
      </div>

      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      <ul className="space-y-3">
        {plans?.map((plan) => (
          <PlanCard key={plan.id} plan={plan} exName={exName} />
        ))}
        {plans?.length === 0 && !isLoading && (
          <li className="text-cocoa-light">Noch keine Pläne. Lege oben deinen ersten an.</li>
        )}
      </ul>

      {genOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">🤖 KI-Plan</h2>
            {!suggestions ? (
              <>
                <label className="label">Was für ein Plan?</label>
                <input
                  className="input"
                  value={wish}
                  onChange={(e) => setWish(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {['Push / Pull / Beine', 'Oberkörper / Unterkörper', 'Ganzkörper 3×', 'Push / Pull'].map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setWish(p)}
                        className="rounded-full bg-sand-light px-2.5 py-1 text-xs ring-1 ring-sand-dark"
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
                {genErr && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {genErr}</p>}
                <div className="flex gap-2 pt-1">
                  <button className="btn-ghost flex-1" onClick={() => setGenOpen(false)}>
                    Abbrechen
                  </button>
                  <button className="btn-primary flex-1" onClick={runGenerate} disabled={genBusy}>
                    {genBusy ? 'Erstelle…' : 'Vorschlagen'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-cocoa-light">Vorschlag — beim Übernehmen werden die Pläne angelegt.</p>
                <ul className="space-y-2">
                  {suggestions.map((s, i) => (
                    <li key={i} className="rounded-lg bg-sand/40 p-2 ring-1 ring-sand-dark/50">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-cocoa-light">{s.exercises.join(' · ')}</div>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-1">
                  <button className="btn-ghost flex-1" onClick={() => setSuggestions(null)}>
                    Zurück
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={() => applySuggestions(suggestions)}
                    disabled={createPlan.isPending || addPlanEx.isPending}
                  >
                    Übernehmen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PlanCard({
  plan,
  exName,
}: {
  plan: PlanWithExercises
  exName: (id: string) => string
}) {
  const { data: exercises } = useExercises()
  const renamePlan = useRenamePlan()
  const deletePlan = useDeletePlan()
  const addEx = useAddPlanExercise()
  const removeEx = useRemovePlanExercise()
  const reorder = useReorderPlanExercises()

  const available = (exercises ?? [])
    .filter((e) => !plan.exercise_ids.includes(e.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  function move(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= plan.exercise_ids.length) return
    const ids = [...plan.exercise_ids]
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    reorder.mutate({ plan_id: plan.id, exercise_ids: ids })
  }

  return (
    <li className="card space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1 font-semibold"
          defaultValue={plan.name}
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== plan.name) renamePlan.mutate({ id: plan.id, name })
          }}
        />
        <button
          className="px-2 text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
          aria-label="Plan löschen"
          onClick={() => {
            if (confirm(`Plan „${plan.name}" löschen? (Übungen bleiben erhalten)`))
              deletePlan.mutate(plan.id)
          }}
        >
          ✕
        </button>
      </div>

      {plan.exercise_ids.length > 0 ? (
        <ul className="space-y-1">
          {plan.exercise_ids.map((exId, i) => (
            <li
              key={exId}
              className="flex items-center gap-1 rounded-lg bg-sand-light px-2 py-1.5 ring-1 ring-sand-dark"
            >
              <span className="flex-1 text-sm">{exName(exId)}</span>
              <button
                className="px-1.5 text-cocoa-muted disabled:opacity-30"
                aria-label="Nach oben"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                className="px-1.5 text-cocoa-muted disabled:opacity-30"
                aria-label="Nach unten"
                disabled={i === plan.exercise_ids.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                className="px-1.5 text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
                aria-label="Aus Plan entfernen"
                onClick={() => removeEx.mutate({ plan_id: plan.id, exercise_id: exId })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-cocoa-muted">Noch keine Übungen in diesem Plan.</p>
      )}

      {available.length > 0 && (
        <select
          className="input"
          value=""
          onChange={(e) => {
            if (e.target.value)
              addEx.mutate({
                plan_id: plan.id,
                exercise_id: e.target.value,
                position: plan.exercise_ids.length,
              })
          }}
        >
          <option value="">+ Übung hinzufügen…</option>
          {available.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      )}
    </li>
  )
}
