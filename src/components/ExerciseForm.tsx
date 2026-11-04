import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { ChevronDown, Sparkles, TriangleAlert } from 'lucide-react'
import type { ExerciseInput } from '../hooks/useExercises'
import { suggestMuscles } from '../lib/ai'
import { useAiGate } from '../hooks/usePremium'
import { PlusBadge } from './premium/PlusBadge'
import { generateLadder, parseLadder } from '../lib/weights'
import { MUSCLE_GROUPS, type MuscleGroup } from '../types'

export const EMPTY_EXERCISE: ExerciseInput = {
  name: '',
  muscle_group: 'Brust',
  notes: null,
  target_rep_min: 8,
  target_rep_max: 12,
  increment: 2.5,
  unilateral: false,
  weight_steps: null,
  secondary_muscles: [],
}

/** Formular-Werte aus einer bestehenden Übung. */
export function exerciseToInput(ex: {
  name: string
  muscle_group: MuscleGroup
  notes: string | null
  target_rep_min: number
  target_rep_max: number
  increment: number
  unilateral: boolean
  weight_steps: string | null
  secondary_muscles?: MuscleGroup[] | null
}): ExerciseInput {
  return {
    name: ex.name,
    muscle_group: ex.muscle_group,
    notes: ex.notes,
    target_rep_min: ex.target_rep_min,
    target_rep_max: ex.target_rep_max,
    increment: ex.increment,
    unilateral: ex.unilateral,
    weight_steps: ex.weight_steps,
    secondary_muscles: ex.secondary_muscles ?? [],
  }
}

/** Ungültige/leere Zahlenfelder absichern (DB verlangt min>0, max>=min, increment>0). */
export function cleanExerciseInput(form: ExerciseInput): ExerciseInput {
  const repMin = Math.max(1, Math.round(form.target_rep_min) || 1)
  const repMax = Math.max(repMin, Math.round(form.target_rep_max) || repMin)
  const increment = form.increment > 0 ? form.increment : 2.5
  return { ...form, target_rep_min: repMin, target_rep_max: repMax, increment }
}

const REP_PRESETS: { label: string; sub: string; min: number; max: number }[] = [
  { label: 'Kraft', sub: '4–8', min: 4, max: 8 },
  { label: 'Aufbau', sub: '8–12', min: 8, max: 12 },
  { label: 'Ausdauer', sub: '12–15', min: 12, max: 15 },
]
const STEP_PRESETS = [1, 2.5, 5]

const num = (v: string) => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 })

/** Gleichmäßige Stufen? Dann Start/Abstand/Ende, sonst null (Liste frei bearbeiten). */
function evenLadder(ladder: number[]): { start: number; step: number; max: number } | null {
  if (ladder.length < 2) return null
  const step = Math.round((ladder[1] - ladder[0]) * 100) / 100
  const even = ladder.every((v, i) => i === 0 || Math.abs(v - ladder[i - 1] - step) < 0.01)
  return even ? { start: ladder[0], step, max: ladder[ladder.length - 1] } : null
}

/**
 * Felder einer Übung – in einfachen Schritten: Name & Muskel, Ziel-Wiederholungen,
 * wie das Gewicht an der Maschine verstellt wird, einseitig, Geräte-Notiz.
 */
