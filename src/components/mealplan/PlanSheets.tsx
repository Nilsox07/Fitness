import { useState, type ReactNode } from 'react'
import {
  ChevronRight,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { MicButton } from '../MicButton'
import type { Recipe } from '../../lib/ai'
import { MEALS, MEAL_LABEL, type PlanMeal, type SavedMealPlan } from '../../types'
import { MEAL_ICON } from './mealIcons'

// ---- „…"-Menü ------------------------------------------------------------------

export function PlanMenuSheet({
  saved,
  saving,
  savedCount,
  onSave,
  onLoad,
  onAdjust,
  onNew,
  onClose,
}: {
  /** Plan ist gespeichert und unverändert */
  saved: boolean
  saving: boolean
  savedCount: number
  onSave: () => void
  onLoad: () => void
  onAdjust: () => void
  onNew: () => void
  onClose: () => void
}) {
  return (
    <Sheet title="Plan" onClose={onClose}>
      <ul className="divide-y divide-sand-dark/30 overflow-hidden rounded-2xl bg-sand-light ring-1 ring-sand-dark/60">
        <MenuRow
          icon={saving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
          label={saved ? 'Gespeichert' : 'Speichern'}
          hint={saved ? 'Keine offenen Änderungen' : 'Plan & Einkaufsliste sichern'}
          onClick={onSave}
          disabled={saving || saved}
        />
        <MenuRow
          icon={<FolderOpen size={18} />}
          label="Laden"
          hint={savedCount ? `${savedCount} gespeicherte ${savedCount === 1 ? 'Plan' : 'Pläne'}` : 'Noch keine gespeichert'}
          onClick={onLoad}
          disabled={savedCount === 0}
        />
        <MenuRow
          icon={<Sparkles size={18} className="text-brand" />}
          label="KI anpassen"
          hint="z. B. günstiger, mehr Eiweiß, ohne Milch"
          onClick={onAdjust}
        />
        <MenuRow icon={<RotateCcw size={18} />} label="Neu erstellen" hint="Neuen Plan generieren" onClick={onNew} />
      </ul>
    </Sheet>
  )
}

function MenuRow({
  icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: ReactNode
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <li>
      <button
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-200 hover:bg-sand disabled:opacity-50"
        onClick={onClick}
        disabled={disabled}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block truncate text-xs text-cocoa-muted">{hint}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
      </button>
    </li>
  )
}

// ---- KI anpassen -----------------------------------------------------------------

export function AdjustSheet({
  initial,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  initial: string
  busy: boolean
  error: string | null
  onSubmit: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(initial)
  const submit = () => text.trim() && !busy && onSubmit(text.trim())
  return (
    <Sheet title="Plan per KI anpassen" onClose={onClose}>
      <p className="text-sm text-cocoa-light">Beschreib, was sich ändern soll — die Einkaufsliste wird mit angepasst.</p>
      <div className="flex gap-2">
        <input
          className="input"
          autoFocus
          placeholder="z. B. günstiger, mehr Eiweiß, Tag 2 vegetarisch"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <MicButton onResult={(t) => setText((v) => (v ? v + ' ' + t : t))} />
      </div>
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      <button className="btn-primary w-full gap-1.5" onClick={submit} disabled={busy || !text.trim()}>
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {busy ? 'Passe an…' : 'Plan anpassen'}
      </button>
    </Sheet>
  )
}

// ---- Mahlzeit bearbeiten ---------------------------------------------------------

export function MealEditSheet({
  meal,
  dayLabel,
  onSave,
  onRemove,
  onClose,
}: {
  meal: PlanMeal
  dayLabel: string
  onSave: (m: PlanMeal) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(meal)
  const num = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => ({
    value: Number.isFinite(draft[k]) ? String(draft[k]) : '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value.replace(',', '.'))
      setDraft((d) => ({ ...d, [k]: Number.isFinite(v) && v > 0 ? Math.round(v) : 0 }))
    },
  })
  return (
    <Sheet title="Mahlzeit bearbeiten" onClose={onClose}>
      <p className="-mt-1 text-xs text-cocoa-muted">{dayLabel}</p>
      <div className="flex gap-1 rounded-full bg-sand p-1" role="radiogroup" aria-label="Mahlzeit">
        {MEALS.map((m) => {
          const Icon = MEAL_ICON[m]
          return (
            <button
              key={m}
              role="radio"
              aria-checked={draft.meal === m}
              onClick={() => setDraft((d) => ({ ...d, meal: m }))}
              className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-xs font-semibold transition-colors duration-200 ${
                draft.meal === m ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
              }`}
            >
              <Icon size={12} />
              {MEAL_LABEL[m]}
            </button>
          )
        })}
      </div>
      <label className="block">
        <span className="label">Gericht</span>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </label>
      <div className="grid grid-cols-4 gap-2">
        {(
          [
            ['kcal', 'kcal'],
            ['protein', 'Eiweiß'],
            ['carbs', 'Kohlenh.'],
            ['fat', 'Fett'],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="block min-w-0">
            <span className="label truncate">{l}</span>
            <input className="input tabular px-2 text-center" inputMode="numeric" {...num(k)} />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn-ghost gap-1.5 text-red-500 dark:text-red-400" onClick={onRemove}>
          <Trash2 size={16} />
          Entfernen
        </button>
        <button
          className="btn-primary flex-1 gap-1.5"
          disabled={!draft.name.trim()}
          onClick={() => onSave({ ...draft, name: draft.name.trim() })}
        >
          Übernehmen
        </button>
      </div>
    </Sheet>
  )
}

// ---- Rezept ----------------------------------------------------------------------

export function RecipeSheet({
  recipe,
  saving,
  error,
  onSave,
  onClose,
}: {
  recipe: Recipe
  saving: boolean
  error: string | null
  onSave: () => void
  onClose: () => void
}) {
  const n = recipe.nutrition
  return (
    <Sheet title={recipe.title} onClose={onClose}>
      <div className="tabular grid grid-cols-4 gap-2 rounded-2xl bg-sand-light p-2 text-center text-[11px] text-cocoa-light ring-1 ring-sand-dark/60">
        <Stat label="kcal" value={n.kcal} />
        <Stat label="Eiweiß" value={`${n.protein} g`} />
        <Stat label="Kohlenh." value={`${n.carbs} g`} />
        <Stat label="Fett" value={`${n.fat} g`} />
      </div>
      <p className="tabular text-xs text-cocoa-muted">
        {recipe.servings} {recipe.servings === 1 ? 'Portion' : 'Portionen'}
      </p>
      {recipe.ingredients.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Zutaten</h3>
          <ul className="divide-y divide-sand-dark/30 text-sm">
            {recipe.ingredients.map((it, i) => (
              <li key={i} className="py-1.5">
                {it}
              </li>
            ))}
          </ul>
        </div>
      )}
      {recipe.steps.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Zubereitung</h3>
          <ol className="space-y-2 text-sm">
            {recipe.steps.map((st, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sand text-[10px] font-bold text-cocoa-light">
                  {i + 1}
                </span>
                <span>{st}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      <button className="btn-primary w-full gap-1.5" onClick={onSave} disabled={saving}>
        {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Speichert…' : 'Als Rezept speichern'}
      </button>
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold text-cocoa">{value}</div>
      {label}
    </div>
  )
}

// ---- Gespeicherte Pläne ------------------------------------------------------------

export function SavedPlansSheet({
  plans,
  currentId,
  onLoad,
  onDelete,
  onClose,
}: {
  plans: SavedMealPlan[]
  currentId: string | null
  onLoad: (p: SavedMealPlan) => void
  onDelete: (p: SavedMealPlan) => void
  onClose: () => void
}) {
  return (
    <Sheet title="Gespeicherte Pläne" onClose={onClose}>
      {plans.length === 0 ? (
        <p className="py-4 text-center text-sm text-cocoa-light">Noch keine Pläne gespeichert.</p>
      ) : (
        <ul className="divide-y divide-sand-dark/30 overflow-hidden rounded-2xl bg-sand-light ring-1 ring-sand-dark/60">
          {plans.map((p) => {
            const items = p.shopping.reduce((s, c) => s + c.items.length, 0)
            const current = p.id === currentId
            return (
              <li key={p.id} className="flex items-center">
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left transition-colors duration-200 hover:bg-sand"
                  onClick={() => onLoad(p)}
                >
                  <span
                    className={`tabular grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                      current ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa-light'
                    }`}
                  >
                    {p.days}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      {current && (
                        <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">
                          Aktiv
                        </span>
                      )}
                    </span>
                    <span className="tabular block truncate text-xs text-cocoa-muted">
                      {p.days} Tage · {items} Artikel
                    </span>
                  </span>
                </button>
                <button
                  className="mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-cocoa-muted transition hover:text-red-500 active:scale-90"
                  aria-label={`„${p.name}" löschen`}
                  onClick={() => onDelete(p)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
