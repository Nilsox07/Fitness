import { useEffect, useState } from 'react'
import { Check, Minus, Plus, Trash2 } from 'lucide-react'
import { useDeleteSet, useUpdateSet } from '../../hooks/useWorkouts'
import { ladderStep, parseLadder, snapToLadder } from '../../lib/weights'
import { SET_TYPES, SET_TYPE_LABEL, type Exercise, type WorkoutSet } from '../../types'

export interface PrevSet {
  reps: number
  weight: number
  reps_right?: number | null
  weight_right?: number | null
}

const fmt = (n: number) => n.toLocaleString('de-DE')

export function isSetDone(s: WorkoutSet, unilateral: boolean): boolean {
  return s.reps > 0 || (unilateral && (s.reps_right ?? 0) > 0)
}

/** Kleines Zahlenfeld mit −/+ (schmal genug für eine Zeile). */
function MiniStepper({
  label,
  value,
  onChange,
  step = 1,
  steps,
  dim,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  steps?: number[]
  dim?: boolean
}) {
  const hasLadder = !!steps && steps.length > 0
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const clamp = (v: number) => Math.max(0, Math.round(v * 100) / 100)
  function commit(raw: string) {
    const n = parseFloat(raw.replace(',', '.'))
    const next = Number.isNaN(n) ? 0 : hasLadder ? snapToLadder(n, steps!) : clamp(n)
    setText(String(next))
    if (next !== value) onChange(next)
  }
  function adjust(delta: number) {
    const parsed = parseFloat(text.replace(',', '.'))
    const base = Number.isNaN(parsed) ? value : parsed
    const next = hasLadder ? ladderStep(base, steps!, delta) : clamp(base + delta)
    setText(String(next))
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
        className={`tabular w-full min-w-0 bg-transparent py-1.5 text-center text-[15px] font-semibold outline-none focus:bg-sand-light focus:ring-2 focus:ring-inset focus:ring-brand ${
          dim ? 'text-cocoa-muted' : 'text-cocoa'
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

const GRID = 'grid grid-cols-[2rem_3rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center gap-1.5'

/** Spaltenköpfe passend zu den Zeilen. */
export function SetTableHeader() {
  return (
    <div className={`${GRID} px-1 text-[10px] font-semibold uppercase tracking-wide text-cocoa-muted`}>
      <span className="text-center">Satz</span>
      <span>Vorher</span>
      <span className="text-center">kg</span>
      <span className="text-center">Wdh</span>
      <span className="grid place-items-center">
        <Check size={12} strokeWidth={3} />
      </span>
    </div>
  )
}

/**
 * Eine Satz-Zeile im Hevy-Stil. Antippen des Kürzels links klappt die
 * Satz-Optionen auf (Typ, Versagen, Löschen) — so bleibt die Zeile schlank.
 */
export function CompactSetRow({
  set: s,
  exercise,
  badge,
  prev,
  onDone,
}: {
  set: WorkoutSet
  exercise: Exercise
  badge: string
  prev: PrevSet | null
  onDone: () => void
}) {
  const update = useUpdateSet()
  const del = useDeleteSet()
  const [open, setOpen] = useState(false)
  const ladder = parseLadder(exercise.weight_steps)
  const steps = ladder.length ? ladder : undefined
  const uni = exercise.unilateral
  const done = isSetDone(s, uni)

  function complete() {
    if (done) return
    const reps = prev?.reps || exercise.target_rep_min || 8
    update.mutate({
      id: s.id,
      reps: s.reps || reps,
      ...(uni ? { reps_right: s.reps_right || prev?.reps_right || reps } : {}),
    })
    onDone()
  }

  function setReps(key: 'reps' | 'reps_right', v: number) {
    const wasDone = done
    update.mutate({ id: s.id, [key]: v })
    if (!wasDone && v > 0) onDone()
  }

  return (
    <div className={`rounded-xl p-1 transition-colors duration-200 ${done ? 'bg-success/10' : ''}`}>
      <div className={GRID}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`relative h-8 rounded-lg text-sm font-bold tabular ${
            s.set_type === 'working' ? 'text-cocoa' : 'text-cocoa-light'
          } ${open ? 'bg-sand-dark' : 'bg-sand'}`}
          aria-label="Satz-Optionen"
        >
          {badge}
          {!s.to_failure && s.set_type !== 'warmup' && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cocoa-muted" />
          )}
        </button>
        <span className="tabular truncate text-xs text-cocoa-muted">
          {prev ? `${fmt(prev.weight)}×${prev.reps}` : '–'}
        </span>
        <MiniStepper
          label="Gewicht"
          value={s.weight}
          step={exercise.increment}
          steps={steps}
          dim={!done}
          onChange={(weight) => update.mutate({ id: s.id, weight })}
        />
        <MiniStepper
          label="Wdh"
          value={s.reps}
          dim={!done}
          onChange={(v) => setReps('reps', v)}
        />
        <button
          type="button"
          onClick={complete}
          aria-label={done ? 'Satz erledigt' : 'Satz abhaken'}
          className={`grid h-8 w-9 place-items-center rounded-lg transition active:scale-90 ${
            done ? 'anim-check bg-success text-white' : 'bg-sand text-cocoa-muted'
          }`}
        >
          <Check size={18} strokeWidth={3} />
        </button>
      </div>

      {uni && (
        <div className={`${GRID} mt-1`}>
          <span className="text-center text-[10px] font-semibold text-cocoa-muted">R</span>
          <span className="truncate text-xs text-cocoa-muted">
            {prev?.reps_right != null ? `${fmt(prev.weight_right ?? prev.weight)}×${prev.reps_right}` : ''}
          </span>
          <MiniStepper
            label="Gewicht rechts"
            value={s.weight_right ?? 0}
            step={exercise.increment}
            steps={steps}
            dim={!done}
            onChange={(weight_right) => update.mutate({ id: s.id, weight_right })}
          />
          <MiniStepper
            label="Wdh rechts"
            value={s.reps_right ?? 0}
            dim={!done}
            onChange={(v) => setReps('reps_right', v)}
          />
          <span />
        </div>
      )}

      {open && (
        <div className="anim-fade mt-1.5 flex flex-wrap items-center gap-1.5 px-1 pt-1">
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
