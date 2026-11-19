import type { CSSProperties } from 'react'
import { fluidOf } from '../../lib/fluid'
import { Bookmark, CalendarPlus, Coffee, Cookie, Moon, Plus, RotateCcw, Sun, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { MEAL_LABEL, type FoodEntry, type Meal } from '../../types'
import { fmtInt } from '../../lib/nutritionHome'
import { type MealCopy, type RecentFood } from '../../lib/recentFoods'
import { haptic } from '../../lib/native'

const ICON: Record<Meal, LucideIcon> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
}

/** Eine Mahlzeit als Karte: Summe, Einträge (Tipp → bearbeiten) und „+" zum Hinzufügen. */
export function MealCard({
  meal,
  entries,
  recommended,
  onAdd,
  onEdit,
  onSaveMeal,
  copy,
  onCopy,
  copyBusy,
  onPrep,
  picks,
  onPick,
  style,
}: {
  meal: Meal
  entries: FoodEntry[]
  /** empfohlene kcal (0 = ausblenden) */
  recommended: number
  onAdd: () => void
  onEdit: (e: FoodEntry) => void
  /** „Als Mahlzeit speichern" (nur mit Einträgen sichtbar) */
  onSaveMeal?: () => void
  /** „Wie gestern“: dieselbe Mahlzeit vom letzten Tag (nur wenn heute noch leer) */
  copy?: MealCopy | null
  onCopy?: () => void
  copyBusy?: boolean
  /** Meal Prep: auf weitere Tage eintragen (nur mit Einträgen) */
  onPrep?: () => void
  /** Schnellauswahl (leere Mahlzeit): ein Tipp trägt mit derselben Menge ein */
  picks?: RecentFood[]
  onPick?: (e: FoodEntry) => void
  style?: CSSProperties
}) {
  const Icon = ICON[meal]
  const kcal = entries.reduce((s, e) => s + e.kcal, 0)
  const protein = entries.reduce((s, e) => s + e.protein, 0)
  const empty = entries.length === 0

  return (
    <section className="card overflow-hidden p-0" style={style}>
      <div className="flex items-center gap-3 p-3 pl-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{MEAL_LABEL[meal]}</h3>
          <p className="tabular mt-0.5 truncate text-xs text-cocoa-light">
            {empty ? (
              recommended > 0 ? (
                <span className="text-cocoa-muted">~{fmtInt(recommended)} kcal empfohlen</span>
              ) : (
                <span className="text-cocoa-muted">Noch nichts — tippe +</span>
              )
            ) : (
              <>
                <span className="font-semibold text-cocoa">{fmtInt(kcal)} kcal</span>
                {` · E ${Math.round(protein)} g`}
                {recommended > 0 && <span className="text-cocoa-muted">{` · von ~${fmtInt(recommended)}`}</span>}
              </>
            )}
          </p>
        </div>
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand transition active:scale-90"
          onClick={onAdd}
          aria-label={`${MEAL_LABEL[meal]}: Lebensmittel hinzufügen`}
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {empty ? (
        (picks?.length ?? 0) > 0 || (copy && onCopy) ? (
          <QuickChips picks={picks ?? []} onPick={onPick} copy={copy} onCopy={onCopy} copyBusy={copyBusy} />
        ) : (
          recommended > 0 && (
            <p className="-mt-1 px-4 pb-3 pl-[4.25rem] text-xs text-cocoa-muted">Noch nichts — tippe +</p>
          )
        )
      ) : (
        <ul className="divide-y divide-sand-dark/30 border-t border-sand-dark/30">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-200 hover:bg-sand-light"
                onClick={() => onEdit(e)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.name}</div>
                  <div className="tabular text-[11px] text-cocoa-muted">
                    {fluidOf(e) > 0 ? `💧 ${fmtInt(fluidOf(e))} ml · ` : e.amount_g ? `${fmtInt(e.amount_g)} g · ` : ''}
                    E {Math.round(e.protein)} · K {Math.round(e.carbs)} · F {Math.round(e.fat)}
                  </div>
                </div>
                <span className="tabular shrink-0 text-sm text-cocoa-light">{fmtInt(e.kcal)}</span>
              </button>
            </li>
          ))}
          {(onSaveMeal || onPrep) && (
            <li className="flex">
              {onSaveMeal && (
                <button
                  className="flex flex-1 items-center gap-1.5 px-4 py-2 text-xs font-semibold text-cocoa-light transition-colors duration-200 hover:bg-sand-light"
                  onClick={onSaveMeal}
                >
                  <Bookmark size={13} />
                  Als Mahlzeit speichern
                </button>
              )}
              {onPrep && (
                <button
                  className="flex flex-1 items-center justify-end gap-1.5 px-4 py-2 text-xs font-semibold text-cocoa-light transition-colors duration-200 hover:bg-sand-light"
                  onClick={onPrep}
                >
                  <CalendarPlus size={13} />
                  Für weitere Tage
                </button>
              )}
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

/** Schnellauswahl in der leeren Mahlzeit: zuletzt/oft Gegessenes als Chips, ein Tipp trägt ein. */
function QuickChips({
  picks,
  onPick,
  copy,
  onCopy,
  copyBusy,
}: {
  picks: RecentFood[]
  onPick?: (e: FoodEntry) => void
  copy?: MealCopy | null
  onCopy?: () => void
  copyBusy?: boolean
}) {
  const [added, setAdded] = useState<string | null>(null)
  const chip =
    'flex shrink-0 items-center gap-1.5 rounded-full bg-sand py-1.5 pl-3 pr-2 text-sm font-medium text-cocoa transition active:scale-95 disabled:opacity-50'
  return (
    <div className="-mt-1 flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {picks.slice(0, 5).map(({ entry: e }) => (
        <button
          key={e.id}
          type="button"
          className={chip}
          aria-label={`${e.name} eintragen`}
          disabled={added === e.id}
          onClick={() => {
            setAdded(e.id)
            void haptic('success')
            onPick?.(e)
          }}
        >
          <span className="max-w-[9.5rem] truncate">{e.name}</span>
          <span className="tabular text-xs text-cocoa-muted">{fmtInt(e.kcal)}</span>
          <Plus size={15} strokeWidth={2.5} className="text-brand" />
        </button>
      ))}
      {copy && onCopy && (
        <button type="button" className={chip} onClick={onCopy} disabled={copyBusy} aria-label={`Wie ${copy.label}`}>
          <RotateCcw size={14} className="text-cocoa-muted" />
          <span className="whitespace-nowrap">Wie {copy.label}</span>
          <span className="tabular text-xs text-cocoa-muted">{fmtInt(copy.kcal)}</span>
        </button>
      )}
    </div>
  )
}
