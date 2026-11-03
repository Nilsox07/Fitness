import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { FoodEntry } from '../../types'
import type { RecentFood } from '../../lib/recentFoods'
import { fluidOf } from '../../lib/fluid'
import { fmtInt } from '../../lib/nutritionHome'
import { haptic } from '../../lib/native'

/**
 * „Zuletzt“ im Hinzufügen-Menü: passende Lebensmittel zur Mahlzeit.
 * „+“ trägt sofort mit derselben Menge ein (mehrere nacheinander möglich, Menü bleibt offen),
 * Antippen der Zeile öffnet die Menge zum Anpassen.
 */
export function RecentFoods({
  items,
  onQuick,
  onOpen,
  disabled,
  label = 'Zuletzt',
}: {
  items: RecentFood[]
  onQuick: (e: FoodEntry) => void
  onOpen: (e: FoodEntry) => void
  disabled?: boolean
  label?: string
}) {
  const [all, setAll] = useState(false)
  const [added, setAdded] = useState<Record<string, number>>({})
  if (items.length === 0) return null
  const shown = all ? items : items.slice(0, 5)

  return (
    <div>
      <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{label}</h3>
      <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
        {shown.map(({ entry: e, today }) => {
          const n = added[e.id] ?? 0
          const ml = fluidOf(e)
          return (
            <li key={e.id} className="flex items-center gap-2 pr-2">
              <button
                type="button"
                className="flex min-h-[3.5rem] min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left transition-colors active:bg-sand-light"
                onClick={() => onOpen(e)}
                disabled={disabled}
              >
                <span className="truncate text-[15px] font-medium text-cocoa">{e.name}</span>
                <span className="tabular truncate text-xs text-cocoa-muted">
                  {ml > 0 ? `${fmtInt(ml)} ml · ` : e.amount_g ? `${fmtInt(e.amount_g)} g · ` : ''}
                  {fmtInt(e.kcal)} kcal{today ? ' · heute schon' : ''}
                </span>
              </button>
              <button
                type="button"
                aria-label={`${e.name} nochmal eintragen`}
                disabled={disabled}
                onClick={() => {
                  onQuick(e)
                  void haptic('success')
                  setAdded((a) => ({ ...a, [e.id]: (a[e.id] ?? 0) + 1 }))
                }}
                className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-90 disabled:opacity-50 ${
                  n > 0 ? 'bg-success text-white' : 'bg-brand/10 text-brand'
                }`}
              >
                {n > 0 ? (
                  <Check key={n} size={19} strokeWidth={3} className="anim-check" />
                ) : (
                  <Plus size={20} strokeWidth={2.5} />
                )}
                {n > 1 && (
                  <span className="tabular absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cocoa px-1 text-[10px] font-bold text-bg">
                    {n}×
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {items.length > 5 && (
        <button
          type="button"
          className="mt-1.5 w-full py-1.5 text-center text-xs font-semibold text-cocoa-light"
          onClick={() => setAll((v) => !v)}
        >
          {all ? 'Weniger' : `Alle ${items.length} anzeigen`}
        </button>
      )}
    </div>
  )
}
