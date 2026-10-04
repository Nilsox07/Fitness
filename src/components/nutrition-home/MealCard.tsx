import type { CSSProperties } from 'react'
import { Coffee, Cookie, Moon, Plus, Sun, type LucideIcon } from 'lucide-react'
import { MEAL_LABEL, type FoodEntry, type Meal } from '../../types'
import { fmtInt } from '../../lib/nutritionHome'

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
  style,
}: {
  meal: Meal
  entries: FoodEntry[]
  /** empfohlene kcal (0 = ausblenden) */
  recommended: number
  onAdd: () => void
  onEdit: (e: FoodEntry) => void
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
        recommended > 0 && <p className="-mt-1 px-4 pb-3 pl-[4.25rem] text-xs text-cocoa-muted">Noch nichts — tippe +</p>
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
                    {e.amount_g ? `${fmtInt(e.amount_g)} g · ` : ''}E {Math.round(e.protein)} · K {Math.round(e.carbs)} · F{' '}
                    {Math.round(e.fat)}
                  </div>
                </div>
                <span className="tabular shrink-0 text-sm text-cocoa-light">{fmtInt(e.kcal)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
