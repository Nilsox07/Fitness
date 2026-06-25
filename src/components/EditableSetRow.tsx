import { Stepper } from './Stepper'
import { useDeleteSet, useUpdateSet } from '../hooks/useWorkouts'
import { parseLadder } from '../lib/weights'
import { SET_TYPES, SET_TYPE_SHORT, type Exercise, type SetType, type WorkoutSet } from '../types'

const typeChip: Record<SetType, string> = {
  warmup: 'bg-amber-500 text-white',
  working: 'bg-brand text-white',
  drop: 'bg-sky-500 text-white',
}

/** Editierbare Satz-Zeile (Typ, Versagen, Wdh/Gewicht, ggf. links/rechts). */
export function EditableSetRow({ set: s, exercise }: { set: WorkoutSet; exercise: Exercise }) {
  const updateSet = useUpdateSet()
  const deleteSet = useDeleteSet()
  const ladder = parseLadder(exercise.weight_steps)
  const weightSteps = ladder.length ? ladder : undefined

  return (
    <div className="rounded-xl bg-sand/40 p-2.5 ring-1 ring-sand-dark/50">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {SET_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => updateSet.mutate({ id: s.id, set_type: t })}
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                s.set_type === t ? typeChip[t] : 'bg-sand-dark/50 text-cocoa-light'
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
              s.to_failure ? 'bg-orange-500 text-white' : 'bg-sand-dark/50 text-cocoa-light'
            }`}
          >
            {s.to_failure ? '🔥 Versagen' : 'nicht ans Limit'}
          </button>
          <button
            className="px-2 text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
            aria-label="Satz löschen"
            onClick={() => deleteSet.mutate(s)}
          >
            ✕
          </button>
        </div>
      </div>

      {exercise.unilateral ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-semibold text-cocoa-light">Links</span>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Stepper
                label="Wdh links"
                hideLabel
                compact
                value={s.reps}
                step={1}
                min={0}
                onChange={(reps) => updateSet.mutate({ id: s.id, reps })}
              />
              <Stepper
                label="Gewicht links"
                hideLabel
                compact
                suffix="kg"
                value={s.weight}
                step={exercise.increment}
                steps={weightSteps}
                min={0}
                onChange={(weight) => updateSet.mutate({ id: s.id, weight })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-semibold text-cocoa-light">Rechts</span>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Stepper
                label="Wdh rechts"
                hideLabel
                compact
                value={s.reps_right ?? 0}
                step={1}
                min={0}
                onChange={(reps_right) => updateSet.mutate({ id: s.id, reps_right })}
              />
              <Stepper
                label="Gewicht rechts"
                hideLabel
                compact
                suffix="kg"
                value={s.weight_right ?? 0}
                step={exercise.increment}
                steps={weightSteps}
                min={0}
                onChange={(weight_right) => updateSet.mutate({ id: s.id, weight_right })}
              />
            </div>
          </div>
        </div>
      ) : (
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
            step={exercise.increment}
            steps={weightSteps}
            min={0}
            onChange={(weight) => updateSet.mutate({ id: s.id, weight })}
          />
        </div>
      )}
    </div>
  )
}
