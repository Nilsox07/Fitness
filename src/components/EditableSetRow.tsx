import { useEffect, useState } from 'react'
import { Flame, Minus, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { Stepper } from './Stepper'
import { useDeleteSet, useUpdateSet } from '../hooks/useWorkouts'
import { ladderStep, parseLadder, snapToLadder } from '../lib/weights'
import { usePrefs } from '../lib/prefs'
import { SET_TYPES, SET_TYPE_LABEL, SET_TYPE_SHORT, type Exercise, type WorkoutSet } from '../types'

/** Editierbare Satz-Zeile (Typ, Versagen, Wdh/Gewicht, ggf. links/rechts). */
export function EditableSetRow({ set, exercise }: { set: WorkoutSet; exercise: Exercise }) {
  const { isNew } = usePrefs()
  return isNew ? <CompactEditRow set={set} exercise={exercise} /> : <ClassicEditRow set={set} exercise={exercise} />
}

function ClassicEditRow({ set: s, exercise }: { set: WorkoutSet; exercise: Exercise }) {
  const updateSet = useUpdateSet()
  const deleteSet = useDeleteSet()
  const ladder = parseLadder(exercise.weight_steps)
  const weightSteps = ladder.length ? ladder : undefined

  return (
    <div className="rounded-xl bg-sand-light p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {SET_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => updateSet.mutate({ id: s.id, set_type: t })}
              className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-colors duration-200 ${
                s.set_type === t ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
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
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors duration-200 ${
              s.to_failure ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
            }`}
          >
            {s.to_failure ? (
              <>
                <Flame size={12} /> Versagen
              </>
            ) : (
              'nicht ans Limit'
            )}
          </button>
          <button
            className="grid h-7 w-7 place-items-center rounded-full text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
            aria-label="Satz löschen"
            onClick={() => deleteSet.mutate(s)}
          >
            <Trash2 size={15} />
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

// ---------------------------------------------------------------------------
// Neue App: schlanke Zeile wie im Training (CompactSetRow), ohne Abhaken
// ---------------------------------------------------------------------------

const fmtInput = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false })
const parseNum = (raw: string) => parseFloat(raw.trim().replace(',', '.'))

/** Kleines Zahlenfeld mit −/+ (wie im Training). */
function MiniStepper({
  label,
  value,
  onChange,
  step = 1,
  steps,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  steps?: number[]
}) {
  const hasLadder = !!steps && steps.length > 0
  const [text, setText] = useState(fmtInput(value))
  useEffect(() => setText(fmtInput(value)), [value])

  const clamp = (v: number) => Math.max(0, Math.round(v * 100) / 100)
  function commit(raw: string) {
    const n = parseNum(raw)
    const next = Number.isNaN(n) ? 0 : hasLadder ? snapToLadder(n, steps!) : clamp(n)
    setText(fmtInput(next))
    if (next !== value) onChange(next)
  }
  function adjust(delta: number) {
    const parsed = parseNum(text)
    const base = Number.isNaN(parsed) ? value : parsed
    const next = hasLadder ? ladderStep(base, steps!, delta) : clamp(base + delta)
    setText(fmtInput(next))
    onChange(next)
  }

  return (
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-lg bg-sand">
      <button
        type="button"
        className="grid w-7 shrink-0 place-items-center text-cocoa-light transition active:bg-sand-dark"
        onClick={() => adjust(-step)}
        aria-label={`${label} verringern`}
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <input
        type="text"
        inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
        className={`tabular w-full min-w-0 bg-transparent px-0 py-1.5 text-center font-semibold text-cocoa outline-none focus:bg-sand-light focus:ring-2 focus:ring-inset focus:ring-brand ${
          text.length >= 5 ? 'text-sm tracking-tight' : 'text-[15px]'
        }`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.target.value)}
        aria-label={label}
      />
      <button
        type="button"
        className="grid w-7 shrink-0 place-items-center text-cocoa-light transition active:bg-sand-dark"
        onClick={() => adjust(step)}
        aria-label={`${label} erhöhen`}
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}

const GRID = 'grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-1.5'

function CompactEditRow({ set: s, exercise }: { set: WorkoutSet; exercise: Exercise }) {
  const update = useUpdateSet()
  const del = useDeleteSet()
  const [open, setOpen] = useState(false)
  const ladder = parseLadder(exercise.weight_steps)
  const steps = ladder.length ? ladder : undefined
  const uni = exercise.unilateral
  const badge = s.set_type === 'warmup' ? 'W' : s.set_type === 'drop' ? 'D' : String(s.set_number)

  return (
    <div className={`rounded-xl p-1 transition-colors duration-200 ${open ? 'bg-sand-light' : ''}`}>
      <div className={GRID}>
        <span
          className={`relative grid h-8 place-items-center rounded-lg bg-sand text-sm font-bold tabular ${
            s.set_type === 'working' ? 'text-cocoa' : 'text-cocoa-light'
          }`}
          title={SET_TYPE_LABEL[s.set_type]}
        >
          {badge}
          {!s.to_failure && s.set_type !== 'warmup' && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cocoa-muted" />
          )}
        </span>
        <MiniStepper
          label={uni ? 'Gewicht links' : 'Gewicht'}
          value={s.weight}
          step={exercise.increment}
          steps={steps}
          onChange={(weight) => update.mutate({ id: s.id, weight })}
        />
        <MiniStepper
          label={uni ? 'Wdh links' : 'Wdh'}
          value={s.reps}
          onChange={(reps) => update.mutate({ id: s.id, reps })}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Satz-Optionen"
          aria-expanded={open}
          className={`grid h-8 w-8 place-items-center rounded-lg transition active:scale-90 ${
            open ? 'bg-sand-dark text-cocoa' : 'text-cocoa-muted'
          }`}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {uni && (
        <div className={`${GRID} mt-1`}>
          <span className="text-center text-[10px] font-semibold text-cocoa-muted">R</span>
          <MiniStepper
            label="Gewicht rechts"
            value={s.weight_right ?? 0}
            step={exercise.increment}
            steps={steps}
            onChange={(weight_right) => update.mutate({ id: s.id, weight_right })}
          />
          <MiniStepper
            label="Wdh rechts"
            value={s.reps_right ?? 0}
            onChange={(reps_right) => update.mutate({ id: s.id, reps_right })}
          />
          <span />
        </div>
      )}

      {open && (
        <div className="anim-fade mt-1.5 flex flex-wrap items-center gap-1.5 px-1 pb-0.5 pt-1">
          {SET_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update.mutate({ id: s.id, set_type: t })}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                s.set_type === t ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
              }`}
            >
              {SET_TYPE_LABEL[t]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => update.mutate({ id: s.id, to_failure: !s.to_failure })}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              s.to_failure ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
            }`}
          >
            {s.to_failure ? 'Bis Versagen' : 'Nicht ans Limit'}
          </button>
          <button
            type="button"
            onClick={() => del.mutate(s)}
            aria-label="Satz löschen"
            className="ml-auto grid h-7 w-7 place-items-center rounded-full text-red-500"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
