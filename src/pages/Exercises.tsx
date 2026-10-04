import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Mic,
  PenLine,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import {
  useCreateExercise,
  useDeleteExercise,
  useExercises,
  useUpdateExercise,
  type ExerciseInput,
} from '../hooks/useExercises'
import { useAllSets } from '../hooks/useWorkouts'
import { useAiStatus } from '../hooks/useAi'
import { usePrefs } from '../lib/prefs'
import { parseEquipmentList, parseNewExercise, type ExerciseDraft } from '../lib/ai'
import { onlyWorking } from '../lib/analytics'
import { MicButton } from '../components/MicButton'
import { Sheet } from '../components/workout/Sheet'
import {
  EMPTY_EXERCISE,
  ExerciseForm,
  cleanExerciseInput,
  exerciseToInput,
} from '../components/ExerciseForm'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type SetWithDate } from '../types'

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

const kg = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 })

/** „zuletzt 3×8 · 80 kg" aus der letzten Session (nur ausgeführte Arbeitssätze). */
function lastPerformance(sets: SetWithDate[]): string | null {
  const working = onlyWorking(sets) // ohne leere Vorlagen-Sätze (0 Wdh)
  if (working.length === 0) return null
  const lastDate = working.reduce((d, s) => (s.date > d ? s.date : d), '')
  const day = working.filter((s) => s.date === lastDate)
  const top = Math.max(...day.map((s) => s.weight))
  const atTop = day.filter((s) => s.weight === top)
  const reps = atTop.map((s) => s.reps)
  const sameReps = reps.every((r) => r === reps[0])
  const scheme = sameReps ? `${atTop.length}×${reps[0]}` : `${atTop.length} Sätze`
  const record = Math.max(...working.map((s) => s.weight))
  const base = top > 0 ? `zuletzt ${scheme} · ${kg(top)} kg` : `zuletzt ${scheme}`
  return record > top ? `${base} · Rekord ${kg(record)} kg` : base
}

/** Entwürfe nach Gerät gruppieren (Reihenfolge bleibt erhalten). */
function groupByDevice(drafts: ExerciseDraft[]): { device: string | null; idx: number[] }[] {
  const groups: { device: string | null; idx: number[] }[] = []
  drafts.forEach((d, i) => {
    const device = d.device ?? null
    const g = device ? groups.find((x) => x.device === device) : undefined
    if (g) g.idx.push(i)
    else groups.push({ device, idx: [i] })
  })
  return groups
}

/** Standard-Auswahl: je Gerät mit mehreren Vorschlägen nur die ersten 2. */
function defaultSelection(drafts: ExerciseDraft[]): Set<number> {
  const sel = new Set<number>()
  for (const g of groupByDevice(drafts)) g.idx.slice(0, 2).forEach((i) => sel.add(i))
  return sel
}

function AddOption({
  Icon,
  title,
  desc,
  onClick,
}: {
  Icon: LucideIcon
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button className="flex w-full items-center gap-3 px-3 py-3 text-left" onClick={onClick}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-cocoa">{title}</span>
        <span className="block truncate text-xs text-cocoa-light">{desc}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
    </button>
  )
}