export function ExerciseForm({
  form,
  setForm,
  aiOn,
  autoFocus = false,
}: {
  form: ExerciseInput
  setForm: Dispatch<SetStateAction<ExerciseInput>>
  aiOn: boolean
  autoFocus?: boolean
}) {
  const gate = useAiGate()
  const [suggesting, setSuggesting] = useState(false)
  const [suggestErr, setSuggestErr] = useState<string | null>(null)
  const [moreMuscles, setMoreMuscles] = useState(form.secondary_muscles.length > 0)

  const preset = REP_PRESETS.find((p) => p.min === form.target_rep_min && p.max === form.target_rep_max)
  const [customReps, setCustomReps] = useState(!preset)

  const ladder = parseLadder(form.weight_steps)
  const [mode, setMode] = useState<'even' | 'steps'>(ladder.length ? 'steps' : 'even')
  const initial = evenLadder(ladder)
  const [gen, setGen] = useState({
    start: initial ? fmt(initial.start) : ladder.length ? fmt(ladder[0]) : '',
    step: initial ? fmt(initial.step) : '',
    max: initial ? fmt(initial.max) : ladder.length ? fmt(ladder[ladder.length - 1]) : '',
  })
  const [exact, setExact] = useState(ladder.length > 0 && !initial)
  const [customStep, setCustomStep] = useState(!STEP_PRESETS.includes(form.increment))

  function update(patch: Partial<ExerciseInput>) {
    setForm((f) => ({ ...f, ...patch }))
  }

  function updateGen(next: typeof gen) {
    setGen(next)
    const steps = generateLadder(num(next.start), [num(next.step)], num(next.max))
    update({ weight_steps: steps.length ? steps.map(fmtPlain).join(' ') : null })
  }

  function toggleSecondary(g: MuscleGroup) {
    setForm((f) => ({
      ...f,
      secondary_muscles: f.secondary_muscles.includes(g)
        ? f.secondary_muscles.filter((m) => m !== g)
        : [...f.secondary_muscles, g],
    }))
  }

  async function aiSuggestMuscles() {
    if (!form.name.trim() || !gate.requirePlus()) return
    setSuggesting(true)
    setSuggestErr(null)
    try {
      const s = await suggestMuscles(form.name.trim())
      setForm((f) => ({ ...f, muscle_group: s.primary, secondary_muscles: s.secondary.filter((m) => m !== s.primary) }))
      if (s.secondary.length) setMoreMuscles(true)
    } catch (err) {
      setSuggestErr(err instanceof Error ? err.message : 'KI-Fehler')
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. Übung */}
      <Block title="Übung">
        <input
          className="input"
          placeholder="Name, z. B. Brustpresse"
          value={form.name}
          autoFocus={autoFocus}
          onChange={(e) => update({ name: e.target.value })}
        />
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-cocoa-light">Welcher Muskel?</span>
          {aiOn && (
            <button
              type="button"
              onClick={aiSuggestMuscles}
              disabled={suggesting || !form.name.trim()}
              className="flex items-center gap-1 text-xs font-semibold text-brand disabled:opacity-40"
            >
              {suggesting ? (
                '… erkenne'
              ) : (
                <>
                  <Sparkles size={14} /> Erkennen
                  {gate.locked && <PlusBadge />}
                </>
              )}
            </button>
          )}
        </div>
        <Chips
          items={MUSCLE_GROUPS}
          isOn={(g) => g === form.muscle_group}
          onPick={(g) => update({ muscle_group: g, secondary_muscles: form.secondary_muscles.filter((m) => m !== g) })}
        />
        {suggestErr && (
          <p className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
            <TriangleAlert size={14} className="shrink-0" /> {suggestErr}
          </p>
        )}
        <Disclosure
          open={moreMuscles}
          onToggle={() => setMoreMuscles((v) => !v)}
          label={
            form.secondary_muscles.length
              ? `Hilft auch: ${form.secondary_muscles.join(', ')}`
              : 'Hilft noch anderen Muskeln? (optional)'
          }
        >
          <Chips
            items={MUSCLE_GROUPS.filter((g) => g !== form.muscle_group)}
            isOn={(g) => form.secondary_muscles.includes(g)}
            onPick={toggleSecondary}
            small
          />
        </Disclosure>
      </Block>

      {/* 2. Wiederholungen */}
      <Block title="Ziel-Wiederholungen">
        <div className="grid grid-cols-2 gap-1.5">
          {REP_PRESETS.map((p) => {
            const on = !customReps && preset === p
            return (
              <Seg
                key={p.label}
                on={on}
                onClick={() => {
                  setCustomReps(false)
                  update({ target_rep_min: p.min, target_rep_max: p.max })
                }}
                label={p.label}
                sub={p.sub}
              />
            )
          })}
          <Seg
            on={customReps}
            onClick={() => setCustomReps(true)}
            label="Eigene"
            sub={`${form.target_rep_min}–${form.target_rep_max}`}
          />
        </div>
        {customReps && (
          <div className="flex items-center gap-2">
            <NumField label="von" value={form.target_rep_min} onChange={(v) => update({ target_rep_min: v })} integer />
            <span className="pt-5 text-cocoa-muted">–</span>
            <NumField label="bis" value={form.target_rep_max} onChange={(v) => update({ target_rep_max: v })} integer />
            <span className="pt-5 text-sm text-cocoa-light">Wdh.</span>
          </div>
        )}
        <p className="text-xs text-cocoa-muted">Schaffst du oben im Bereich, schlägt die App mehr Gewicht vor.</p>
      </Block>

      {/* 3. Gewicht */}
      <Block title="Gewicht verstellen">
        <div className="grid grid-cols-2 gap-1.5">
          <Seg
            on={mode === 'even'}
            onClick={() => {
              setMode('even')
              update({ weight_steps: null })
            }}
            label="Freie Gewichte"
            sub="Hanteln, Scheiben"
          />
          <Seg
            on={mode === 'steps'}
            onClick={() => {
              setMode('steps')
              if (gen.start && gen.step && gen.max) updateGen(gen)
            }}
            label="Maschine"
            sub="feste Stufen"
          />
        </div>

        {mode === 'even' ? (
          <>
            <span className="block pt-1 text-sm text-cocoa-light">Um wie viel kg steigerst du?</span>
            <div className="grid grid-cols-4 gap-1.5">
              {STEP_PRESETS.map((s) => (
                <Seg
                  key={s}
                  on={!customStep && form.increment === s}
                  onClick={() => {
                    setCustomStep(false)
                    update({ increment: s })
                  }}
                  label={`${fmt(s)} kg`}
                />
              ))}
              <Seg on={customStep} onClick={() => setCustomStep(true)} label="Andere" />
            </div>
            {customStep && (
              <NumField label="kg pro Schritt" value={form.increment} onChange={(v) => update({ increment: v })} />
            )}
          </>
        ) : (
          <>
            {!exact ? (
              <>
                <span className="block pt-1 text-sm text-cocoa-light">Wie sind die Stufen an der Maschine?</span>
                <div className="flex items-end gap-2">
                  <TextNum label="leichteste" value={gen.start} onChange={(v) => updateGen({ ...gen, start: v })} />
                  <TextNum label="Abstand" value={gen.step} onChange={(v) => updateGen({ ...gen, step: v })} />
                  <TextNum label="schwerste" value={gen.max} onChange={(v) => updateGen({ ...gen, max: v })} />
                </div>
              </>
            ) : (
              <>
                <span className="block pt-1 text-sm text-cocoa-light">Alle Stufen, mit Leerzeichen getrennt</span>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="z. B. 4 9 13 18 22"
                  value={form.weight_steps ?? ''}
                  onChange={(e) => update({ weight_steps: e.target.value || null })}
                />
              </>
            )}
            <LadderPreview ladder={parseLadder(form.weight_steps)} />
            <button
              type="button"
              className="text-xs font-semibold text-brand"
              onClick={() => {
                if (exact && gen.start && gen.step && gen.max) updateGen(gen)
                setExact((v) => !v)
              }}
            >
              {exact ? 'Gleichmäßige Stufen eingeben' : 'Abstände unregelmäßig? Stufen einzeln eintragen'}
            </button>
          </>
        )}
      </Block>

      {/* 4. Sonstiges */}
      <Block title="Mehr">
        <button
          type="button"
          onClick={() => update({ unilateral: !form.unilateral })}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-[15px] font-medium text-cocoa">Einseitig</span>
            <span className="block text-xs text-cocoa-muted">Links und rechts getrennt eintragen</span>
          </span>
          <span
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${form.unilateral ? 'bg-brand' : 'bg-sand-dark'}`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
                form.unilateral ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </span>
        </button>
        <input
          className="input"
          placeholder="Geräte-Einstellung, z. B. Sitz 4, Lehne 2"
          value={form.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value || null })}
        />
      </Block>
    </div>
  )
}

const fmtPlain = (n: number) => String(Math.round(n * 100) / 100)

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{title}</h3>
      <div className="space-y-2 rounded-2xl bg-sand-light p-3 dark:bg-sand/60">{children}</div>
    </section>
  )
}

function Seg({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-w-0 rounded-xl px-2 py-2 text-center transition active:scale-95 ${
        on ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa'
      }`}
    >
      <span className="block truncate text-sm font-semibold">{label}</span>
      {sub && <span className={`block truncate text-[11px] ${on ? 'opacity-80' : 'text-cocoa-muted'}`}>{sub}</span>}
    </button>
  )
}

