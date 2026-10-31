import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useNutrientPins } from '../../hooks/usePrefsSync'
import { fmt } from './mealItems'

type Values = { fiber: number; sugar: number; sat_fat: number; salt: number }
type Key = keyof Values

const LABEL: Record<Key, string> = { fiber: 'Ballaststoffe', sugar: 'Zucker', sat_fat: 'ges. Fett', salt: 'Salz' }

/**
 * Kompakte Zeile unter den Makros: Ballaststoffe immer, Zucker/Salz nur wenn angeheftet,
 * der Rest hinter „Mehr“.
 */
export function NutrientExtras({ values }: { values: Values }) {
  const pins = useNutrientPins()
  const [open, setOpen] = useState(false)
  const keys: Key[] = ['fiber', 'sugar', 'sat_fat', 'salt']
  const visible = (k: Key) => k === 'fiber' || (k === 'sugar' && pins.sugar) || (k === 'salt' && pins.salt)
  const shown = open ? keys : keys.filter(visible)
  const hasMore = keys.some((k) => !visible(k))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((k) => (
        <span key={k} className="tabular rounded-full bg-sand px-2.5 py-1 text-xs text-cocoa-light">
          {LABEL[k]} <span className="font-semibold text-cocoa">{fmt(values[k], k === 'salt' ? 2 : 1)} g</span>
        </span>
      ))}
      {hasMore && (
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold text-brand"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'Weniger' : 'Mehr'}
          <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}
