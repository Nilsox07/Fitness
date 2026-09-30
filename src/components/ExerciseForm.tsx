import { useState, type Dispatch, type SetStateAction } from 'react'
import { Sparkles, TriangleAlert } from 'lucide-react'
import type { ExerciseInput } from '../hooks/useExercises'
import { suggestMuscles } from '../lib/ai'
import { expandWithAddons, generateLadder } from '../lib/weights'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../types'

export const EMPTY_EXERCISE: ExerciseInput = {
  name: '',
  muscle_group: 'Brust',
  notes: null,
  target_rep_min: 4,
  target_rep_max: 8,
  increment: 2.5,
  unilateral: false,
  weight_steps: null,
  secondary_muscles: [],
}

/** Formular-Werte aus einer bestehenden Übung. */
export function exerciseToInput(ex: Exercise): ExerciseInput {
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

/** Die Felder einer Übung (Name, Muskeln, Wdh-Ziel, Schritt, einseitig, Notiz, Gewichtsstufen). */
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
  const [gen, setGen] = useState({ start: '', pattern: '', max: '', addons: '' })
  const [suggesting, setSuggesting] = useState(false)
  const [suggestErr, setSuggestErr] = useState<string | null>(null)

  function toggleSecondary(g: MuscleGroup) {
    setForm((f) => ({
      ...f,
      secondary_muscles: f.secondary_muscles.includes(g)
        ? f.secondary_muscles.filter((m) => m !== g)
        : [...f.secondary_muscles, g],
    }))
  }

  async function aiSuggestMuscles() {
    if (!form.name.trim()) return
    setSuggesting(true)
    setSuggestErr(null)
    try {
      const s = await suggestMuscles(form.name.trim())
      setForm((f) => ({
        ...f,
        muscle_group: s.primary,
        secondary_muscles: s.secondary.filter((m) => m !== s.primary),
      }))
    } catch (err) {
      setSuggestErr(err instanceof Error ? err.message : 'KI-Fehler')
    } finally {
      setSuggesting(false)
    }
  }

  function generateSteps() {
    const start = parseFloat(gen.start.replace(',', '.'))
    const max = parseFloat(gen.max.replace(',', '.'))
    const pattern = gen.pattern
      .split(/[\s;]+/)
      .map((t) => parseFloat(t.trim().replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0)
    const addons = gen.addons
      .split(/[\s;]+/)
      .map((t) => parseFloat(t.trim().replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0)
    const ladder = expandWithAddons(generateLadder(start, pattern, max), addons)
    if (ladder.length) setForm((f) => ({ ...f, weight_steps: ladder.join(' ') }))
  }

  return (
    <>
      <div>
        <label className="label">Name</label>
        <input
          className="input"
          value={form.name}
          autoFocus={autoFocus}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label">Muskelgruppe (primär)</label>
          {aiOn && (
            <button
              type="button"
              onClick={aiSuggestMuscles}
              disabled={suggesting || !form.name.trim()}
              className="flex items-center gap-1 text-xs font-semibold text-brand disabled:opacity-40"
            >
              {suggesting ? (
                '… analysiere'
              ) : (
                <>
                  <Sparkles size={14} /> Muskeln vorschlagen
                </>
              )}
            </button>
          )}
        </div>
        <select
          className="input"
          value={form.muscle_group}
          onChange={(e) =>
            setForm({ ...form, muscle_group: e.target.value as Exercise['muscle_group'] })
          }
        >
          {MUSCLE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {suggestErr && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
            <TriangleAlert size={14} className="shrink-0" /> {suggestErr}
          </p>
        )}
      </div>

      <div>
        <label className="label">Sekundärmuskeln (mit-beansprucht)</label>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.filter((g) => g !== form.muscle_group).map((g) => {
            const on = form.secondary_muscles.includes(g)
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleSecondary(g)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                  on ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
                }`}
              >
                {g}
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-cocoa-muted">
          z. B. Rudern → auch Schultern &amp; Bizeps. Verbessert Aufwärm-Logik &amp;
          Muskel-Balance.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Wdh min</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="input"
            value={form.target_rep_min}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setForm({ ...form, target_rep_min: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Wdh max</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="input"
            value={form.target_rep_max}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setForm({ ...form, target_rep_max: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">+kg Schritt</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0.5}
            className="input"
            value={form.increment}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setForm({ ...form, increment: Number(e.target.value) })}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setForm({ ...form, unilateral: !form.unilateral })}
        className="flex w-full items-center justify-between rounded-xl bg-sand-light px-3 py-2.5"
      >
        <span className="text-sm font-medium text-cocoa">Einseitig (links/rechts)</span>
        <span
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            form.unilateral ? 'bg-ruby' : 'bg-sand-dark'
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
              form.unilateral ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      <div>
        <label className="label">Geräte-Einstellung / Notiz</label>
        <input
          className="input"
          placeholder="z. B. Sitz 4, Lehne 2, Griff eng"
          value={form.notes ?? ''}
          onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
        />
        <p className="mt-1 text-xs text-cocoa-muted">
          Wird beim Training angezeigt — z. B. Sitzhöhe/Lehne der Maschine.
        </p>
      </div>

      <div className="rounded-xl bg-sand-light p-3">
        <label className="label">Gewichtsstufen (optional)</label>
        <input
          className="input"
          placeholder="z. B. 4 9 13 18 22 (leer = gleichmäßige Schritte)"
          value={form.weight_steps ?? ''}
          onChange={(e) => setForm({ ...form, weight_steps: e.target.value || null })}
        />
        <p className="mt-1 text-xs text-cocoa-light">
          Real wählbare Gewichte deines Geräts, mit Leerzeichen getrennt. +/- springt dann exakt auf
          diese Werte.
        </p>
        <div className="mt-2 grid grid-cols-3 items-end gap-2">
          <div>
            <label className="label">Start</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="4"
              value={gen.start}
              onChange={(e) => setGen({ ...gen, start: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Muster</label>
            <input
              className="input"
              placeholder="5 4"
              value={gen.pattern}
              onChange={(e) => setGen({ ...gen, pattern: e.target.value })}
            />
          </div>
          <div>
            <label className="label">bis</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="100"
              value={gen.max}
              onChange={(e) => setGen({ ...gen, max: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 items-end gap-2">
          <div className="col-span-2">
            <label className="label">Zusatzgewichte</label>
            <input
              className="input"
              placeholder="2,5 5 7"
              value={gen.addons}
              onChange={(e) => setGen({ ...gen, addons: e.target.value })}
            />
          </div>
          <button type="button" className="btn-ghost" onClick={generateSteps}>
            Erzeugen
          </button>
        </div>
        <p className="mt-1 text-xs text-cocoa-muted">
          Generator: Start + sich wiederholendes Zuwachs-Muster. Bsp. Start 4, Muster „5 4" → 4 · 9
          · 13 · 18 · 22 … Zusatzgewichte (z. B. „2,5 5 7") werden zusätzlich aufgelegt und machen
          die Stufen feiner.
        </p>
      </div>
    </>
  )
}
