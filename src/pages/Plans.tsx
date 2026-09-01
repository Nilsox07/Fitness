import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExercises } from '../hooks/useExercises'
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
  const createPlan = useCreatePlan()
  const [newName, setNewName] = useState('')

  const exName = (id: string) => exercises?.find((e) => e.id === id)?.name ?? 'Übung'

  async function addPlan() {
    const name = newName.trim()
    if (!name) return
    await createPlan.mutateAsync({ name, position: plans?.length ?? 0 })
    setNewName('')
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
