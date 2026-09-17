import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCreateExercise,
  useDeleteExercise,
  useExercises,
  useUpdateExercise,
  type ExerciseInput,
} from '../hooks/useExercises'
import { useAiStatus } from '../hooks/useAi'
import { usePrefs } from '../lib/prefs'
import { parseEquipmentList, parseNewExercise, suggestMuscles, type ExerciseDraft } from '../lib/ai'
import { MicButton } from '../components/MicButton'

function fileToDataUrl(file: File, maxDim = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(reader.result as string)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => resolve(reader.result as string)
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
import { expandWithAddons, generateLadder } from '../lib/weights'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../types'

const empty: ExerciseInput = {
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

export default function Exercises() {
  const navigate = useNavigate()
  const { data: exercises, isLoading } = useExercises()
  const createEx = useCreateExercise()
  const updateEx = useUpdateExercise()
  const deleteEx = useDeleteExercise()

  const { data: ai } = useAiStatus()
  const { isNew } = usePrefs()
  const aiOn = isNew && ai?.enabled
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [form, setForm] = useState<ExerciseInput>(empty)
  const [open, setOpen] = useState(false)
  const [gen, setGen] = useState({ start: '', pattern: '', max: '', addons: '' })
  const [suggesting, setSuggesting] = useState(false)
  const [suggestErr, setSuggestErr] = useState<string | null>(null)
  const [assistOpen, setAssistOpen] = useState(false)
  const [assistText, setAssistText] = useState('')
  const [assistBusy, setAssistBusy] = useState(false)
  const [assistErr, setAssistErr] = useState<string | null>(null)
  const [equipOpen, setEquipOpen] = useState(false)
  const [equipText, setEquipText] = useState('')
  const [equipBusy, setEquipBusy] = useState(false)
  const [equipErr, setEquipErr] = useState<string | null>(null)
  const [equipDrafts, setEquipDrafts] = useState<ExerciseDraft[] | null>(null)

  async function genEquip(image?: string) {
    if (!equipText.trim() && !image) return
    setEquipBusy(true)
    setEquipErr(null)
    try {
      const drafts = await parseEquipmentList(equipText.trim(), image)
      if (drafts.length === 0) setEquipErr('Keine Geräte erkannt.')
      else setEquipDrafts(drafts)
    } catch (e) {
      setEquipErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setEquipBusy(false)
    }
  }

  async function genEquipPhoto(file: File | undefined) {
    if (!file) return
    setEquipBusy(true)
    setEquipErr(null)
    try {
      await genEquip(await fileToDataUrl(file))
    } catch (e) {
      setEquipErr(e instanceof Error ? e.message : 'KI-Fehler')
      setEquipBusy(false)
    }
  }

  async function createAllDrafts(drafts: ExerciseDraft[]) {
    for (const d of drafts) {
      await createEx.mutateAsync({
        name: d.name,
        muscle_group: d.muscle_group,
        notes: null,
        target_rep_min: d.target_rep_min,
        target_rep_max: d.target_rep_max,
        increment: d.increment,
        unilateral: d.unilateral,
        weight_steps: d.weight_steps,
        secondary_muscles: d.secondary_muscles,
      })
    }
    setEquipDrafts(null)
    setEquipOpen(false)
    setEquipText('')
  }

  async function runAssistant() {
    if (!assistText.trim()) return
    setAssistBusy(true)
    setAssistErr(null)
    try {
      const draft = await parseNewExercise(assistText.trim())
      setEditing(null)
      setForm({ ...empty, ...draft })
      setSuggestErr(null)
      setAssistOpen(false)
      setAssistText('')
      setOpen(true)
    } catch (e) {
      setAssistErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAssistBusy(false)
    }
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

  function startNew() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function startEdit(ex: Exercise) {
    setEditing(ex)
    setForm({
      name: ex.name,
      muscle_group: ex.muscle_group,
      notes: ex.notes,
      target_rep_min: ex.target_rep_min,
      target_rep_max: ex.target_rep_max,
      increment: ex.increment,
      unilateral: ex.unilateral,
      weight_steps: ex.weight_steps,
      secondary_muscles: ex.secondary_muscles ?? [],
    })
    setSuggestErr(null)
    setOpen(true)
  }

  async function save() {
    if (!form.name.trim()) return
    // Ungültige/leere Zahlenfelder absichern (DB verlangt min>0, max>=min, increment>0)
    const repMin = Math.max(1, Math.round(form.target_rep_min) || 1)
    const repMax = Math.max(repMin, Math.round(form.target_rep_max) || repMin)
    const increment = form.increment > 0 ? form.increment : 2.5
    const clean = { ...form, target_rep_min: repMin, target_rep_max: repMax, increment }
    if (editing) {
      await updateEx.mutateAsync({ id: editing.id, ...clean })
    } else {
      await createEx.mutateAsync(clean)
    }
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Übungen</h1>
        <div className="flex gap-2">
          {!isNew && (
            <button
              className="btn-ghost text-sm"
              onClick={() => navigate('/plans')}
              aria-label="Trainingspläne"
            >
              🗂️ Pläne
            </button>
          )}
          {!isNew && (
            <button
              className="btn-ghost text-base"
              onClick={() => navigate('/profile')}
              aria-label="Profil & Einstellungen"
            >
              ⚙️
            </button>
          )}
          {aiOn && (
            <button className="btn-ghost text-sm" onClick={() => setEquipOpen(true)} aria-label="Geräte importieren">
              🏋️ Geräte
            </button>
          )}
          {aiOn && (
            <button className="btn-ghost text-sm" onClick={() => setAssistOpen(true)} aria-label="Übung per Sprache anlegen">
              🎤 KI
            </button>
          )}
          <button className="btn-primary text-sm" onClick={startNew}>
            + Neu
          </button>
        </div>
      </header>

      {equipOpen && !equipDrafts && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">🏋️ Geräte deines Studios importieren</h2>
            <p className="text-xs text-cocoa-light">
              Zähl deine Geräte/Maschinen auf (Text/Sprache) oder fotografiere die Geräteschilder —
              die KI legt daraus Übungen mit Muskeln an.
            </p>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="z. B. Latzug, Beinpresse, Brustpresse, Rudermaschine, Beinbeuger…"
                value={equipText}
                onChange={(e) => setEquipText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && genEquip()}
              />
              <MicButton onResult={(t) => setEquipText((v) => (v ? v + ', ' + t : t))} />
            </div>
            <label className="btn-ghost flex w-full cursor-pointer items-center justify-center">
              {equipBusy ? '… erkenne' : '📸 Geräte fotografieren'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => genEquipPhoto(e.target.files?.[0])}
              />
            </label>
            {equipErr && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {equipErr}</p>}
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setEquipOpen(false)}>
                Abbrechen
              </button>
              <button className="btn-primary flex-1" onClick={() => genEquip()} disabled={equipBusy}>
                {equipBusy ? 'Erkenne…' : 'Erkennen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {equipDrafts && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">{equipDrafts.length} Übungen erkannt</h2>
            <p className="text-xs text-cocoa-light">
              Prüfen und anlegen — Gewichtsstufen kannst du später je Übung ergänzen.
            </p>
            <ul className="space-y-1.5">
              {equipDrafts.map((d, i) => (
                <li key={i} className="rounded-lg bg-sand/40 px-3 py-2 text-sm ring-1 ring-sand-dark/50">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-cocoa-light">
                    {d.muscle_group}
                    {d.secondary_muscles.length ? ` · +${d.secondary_muscles.join(', ')}` : ''}
                    {d.unilateral ? ' · einseitig' : ''}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setEquipDrafts(null)}>
                Zurück
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => createAllDrafts(equipDrafts)}
                disabled={createEx.isPending}
              >
                Alle anlegen
              </button>
            </div>
          </div>
        </div>
      )}

      {assistOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">🎤 Übung per Sprache anlegen</h2>
            <p className="text-xs text-cocoa-light">
              Beschreib die Übung — Name und, wenn du magst, die Gewichtsstufen der Maschine. Die KI
              erkennt Muskeln & Leiter automatisch.
            </p>
            <div className="flex gap-2">
              <input
                className="input"
                autoFocus
                placeholder="z. B. Kniebeugen, 5er-Schritte von 20 bis 120"
                value={assistText}
                onChange={(e) => setAssistText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runAssistant()}
              />
              <MicButton onResult={(t) => setAssistText((v) => (v ? v + ' ' + t : t))} />
            </div>
            {assistErr && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {assistErr}</p>}
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setAssistOpen(false)}>
                Abbrechen
              </button>
              <button className="btn-primary flex-1" onClick={runAssistant} disabled={assistBusy}>
                {assistBusy ? 'Erstelle…' : 'Entwurf erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      <ul className="space-y-2">
        {exercises?.map((ex) => (
          <li key={ex.id} className="card flex items-center justify-between">
            <button className="flex-1 text-left" onClick={() => startEdit(ex)}>
              <div className="font-semibold">{ex.name}</div>
              <div className="text-sm text-cocoa-light">
                {ex.muscle_group} · Ziel {ex.target_rep_min}–{ex.target_rep_max} Wdh ·
                +{ex.increment} kg
              </div>
            </button>
            <button
              className="ml-2 px-2 text-cocoa-muted hover:text-red-500 dark:text-red-400"
              aria-label="Übung löschen"
              onClick={() => {
                if (confirm(`„${ex.name}" inkl. aller Sätze löschen?`)) deleteEx.mutate(ex.id)
              }}
            >
              ✕
            </button>
          </li>
        ))}
        {exercises?.length === 0 && (
          <li className="text-cocoa-light">Noch keine Übungen. Lege deine erste an.</li>
        )}
      </ul>

      {open && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">{editing ? 'Übung bearbeiten' : 'Neue Übung'}</h2>
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                autoFocus
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
                    className="text-xs font-semibold text-brand disabled:opacity-40"
                  >
                    {suggesting ? '… analysiere' : '🤖 Muskeln vorschlagen'}
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
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">⚠️ {suggestErr}</p>
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
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                        on
                          ? 'bg-ruby text-white ring-ruby'
                          : 'bg-sand-light text-cocoa-light ring-sand-dark'
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
                  onChange={(e) =>
                    setForm({ ...form, target_rep_min: Number(e.target.value) })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, target_rep_max: Number(e.target.value) })
                  }
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
              className="flex w-full items-center justify-between rounded-xl bg-sand-light px-3 py-2.5 ring-1 ring-sand-dark"
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

            <div className="rounded-xl bg-sand-light p-3 ring-1 ring-sand-dark">
              <label className="label">Gewichtsstufen (optional)</label>
              <input
                className="input"
                placeholder="z. B. 4 9 13 18 22 (leer = gleichmäßige Schritte)"
                value={form.weight_steps ?? ''}
                onChange={(e) => setForm({ ...form, weight_steps: e.target.value || null })}
              />
              <p className="mt-1 text-xs text-cocoa-light">
                Real wählbare Gewichte deines Geräts, mit Leerzeichen getrennt. +/- springt dann
                exakt auf diese Werte.
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
                Generator: Start + sich wiederholendes Zuwachs-Muster. Bsp. Start 4, Muster „5 4" →
                4 · 9 · 13 · 18 · 22 … Zusatzgewichte (z. B. „2,5 5 7") werden zusätzlich
                aufgelegt und machen die Stufen feiner.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button className="btn-primary flex-1" onClick={save}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
