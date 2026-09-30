import { useEffect, useState } from 'react'
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
    <div className="flex min-w-0 items-stretch">
      <button
        type="button"
        className="w-7 shrink-0 rounded-l-lg bg-sand-dark/40 text-cocoa-light active:bg-sand-dark"
        onClick={() => adjust(-step)}
        aria-label={`${label} verringern`}
      >
        −
      </button>
      <input
        type="text"
        inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
        className={`w-full min-w-0 bg-sand-light py-1.5 text-center text-sm font-semibold outline-none ring-1 ring-inset ring-sand-dark focus:ring-2 focus:ring-brand ${
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
        className="w-7 shrink-0 rounded-r-lg bg-sand-dark/40 text-cocoa-light active:bg-sand-dark"
        onClick={() => adjust(step)}
        aria-label={`${label} erhöhen`}
      >
        +
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
      <span className="text-center">✓</span>
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

  const badgeColor =
    s.set_type === 'warmup'
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
      : s.set_type === 'drop'
        ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
        : 'bg-sand-dark/50 text-cocoa'

  return (
    <div
      className={`rounded-xl p-1 transition-colors ${
        done ? 'bg-brand/10 ring-1 ring-brand/25' : 'ring-1 ring-transparent'
      }`}
    >
      <div className={GRID}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`relative h-8 rounded-lg text-sm font-bold ${badgeColor}`}
          aria-label="Satz-Optionen"
        >
          {badge}
          {!s.to_failure && s.set_type !== 'warmup' && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cocoa-muted" />
          )}
        </button>
        <span className="truncate text-xs text-cocoa-muted">
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
          className={`grid h-8 w-9 place-items-center rounded-lg text-base font-bold transition active:scale-90 ${
            done ? 'bg-brand text-white' : 'bg-sand-dark/40 text-cocoa-muted'
          }`}
        >
          ✓
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
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-sand-dark/50 px-1 pt-1.5">
          {SET_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update.mutate({ id: s.id, set_type: t })}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                s.set_type === t ? 'bg-brand text-white' : 'bg-sand-dark/40 text-cocoa-light'
              }`}
            >
              {SET_TYPE_LABEL[t]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => update.mutate({ id: s.id, to_failure: !s.to_failure })}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              s.to_failure ? 'bg-orange-500 text-white' : 'bg-sand-dark/40 text-cocoa-light'
            }`}
          >
            {s.to_failure ? '🔥 bis Versagen' : 'nicht ans Limit'}
          </button>
          <button
            type="button"
            onClick={() => del.mutate(s)}
            className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-red-500"
          >
            Löschen
          </button>
        </div>
      )}
    </div>
  )
}
