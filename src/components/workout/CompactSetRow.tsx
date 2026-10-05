import { useEffect, useRef, useState } from 'react'
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
/** Eingabefeld-Text: deutsches Komma, ohne Tausenderpunkt („22,5", „102,5"). */
const fmtInput = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false })
const parseNum = (raw: string) => parseFloat(raw.trim().replace(',', '.'))

export function isSetDone(s: WorkoutSet, unilateral: boolean): boolean {
  return s.reps > 0 || (unilateral && (s.reps_right ?? 0) > 0)
}

/**
 * Kleines Zahlenfeld mit −/+ (schmal genug für eine Zeile).
 * onChange bekommt mit, ob der Wert getippt (Feld verlassen) oder per −/+ kam.
 */
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
  onChange: (v: number, via: 'input' | 'step') => void
  step?: number
  steps?: number[]
  dim?: boolean
}) {
  const hasLadder = !!steps && steps.length > 0
  const [text, setText] = useState(fmtInput(value))
  useEffect(() => setText(fmtInput(value)), [value])

  const clamp = (v: number) => Math.max(0, Math.round(v * 100) / 100)
  function commit(raw: string) {
    const n = parseNum(raw)
    const next = Number.isNaN(n) ? 0 : hasLadder ? snapToLadder(n, steps!) : clamp(n)
    setText(fmtInput(next))
    if (next !== value) onChange(next, 'input')
  }
  function adjust(delta: number) {
    const parsed = parseNum(text)
    const base = Number.isNaN(parsed) ? value : parsed
    const next = hasLadder ? ladderStep(base, steps!, delta) : clamp(base + delta)
    setText(fmtInput(next))
    onChange(next, 'step')
  }

  return (
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl bg-sand">
      <button
        type="button"
        className="grid w-6 shrink-0 place-items-center text-cocoa-light transition active:bg-sand-dark"
        onClick={() => adjust(-step)}
        aria-label={`${label} verringern`}
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <input
        type="text"
        inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
        className={`tabular w-full min-w-0 bg-transparent px-0 py-2 text-center font-semibold outline-none focus:bg-sand-light focus:ring-2 focus:ring-inset focus:ring-brand ${
          text.length >= 5 ? 'text-sm tracking-tight' : 'text-[15px]'
        } ${dim ? 'text-cocoa-muted' : 'text-cocoa'}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.target.value)}
        aria-label={label}
      />
      <button
        type="button"
        className="grid w-6 shrink-0 place-items-center text-cocoa-light transition active:bg-sand-dark"
        onClick={() => adjust(step)}
        aria-label={`${label} erhöhen`}
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}

// Schmale „Vorher"-Spalte + enger Abstand, damit auch „102,5" bei 390 px Breite ins Feld passt.
const GRID = 'grid grid-cols-[2rem_2.75rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center gap-1'

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
  // onDone nur einmal pro Abschluss (z. B. Wdh tippen → Feld verlassen → gleich ✓).
  const fired = useRef(false)
  useEffect(() => {
    if (!done) fired.current = false
  }, [done])
  function fireDone() {
    if (fired.current) return
    fired.current = true
    onDone()
  }

  function complete() {
    if (done) return
    const reps = prev?.reps || exercise.target_rep_min || 8
    update.mutate({
      id: s.id,
      reps: s.reps || reps,
      ...(uni ? { reps_right: s.reps_right || prev?.reps_right || reps } : {}),
    })
    fireDone()
  }

  // Nur ✓ oder fertig eingetippte Wdh (Feld verlassen) lösen Pause/Supersatz-Sprung
  // aus — ein Tipp auf „+" (0 → 1) ist noch kein abgeschlossener Satz.
  function setReps(key: 'reps' | 'reps_right', v: number, via: 'input' | 'step') {
    const wasDone = done
    update.mutate({ id: s.id, [key]: v })
    if (via === 'input' && !wasDone && v > 0) fireDone()
  }

  // Nach links wischen = löschen (wie Hevy/Strong). Nur waagerechte Gesten zählen,
  // damit Scrollen und die −/+-Knöpfe normal funktionieren.
  const [dx, setDx] = useState(0)
  const [removing, setRemoving] = useState(false)
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null)
  const SWIPE_DELETE = 110

  function remove() {
    if (removing) return
    setRemoving(true)
    try {
      navigator.vibrate?.(20)
    } catch {
      /* ignore */
    }
    window.setTimeout(() => del.mutate(s), 180)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') return
    drag.current = { x: e.clientX, y: e.clientY, active: false }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
        drag.current = null
        return
      }
      if (mx < -12 && Math.abs(mx) > Math.abs(my) * 1.5) d.active = true
      else return
    }
    setDx(Math.min(0, Math.max(-200, mx)))
  }
  function onPointerEnd() {
    const d = drag.current
    drag.current = null
    if (!d?.active) return
    if (dx <= -SWIPE_DELETE) {
      setDx(-400)
      remove()
    } else setDx(0)
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl transition-[max-height,opacity] duration-200 ${
        removing ? 'max-h-0 opacity-0' : 'max-h-96'
      }`}
    >
      {dx < 0 && (
        <div
          className={`absolute inset-0 flex items-center justify-end gap-1.5 rounded-2xl pr-4 text-sm font-semibold text-white transition-colors ${
            dx <= -SWIPE_DELETE ? 'bg-red-500' : 'bg-red-400/80'
          }`}
          aria-hidden
        >
          <Trash2 size={16} /> Löschen
        </div>
      )}
      <div
        className={`relative rounded-2xl p-1 transition-colors duration-200 ${done && !dx ? 'bg-success/10' : ''} ${
          dx < 0 ? 'bg-cream' : ''
        }`}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: drag.current?.active ? 'none' : 'transform 180ms ease-out',
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {done && dx < 0 && <div className="pointer-events-none absolute inset-0 rounded-2xl bg-success/10" />}
        <div className={`${GRID} relative`}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`relative h-9 rounded-xl text-sm font-bold tabular ${
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
          <MiniStepper label="Wdh" value={s.reps} dim={!done} onChange={(v, via) => setReps('reps', v, via)} />
          <button
            type="button"
            onClick={complete}
            aria-label={done ? 'Satz erledigt' : 'Satz abhaken'}
            className={`grid h-9 w-9 place-items-center rounded-xl transition active:scale-90 ${
              done ? 'anim-check bg-success text-white shadow-sm shadow-success/30' : 'bg-sand text-cocoa-muted'
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
              onChange={(v, via) => setReps('reps_right', v, via)}
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
              onClick={remove}
              aria-label="Satz löschen"
              className="ml-auto flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-500"
            >
              <Trash2 size={13} /> Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