export default function Exercises() {
  const navigate = useNavigate()
  const { data: exercises, isLoading } = useExercises()
  const { data: allSets } = useAllSets()
  const createEx = useCreateExercise()
  const updateEx = useUpdateExercise()
  const deleteEx = useDeleteExercise()

  const { data: ai } = useAiStatus()
  const { isNew } = usePrefs()
  const aiOn = Boolean(isNew && ai?.enabled)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [form, setForm] = useState<ExerciseInput>(EMPTY_EXERCISE)
  const [open, setOpen] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [assistOpen, setAssistOpen] = useState(false)
  const [assistText, setAssistText] = useState('')
  const [assistBusy, setAssistBusy] = useState(false)
  const [assistErr, setAssistErr] = useState<string | null>(null)
  const [equipOpen, setEquipOpen] = useState(false)
  const [equipText, setEquipText] = useState('')
  const [equipBusy, setEquipBusy] = useState(false)
  const [equipErr, setEquipErr] = useState<string | null>(null)
  const [equipDrafts, setEquipDrafts] = useState<ExerciseDraft[] | null>(null)
  const [equipSel, setEquipSel] = useState<Set<number>>(new Set())

  // Neue Liste (nur neue App)
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)

  const setsByExercise = useMemo(() => {
    const map = new Map<string, SetWithDate[]>()
    for (const s of allSets ?? []) {
      const list = map.get(s.exercise_id) ?? []
      list.push(s)
      map.set(s.exercise_id, list)
    }
    return map
  }, [allSets])

  const usedGroups = useMemo(
    () => MUSCLE_GROUPS.filter((g) => exercises?.some((e) => e.muscle_group === g)),
    [exercises],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (exercises ?? []).filter(
      (e) =>
        (!muscle || e.muscle_group === muscle) &&
        (!q || e.name.toLowerCase().includes(q) || e.muscle_group.toLowerCase().includes(q)),
    )
  }, [exercises, query, muscle])

  async function genEquip(image?: string) {
    if (!equipText.trim() && !image) return
    setEquipBusy(true)
    setEquipErr(null)
    try {
      const drafts = await parseEquipmentList(equipText.trim(), image)
      if (drafts.length === 0) setEquipErr('Keine Geräte erkannt.')
      else {
        setEquipSel(defaultSelection(drafts))
        setEquipDrafts(drafts)
      }
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

  function toggleDraft(i: number) {
    setEquipSel((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function runAssistant() {
    if (!assistText.trim()) return
    setAssistBusy(true)
    setAssistErr(null)
    try {
      const draft = await parseNewExercise(assistText.trim())
      setEditing(null)
      setForm({ ...EMPTY_EXERCISE, ...draft })
      setAssistOpen(false)
      setAssistText('')
      setOpen(true)
    } catch (e) {
      setAssistErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAssistBusy(false)
    }
  }

  function startNew() {
    setEditing(null)
    setForm(EMPTY_EXERCISE)
    setSaveErr(null)
    setOpen(true)
  }

  function startEdit(ex: Exercise) {
    setEditing(ex)
    setForm(exerciseToInput(ex))
    setSaveErr(null)
    setOpen(true)
  }

  const saving = createEx.isPending || updateEx.isPending

  async function save() {
    if (!form.name.trim() || saving) return
    setSaveErr(null)
    const clean = cleanExerciseInput(form)
    try {
      if (editing) {
        await updateEx.mutateAsync({ id: editing.id, ...clean })
      } else {
        await createEx.mutateAsync(clean)
      }
      setOpen(false)
    } catch (e) {
      setSaveErr(
        `Konnte nicht speichern: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}. Bitte Verbindung prüfen und erneut versuchen.`,
      )
    }
  }

  function closeForm() {
    setOpen(false)
    setSaveErr(null)
  }

  const selectedCount = equipDrafts ? equipDrafts.filter((_, i) => equipSel.has(i)).length : 0

  return (
    <div className="space-y-4">
      {isNew ? (
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Übungen</h1>
          <button
            className="btn-primary flex items-center gap-1.5 text-sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus size={16} /> Übung
          </button>
        </header>
      ) : (
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Übungen</h1>
          <div className="flex gap-2">
            <button
              className="btn-ghost flex items-center gap-1.5 text-sm"
              onClick={() => navigate('/plans')}
              aria-label="Trainingspläne"
            >
              <ClipboardList size={16} className="text-cocoa-light" /> Pläne
            </button>
            <button
              className="btn-ghost flex items-center text-base"
              onClick={() => navigate('/profile')}
              aria-label="Profil & Einstellungen"
            >
              <Settings2 size={18} className="text-cocoa-light" />
            </button>
            <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={startNew}>
              <Plus size={16} /> Neu
            </button>
          </div>
        </header>
      )}

      {addOpen && (
        <Sheet title="Übung hinzufügen" onClose={() => setAddOpen(false)}>
          <div className="divide-y divide-sand-dark/40 rounded-2xl bg-sand-light">
            <AddOption
              Icon={PenLine}
              title="Selbst eintragen"
              desc="Name, Muskeln und Wiederholungen manuell festlegen"
              onClick={() => {
                setAddOpen(false)
                startNew()
              }}
            />
            {aiOn && (
              <AddOption
                Icon={Sparkles}
                title="Beschreiben oder sprechen"
                desc="Die KI erstellt Muskeln & Gewichtsstufen für dich"
                onClick={() => {
                  setAddOpen(false)
                  setAssistOpen(true)
                }}
              />
            )}
            {aiOn && (
              <AddOption
                Icon={Camera}
                title="Geräte importieren"
                desc="Geräte deines Studios per Text oder Foto übernehmen"
                onClick={() => {
                  setAddOpen(false)
                  setEquipOpen(true)
                }}
              />
            )}
          </div>
        </Sheet>
      )}

      {equipOpen && !equipDrafts && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              <Dumbbell size={18} className="shrink-0 text-cocoa-light" /> Geräte deines Studios importieren
            </h2>
            <p className="text-xs text-cocoa-light">
              Zähl deine Geräte/Maschinen auf (Text/Sprache) oder fotografiere die Geräteschilder —
              die KI legt daraus Übungen mit Muskeln an. Für Kabelzug, Multipresse &amp; Co. gibt es
              mehrere Vorschläge zur Auswahl.
            </p>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="z. B. Latzug, Beinpresse, Kabelzug, Multipresse, Beinbeuger…"
                value={equipText}
                onChange={(e) => setEquipText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && genEquip()}
              />
              <MicButton onResult={(t) => setEquipText((v) => (v ? v + ', ' + t : t))} />
            </div>
            <label className="btn-ghost flex w-full cursor-pointer items-center justify-center gap-1.5">
              {equipBusy ? (
                '… erkenne'
              ) : (
                <>
                  <Camera size={16} className="text-cocoa-light" /> Geräte fotografieren
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => genEquipPhoto(e.target.files?.[0])}
              />
            </label>
            {equipErr && (
              <p className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
                <TriangleAlert size={16} className="shrink-0" /> {equipErr}
              </p>
            )}
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
            <h2 className="text-lg font-bold">{equipDrafts.length} Übungen vorgeschlagen</h2>
            <p className="text-xs text-cocoa-light">
              Wähle aus, was du anlegen willst — Gewichtsstufen kannst du später je Übung ergänzen.
            </p>
            <div className="space-y-3">
              {groupByDevice(equipDrafts).map((g, gi) => (
                <div key={gi}>
                  {g.device && (
                    <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
                      {g.device}
                    </div>
                  )}
                  <ul className="divide-y divide-sand-dark/40 rounded-2xl bg-sand-light">
                    {g.idx.map((i) => {
                      const d = equipDrafts[i]
                      const on = equipSel.has(i)
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            onClick={() => toggleDraft(i)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
                          >
                            <span
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                                on ? 'border-brand bg-brand text-on-brand' : 'border-sand-dark bg-cream'
                              }`}
                            >
                              {on && <Check size={14} strokeWidth={3} />}
                            </span>
                            <span className={`min-w-0 flex-1 ${on ? '' : 'opacity-60'}`}>
                              <span className="block font-medium">{d.name}</span>
                              <span className="block text-xs text-cocoa-light">
                                {d.muscle_group}
                                {d.secondary_muscles.length
                                  ? ` · +${d.secondary_muscles.join(', ')}`
                                  : ''}
                                {d.unilateral ? ' · einseitig' : ''}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setEquipDrafts(null)}>
                Zurück
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => createAllDrafts(equipDrafts.filter((_, i) => equipSel.has(i)))}
                disabled={createEx.isPending || selectedCount === 0}
              >
                {createEx.isPending ? 'Lege an…' : `${selectedCount} anlegen`}
              </button>
            </div>
          </div>
        </div>
      )}

      {assistOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              <Mic size={18} className="shrink-0 text-cocoa-light" /> Übung per Sprache anlegen
            </h2>
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
            {assistErr && (
              <p className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
                <TriangleAlert size={16} className="shrink-0" /> {assistErr}
              </p>
            )}
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

      {isNew ? (
        <>
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted"
            />
            <input
              className="input pl-10"
              type="search"
              placeholder="Übung suchen"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Übung suchen"
            />
          </div>

          {usedGroups.length > 1 && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[null, ...usedGroups].map((g) => {
                const on = muscle === g
                return (
                  <button
                    key={g ?? 'all'}
                    type="button"
                    onClick={() => setMuscle(g)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                      on ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
                    }`}
                  >
                    {g ?? 'Alle'}
                  </button>
                )
              })}
            </div>
          )}

          {exercises?.length === 0 && (
            <p className="text-cocoa-light">Noch keine Übungen. Lege deine erste an.</p>
          )}
          {!!exercises?.length && filtered.length === 0 && (
            <p className="text-sm text-cocoa-light">Keine Übung gefunden.</p>
          )}

          {filtered.length > 0 && (
            <ul className="divide-y divide-sand-dark/40 rounded-2xl bg-cream">
              {filtered.map((ex) => {
                const perf = lastPerformance(setsByExercise.get(ex.id) ?? [])
                return (
                  <li key={ex.id}>
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      onClick={() => navigate(`/exercises/${ex.id}`)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-cocoa">{ex.name}</span>
                        <span className="block truncate text-sm text-cocoa-light">
                          {ex.muscle_group}
                          {perf && <span className="tabular"> · {perf}</span>}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : (
        <ul className="space-y-2">
          {exercises?.map((ex) => (
            <li key={ex.id} className="card flex items-center justify-between">
              <button className="flex-1 text-left" onClick={() => startEdit(ex)}>
                <div className="font-semibold">{ex.name}</div>
                <div className="tabular text-sm text-cocoa-light">
                  {ex.muscle_group} · Ziel {ex.target_rep_min}–{ex.target_rep_max} Wdh ·
                  +{ex.increment} kg
                </div>
              </button>
              <button
                className="ml-2 grid h-8 w-8 place-items-center rounded-full text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
                aria-label="Übung löschen"
                onClick={() => {
                  if (confirm(`„${ex.name}" inkl. aller Sätze löschen?`)) deleteEx.mutate(ex.id)
                }}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
          {exercises?.length === 0 && (
            <li className="text-cocoa-light">Noch keine Übungen. Lege deine erste an.</li>
          )}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">{editing ? 'Übung bearbeiten' : 'Neue Übung'}</h2>
            <ExerciseForm form={form} setForm={setForm} aiOn={aiOn} autoFocus />
            {saveErr && (
              <p className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
                <TriangleAlert size={16} className="shrink-0" /> {saveErr}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button className="btn-ghost flex-1" onClick={closeForm}>
                Abbrechen
              </button>
              <button
                className="btn-primary flex-1"
                onClick={save}
                disabled={saving || !form.name.trim()}
              >
                {saving ? 'Speichere…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