function Chips<T extends string>({
  items,
  isOn,
  onPick,
  small = false,
}: {
  items: readonly T[]
  isOn: (v: T) => boolean
  onPick: (v: T) => void
  small?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((g) => {
        const on = isOn(g)
        return (
          <button
            key={g}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(g)}
            className={`rounded-full font-medium transition active:scale-95 ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              on ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa-light'
            }`}
          >
            {g}
          </button>
        )
      })}
    </div>
  )
}

function Disclosure({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean
  onToggle: () => void
  label: string
  children: ReactNode
}) {
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left text-sm text-cocoa-light"
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="anim-fade pt-2">{children}</div>}
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  integer = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  integer?: boolean
}) {
  return (
    <label className="block flex-1">
      <span className="mb-1 block text-[11px] text-cocoa-muted">{label}</span>
      <input
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        className="input text-center"
        value={Number.isFinite(value) ? value : ''}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function TextNum({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-[11px] text-cocoa-muted">{label} (kg)</span>
      <input
        className="input text-center"
        inputMode="decimal"
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

/** Vorschau der Stufen – so sieht man sofort, ob es stimmt. */
function LadderPreview({ ladder }: { ladder: number[] }) {
  if (!ladder.length)
    return <p className="text-xs text-cocoa-muted">Trag die Werte ein – +/− springt dann genau auf diese Stufen.</p>
  const shown = ladder.length > 10 ? [...ladder.slice(0, 6), null, ...ladder.slice(-2)] : ladder
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {shown.map((v, i) =>
          v == null ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-cocoa-muted">
              …
            </span>
          ) : (
            <span key={i} className="tabular rounded-lg bg-sand px-2 py-0.5 text-xs font-semibold text-cocoa">
              {fmt(v)}
            </span>
          ),
        )}
      </div>
      <p className="mt-1 text-[11px] text-cocoa-muted">{ladder.length} Stufen · +/− springt genau auf diese Werte</p>
    </div>
  )
}
