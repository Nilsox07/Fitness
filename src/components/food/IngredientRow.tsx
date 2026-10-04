import { useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import type { FoodEstimate } from '../../lib/ai'
import { fmt, type MealItem } from './mealItems'

/**
 * Eine erkannte Zutat: Name, kcal, Gramm-Stepper (±10 g, Zahl antippen zum Tippen)
 * und Entfernen. Ohne Grammangabe der KI wird stattdessen der Faktor (×) verstellt.
 */
export function IngredientRow({
  item,
  value,
  portion,
  onFactor,
  onRemove,
}: {
  item: MealItem
  /** Effektive Werte (inkl. Portion) für die Anzeige. */
  value: FoodEstimate
  portion: number
  onFactor: (factor: number) => void
  onRemove: () => void
}) {
  const baseG = item.base.amount_g
  const hasGrams = !!baseG && baseG > 0
  // Angezeigte Größe: Gramm (inkl. Portion) oder Faktor
  const shown = hasGrams ? Math.round(baseG! * item.factor * portion) : Math.round(item.factor * 100) / 100
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')

  function setShown(next: number) {
    if (!Number.isFinite(next)) return
    if (hasGrams) {
      const g = Math.max(5, next)
      onFactor(g / (baseG! * portion))
    } else {
      onFactor(Math.max(0.25, Math.round(next * 4) / 4))
    }
  }

  function step(dir: 1 | -1) {
    setShown(hasGrams ? Math.round(shown / 10) * 10 + dir * 10 : shown + dir * 0.25)
  }

  function commit() {
    const n = parseFloat(text.replace(',', '.'))
    if (Number.isFinite(n) && n > 0) setShown(n)
    setEditing(false)
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-cocoa">{value.name}</div>
        <div className="tabular text-xs text-cocoa-light">
          {value.kcal} kcal · E {fmt(value.protein)} g
        </div>
      </div>
      <div className="flex shrink-0 items-center rounded-full bg-sand p-0.5">
        <button
          className="grid h-7 w-7 place-items-center rounded-full text-cocoa-light transition-colors hover:bg-sand-dark/60 active:scale-95"
          onClick={() => step(-1)}
          aria-label={`${value.name} weniger`}
        >
          <Minus size={14} strokeWidth={2.5} />
        </button>
        {editing ? (
          <input
            className="tabular h-7 w-14 rounded-md bg-sand-light text-center text-sm text-cocoa outline-none ring-1 ring-brand"
            inputMode="decimal"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                e.stopPropagation()
                setEditing(false)
              }
            }}
            aria-label={hasGrams ? 'Menge in Gramm' : 'Faktor'}
          />
        ) : (
          <button
            className="tabular h-7 min-w-[3.5rem] px-1 text-center text-sm font-semibold text-cocoa"
            onClick={() => {
              setText(String(shown).replace('.', ','))
              setEditing(true)
            }}
            aria-label="Menge eintippen"
          >
            {hasGrams ? `${shown} g` : `×${fmt(shown, 2)}`}
          </button>
        )}
        <button
          className="grid h-7 w-7 place-items-center rounded-full text-cocoa-light transition-colors hover:bg-sand-dark/60 active:scale-95"
          onClick={() => step(1)}
          aria-label={`${value.name} mehr`}
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>
      <button
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-cocoa-muted transition-colors hover:text-red-500 dark:hover:text-red-400"
        onClick={onRemove}
        aria-label={`${value.name} entfernen`}
      >
        <X size={16} />
      </button>
    </li>
  )
}
