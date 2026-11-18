import { useEffect, useState } from 'react'
import { ArrowDown, Flame, Minus, MoreHorizontal, Plus } from 'lucide-react'
import { SetOptionsSheet } from './workout/SetOptionsSheet'
import { useDeleteSet, useUpdateSet } from '../hooks/useWorkouts'
import { ladderStep, parseLadder, snapToLadder } from '../lib/weights'
import { SET_TYPE_LABEL, type Exercise, type WorkoutSet } from '../types'

/** Editierbare Satz-Zeile (Typ, Versagen, Wdh/Gewicht, ggf. links/rechts). */
export function EditableSetRow({
  set,
  exercise,
  onMove,
  workingNo,
}: {
  set: WorkoutSet
  exercise: Exercise
  onMove?: { up: (() => void) | null; down: (() => void) | null }
  /** Nummer unter den Arbeitssätzen („1“, „2“ …) */
  workingNo?: string
}) {
  return <CompactEditRow set={set} exercise={exercise} onMove={onMove} workingNo={workingNo} />
}

// ---------------------------------------------------------------------------
// Schlanke Zeile wie im Training (CompactSetRow), ohne Abhaken
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

function CompactEditRow({
  set: s,
  exercise,
  onMove,
  workingNo,
}: {
  set: WorkoutSet
  exercise: Exercise
  onMove?: { up: (() => void) | null; down: (() => void) | null }
  workingNo?: string
}) {
  const update = useUpdateSet()
  const del = useDeleteSet()
  const [open, setOpen] = useState(false)
  const ladder = parseLadder(exercise.weight_steps)
  const steps = ladder.length ? ladder : undefined
  const uni = exercise.unilateral
  // Wie im Training: Symbol für Aufwärmen/Drop, Arbeitssätze durchgezählt
  const badge = workingNo ?? String(s.set_number)

  return (
    <div className="rounded-xl p-1">
      <div className={GRID}>
        <span
          className={`relative grid h-8 place-items-center rounded-lg bg-sand text-sm font-bold tabular ${
            s.set_type === 'working' ? 'text-cocoa' : 'text-cocoa-light'
          }`}
          title={SET_TYPE_LABEL[s.set_type]}
        >
          {s.set_type === 'warmup' ? <Flame size={14} /> : s.set_type === 'drop' ? <ArrowDown size={14} /> : badge}
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
        <SetOptionsSheet
          set={s}
          badge={badge}
          done={s.reps > 0}
          onType={(set_type) => update.mutate({ id: s.id, set_type })}
          onFailure={(to_failure) => update.mutate({ id: s.id, to_failure })}
          onMove={onMove}
          onDelete={() => del.mutate(s)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
