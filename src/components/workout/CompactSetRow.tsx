import { useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/native'
import { ArrowDown, Check, Flame, Minus, Plus, Trash2 } from 'lucide-react'
import { SetOptionsSheet, type SetOrderItem } from './SetOptionsSheet'
import { useDeleteSet, useUpdateSet } from '../../hooks/useWorkouts'
import { ladderStep, parseLadder, snapToLadder } from '../../lib/weights'
import { SET_TYPE_LABEL, type Exercise, type SetType, type WorkoutSet } from '../../types'

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
  unit,
}: {
  label: string
  value: number
  onChange: (v: number, via: 'input' | 'step') => void
  step?: number
  steps?: number[]
  dim?: boolean
  /** Einheit klein unter der Zahl („kg“, „Wdh.“) */
  unit?: string
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
    <div className="flex h-12 min-w-0 items-stretch overflow-hidden rounded-xl bg-sand">
      <button
        type="button"
        className="grid w-8 shrink-0 place-items-center text-cocoa-light transition active:bg-sand-dark"
        onClick={() => adjust(-step)}
        aria-label={`${label} verringern`}
      >
        <Minus size={16} strokeWidth={2.5} />
      </button>
      <label className="flex min-w-0 flex-1 flex-col items-center justify-center focus-within:bg-sand-light focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand">
        <input
          type="text"
          inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
          className={`tabular w-full min-w-0 bg-transparent p-0 text-center font-bold leading-none outline-none ${
            text.length >= 5 ? 'text-base tracking-tight' : 'text-lg'
          } ${dim ? 'text-cocoa-muted' : 'text-cocoa'}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.target.value)}
          aria-label={label}
        />
        {unit && <span className="mt-0.5 text-[10px] font-medium leading-none text-cocoa-muted">{unit}</span>}
      </label>
      <button
        type="button"
        className="grid w-8 shrink-0 place-items-center text-cocoa-light transition active:bg-sand-dark"
        onClick={() => adjust(step)}
        aria-label={`${label} erhöhen`}
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}

/** So lange nach dem letzten −/+ bei den Wdh warten, bevor der Satz als fertig gilt. */
export const STEP_SETTLE_MS = 2000

// Satz · Gewicht · Wiederholungen · Haken – Einheiten stehen in den Feldern, „letztes Mal“ darunter.
const GRID = 'grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5'

/** Früher Spaltenköpfe – die Felder sind jetzt selbst beschriftet. */
export function SetTableHeader() {
  return null
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
  onMove,
  order,
  onMoveTo,
  onChangeType,
  flash = false,
}: {
  set: WorkoutSet
  exercise: Exercise
  badge: string
  prev: PrevSet | null
  onDone: () => void
  /** Satz in der Reihenfolge verschieben; null = in diese Richtung geht's nicht */
  onMove?: { up: (() => void) | null; down: (() => void) | null }
  /** Alle Sätze der Übung (für die Reihenfolge im Satz-Menü) */
  order?: SetOrderItem[]
  onMoveTo?: (index: number) => void
  /** Typ ändern inkl. Einsortieren (sonst nur Typ speichern) */
  onChangeType?: (t: SetType) => void
  /** Kurz hervorheben (gerade hinzugefügt) */
  flash?: boolean
}) {
  const update = useUpdateSet()
  const del = useDeleteSet()
  const [open, setOpen] = useState(false)
  // Hervorheben + ins Bild holen: nach Hinzufügen (flash) oder nach Verschieben im Satz-Menü
  const rowRef = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  const [glow, setGlow] = useState(false)
  function highlight() {
    setGlow(true)
    rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    window.setTimeout(() => setGlow(false), 1400)
  }
  useEffect(() => {
    if (flash) highlight()
  }, [flash])
  const trackedMove = onMove && {
    up: onMove.up && (() => ((moved.current = true), onMove.up!())),
    down: onMove.down && (() => ((moved.current = true), onMove.down!())),
  }
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
    void haptic('success')
    onDone()
  }

  function complete() {
    // Schon grün (Wdh per −/+ eingestellt), aber Pause noch nicht gestartet → ✓ bestätigt den Satz
    if (done) {
      fireDone()
      return
    }
    const reps = prev?.reps || exercise.target_rep_min || 8
    update.mutate({
      id: s.id,
      reps: s.reps || reps,
      ...(uni ? { reps_right: s.reps_right || prev?.reps_right || reps } : {}),
    })
    fireDone()
  }

  // ✓ oder fertig eingetippte Wdh (Feld verlassen) lösen die Pause sofort aus. Bei −/+ zählt erst,
  // wenn kurz nicht mehr getippt wird (0 → 1 → … → 10 ist ein Satz, nicht zehn) – vorher wurde der
  // Satz per „+“ grün, die Pause startete aber nie.
  const stepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(stepTimer.current), [])
  // War der Satz schon vor dem ersten −/+ erledigt? Dann ist es eine Korrektur – keine neue Pause.
  const seqWasDone = useRef<boolean | null>(null)
  function setReps(key: 'reps' | 'reps_right', v: number, via: 'input' | 'step') {
    update.mutate({ id: s.id, [key]: v })
    clearTimeout(stepTimer.current)
    if (via === 'input') {
      seqWasDone.current = null
      if (!done && v > 0) fireDone()
      return
    }
    seqWasDone.current ??= done
    const was = seqWasDone.current
    stepTimer.current = setTimeout(() => {
      seqWasDone.current = null
      if (!was && v > 0) fireDone()
    }, STEP_SETTLE_MS)
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
      ref={rowRef}
      className={`relative overflow-hidden rounded-2xl transition-[max-height,opacity,box-shadow,background-color] duration-300 ${
        removing ? 'max-h-0 opacity-0' : 'max-h-96'
      } ${glow ? 'bg-brand/10 ring-2 ring-brand' : ''}`}
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
            className={`grid h-12 place-items-center rounded-xl text-sm font-bold tabular ${
              s.set_type === 'working' ? 'text-cocoa' : 'text-cocoa-light'
            } ${open ? 'bg-sand-dark' : 'bg-sand'}`}
            aria-label={`${SET_TYPE_LABEL[s.set_type]} – Optionen`}
          >
            {s.set_type === 'warmup' ? <Flame size={16} /> : s.set_type === 'drop' ? <ArrowDown size={16} /> : badge}
          </button>
          <MiniStepper
            label="Gewicht"
            value={s.weight}
            step={exercise.increment}
            steps={steps}
            dim={!done}
            unit="kg"
            onChange={(weight) => update.mutate({ id: s.id, weight })}
          />
          <MiniStepper
            label="Wiederholungen"
            value={s.reps}
            dim={!done}
            unit="Wdh."
            onChange={(v, via) => setReps('reps', v, via)}
          />
          <button
            type="button"
            onClick={complete}
            aria-label={done ? 'Satz erledigt' : 'Satz abhaken'}
            className={`grid h-12 w-11 place-items-center rounded-xl transition active:scale-90 ${
              done ? 'anim-check bg-success text-white shadow-sm shadow-success/30' : 'bg-sand text-cocoa-muted'
            }`}
          >
            <Check size={20} strokeWidth={3} />
          </button>
        </div>

        {/* Satz-Art + letztes Mal (antippen = übernehmen) */}
        {(s.set_type !== 'working' || prev) && (
          <div className="mt-1 flex items-center gap-2 pl-[2.6rem] text-xs text-cocoa-muted">
            {s.set_type !== 'working' && (
              <span className="font-semibold text-cocoa-light">
                {s.set_type === 'warmup' ? 'Aufwärmsatz' : 'Dropsatz'}
              </span>
            )}
            {s.set_type !== 'working' && prev && <span aria-hidden>·</span>}
            {prev && (
              <button
                type="button"
                className="tabular truncate rounded-md py-0.5 text-left active:bg-sand"
                aria-label={`Wie letztes Mal übernehmen: ${fmt(prev.weight)} kg × ${prev.reps}`}
                onClick={() => {
                  update.mutate({
                    id: s.id,
                    weight: prev.weight,
                    reps: prev.reps,
                    ...(uni
                      ? { weight_right: prev.weight_right ?? prev.weight, reps_right: prev.reps_right ?? prev.reps }
                      : {}),
                  })
                  fireDone()
                }}
              >
                Letztes Mal{' '}
                <span className="font-semibold text-cocoa-light">
                  {fmt(prev.weight)} kg × {prev.reps}
                </span>
              </button>
            )}
          </div>
        )}

        {uni && (
          <div className={`${GRID} mt-1`}>
            <span className="text-center text-[10px] font-semibold text-cocoa-muted">rechts</span>
            <MiniStepper
              label="Gewicht rechts"
              value={s.weight_right ?? 0}
              step={exercise.increment}
              steps={steps}
              dim={!done}
              unit="kg"
              onChange={(weight_right) => update.mutate({ id: s.id, weight_right })}
            />
            <MiniStepper
              label="Wdh rechts"
              value={s.reps_right ?? 0}
              dim={!done}
              unit="Wdh."
              onChange={(v, via) => setReps('reps_right', v, via)}
            />
            <span />
          </div>
        )}

        {open && (
          <SetOptionsSheet
            set={s}
            badge={badge}
            done={done}
            onType={(set_type) => {
              if (set_type === s.set_type) return
              if (onChangeType) {
                moved.current = true
                onChangeType(set_type)
              } else update.mutate({ id: s.id, set_type })
            }}
            onFailure={(to_failure) => update.mutate({ id: s.id, to_failure })}
            onMove={trackedMove}
            order={order}
            onMoveTo={
              onMoveTo &&
              ((i) => {
                moved.current = true
                onMoveTo(i)
              })
            }
            onDelete={remove}
            onClose={() => {
              setOpen(false)
              if (moved.current) highlight()
              moved.current = false
            }}
          />
        )}
      </div>
    </div>
  )
}
