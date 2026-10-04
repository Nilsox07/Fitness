import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useExercises } from '../../hooks/useExercises'
import { nextPlanPosition, useAddPlanExercise, useCreatePlan, usePlans } from '../../hooks/usePlans'
import { generatePlan, type PlanSuggestion } from '../../lib/ai'

const PRESETS = ['Push / Pull / Beine', 'Oberkörper / Unterkörper', 'Ganzkörper 3×', 'Push / Pull']

/**
 * KI-Vorschläge als Pläne anlegen. Doppelte Übungen (die KI nennt manche zweimal)
 * werden übersprungen — sonst schlägt das Einfügen an (plan_id, exercise_id)
 * unique fehl. Fehler werden sichtbar gemacht, Doppel-Tipps ignoriert.
 */
export function useApplyPlanSuggestions() {
  const { data: plans } = usePlans()
  const { data: exercises } = useExercises()
  const createPlan = useCreatePlan()
  const addPlanEx = useAddPlanExercise()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply(list: PlanSuggestion[]): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    setError(null)
    try {
      let pos = nextPlanPosition(plans)
      for (const s of list) {
        const plan = await createPlan.mutateAsync({ name: s.name, position: pos++ })
        const ids = new Set<string>()
        for (const name of s.exercises) {
          const ex = exercises?.find((e) => e.name.toLowerCase() === name.trim().toLowerCase())
          if (ex) ids.add(ex.id)
        }
        let exPos = 0
        for (const id of ids) {
          await addPlanEx.mutateAsync({ plan_id: plan.id, exercise_id: id, position: exPos++ })
        }
      }
      return true
    } catch (e) {
      setError(
        `Pläne konnten nicht (vollständig) angelegt werden: ${
          e instanceof Error ? e.message : 'Unbekannter Fehler'
        }`,
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  return { apply, busy, error }
}

/**
 * Inhalt des KI-Plangenerators (Wunsch eingeben → Vorschlag → Übernehmen).
 * Wird im klassischen Modal und im neuen Bottom-Sheet gleichermaßen genutzt.
 */
export function AiPlanGeneratorBody({ onClose }: { onClose: () => void }) {
  const { data: exercises } = useExercises()
  const applier = useApplyPlanSuggestions()
  const [wish, setWish] = useState('Push / Pull / Beine, 4× pro Woche')
  const [genBusy, setGenBusy] = useState(false)
  const [genErr, setGenErr] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<PlanSuggestion[] | null>(null)

  async function runGenerate() {
    if (!exercises?.length) return
    setGenBusy(true)
    setGenErr(null)
    try {
      const res = await generatePlan(
        exercises.map((e) => ({ name: e.name, muscle: e.muscle_group })),
        wish,
      )
      if (res.length === 0) setGenErr('Kein Vorschlag möglich. Formulier den Wunsch anders.')
      else setSuggestions(res)
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setGenBusy(false)
    }
  }

  async function applySuggestions(list: PlanSuggestion[]) {
    if (await applier.apply(list)) {
      setSuggestions(null)
      onClose()
    }
  }

  if (!suggestions)
    return (
      <>
        <label className="label">Was für ein Plan?</label>
        <input className="input" value={wish} onChange={(e) => setWish(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setWish(p)}
              className="rounded-full bg-sand px-2.5 py-1 text-xs text-cocoa-light"
            >
              {p}
            </button>
          ))}
        </div>
        {genErr && (
          <p className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
            <TriangleAlert size={16} className="shrink-0" /> {genErr}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn-primary flex-1" onClick={runGenerate} disabled={genBusy}>
            {genBusy ? 'Erstelle…' : 'Vorschlagen'}
          </button>
        </div>
      </>
    )

  return (
    <>
      <p className="text-xs text-cocoa-light">Vorschlag — beim Übernehmen werden die Pläne angelegt.</p>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="rounded-lg bg-sand-light p-2">
            <div className="font-semibold">{s.name}</div>
            <div className="text-xs text-cocoa-light">{s.exercises.join(' · ')}</div>
          </li>
        ))}
      </ul>
      {applier.error && (
        <p className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
          <TriangleAlert size={16} className="shrink-0" /> {applier.error}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button className="btn-ghost flex-1" onClick={() => setSuggestions(null)} disabled={applier.busy}>
          Zurück
        </button>
        <button
          className="btn-primary flex-1"
          onClick={() => applySuggestions(suggestions)}
          disabled={applier.busy}
        >
          {applier.busy ? 'Lege an…' : 'Übernehmen'}
        </button>
      </div>
    </>
  )
}
