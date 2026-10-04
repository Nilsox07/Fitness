import { useState, type CSSProperties } from 'react'
import { LoaderCircle, Plus, Repeat, Trash2 } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { MicButton } from '../MicButton'
import { MEALS, MEAL_LABEL, type Meal, type MealRoutine } from '../../types'
import { MEAL_ICON } from './mealIcons'

/** Kompakte Karte „Feste Routinen" mit Chips; „+" / Tipp öffnet das Verwalten-Sheet. */
export function RoutinesCard({
  routines,
  onAdd,
  onDelete,
  style,
}: {
  routines: MealRoutine[]
  /** KI schätzt die Nährwerte; wirft bei Fehlern */
  onAdd: (meal: Meal, text: string) => Promise<void>
  onDelete: (id: string) => void
  style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)

  return (
    <section className="card space-y-2.5" style={style}>
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
          <Repeat size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-tight">Feste Routinen</h2>
          <p className="mt-0.5 truncate text-xs text-cocoa-light">Kommt jeden Tag in den Plan</p>
        </div>
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand transition active:scale-90"
          onClick={() => setOpen(true)}
          aria-label="Routine hinzufügen"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {routines.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {routines.map((r) => {
            const Icon = MEAL_ICON[r.meal]
            return (
              <button
                key={r.id}
                onClick={() => setOpen(true)}
                className="flex max-w-full items-center gap-1.5 rounded-full bg-sand-light py-1 pl-1.5 pr-2.5 text-xs ring-1 ring-sand-dark/60 transition active:scale-95"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light">
                  <Icon size={11} />
                </span>
                <span className="truncate">
                  <span className="text-cocoa-light">{MEAL_LABEL[r.meal]} · </span>
                  <span className="font-medium">{r.title}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-cocoa-muted">z. B. „Frühstück · Proteinshake mit Banane"</p>
      )}

      {open && <RoutinesSheet routines={routines} onAdd={onAdd} onDelete={onDelete} onClose={() => setOpen(false)} />}
    </section>
  )
}

function RoutinesSheet({
  routines,
  onAdd,
  onDelete,
  onClose,
}: {
  routines: MealRoutine[]
  onAdd: (meal: Meal, text: string) => Promise<void>
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [meal, setMeal] = useState<Meal>('breakfast')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    setErr(null)
    try {
      await onAdd(meal, t)
      setText('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Feste Routinen" onClose={onClose}>
      <p className="text-sm text-cocoa-light">
        Wird jeden Tag im Plan berücksichtigt — die KI schätzt die Nährwerte.
      </p>

      {routines.length > 0 && (
        <ul className="divide-y divide-sand-dark/30 overflow-hidden rounded-2xl bg-sand-light ring-1 ring-sand-dark/60">
          {routines.map((r) => {
            const Icon = MEAL_ICON[r.meal]
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon size={16} className="shrink-0 text-cocoa-light" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="tabular text-[11px] text-cocoa-muted">
                    {MEAL_LABEL[r.meal]} · {r.kcal} kcal · E {r.protein} g
                  </div>
                </div>
                <button
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-cocoa-muted transition hover:text-red-500 active:scale-90"
                  aria-label={`Routine „${r.title}" löschen`}
                  onClick={() => onDelete(r.id)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="space-y-2">
        <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Neue Routine</h3>
        <div className="flex gap-1 rounded-full bg-sand p-1" role="radiogroup" aria-label="Mahlzeit">
          {MEALS.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={meal === m}
              onClick={() => setMeal(m)}
              className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors duration-200 ${
                meal === m ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
              }`}
            >
              {MEAL_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="z. B. Proteinshake mit Banane"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <MicButton onResult={(t) => setText((v) => (v ? v + ' ' + t : t))} />
        </div>
        {err && <p className="text-sm text-red-500 dark:text-red-400">{err}</p>}
        <button className="btn-primary w-full gap-1.5" onClick={submit} disabled={busy || !text.trim()}>
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.5} />}
          {busy ? 'Analysiere…' : 'Routine hinzufügen'}
        </button>
      </div>
    </Sheet>
  )
}
