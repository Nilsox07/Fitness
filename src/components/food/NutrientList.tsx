import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { MealTotals } from '../../lib/mealScore'
import { DEFAULT_FIBER_TARGET, NUTRIENT_REFERENCE } from '../../lib/nutrition'
import { useNutrientPins } from '../../hooks/usePrefsSync'
import { InfoTip } from '../ui/InfoTip'
import { fmt } from './mealItems'

export interface NutrientTargets {
  protein: number
  carbs: number
  fat: number
  /** Ballaststoffziel am Tag (Standard 30 g) */
  fiber?: number
}

type Extra = 'sugar' | 'sat_fat' | 'salt'

/**
 * Nährwert-Liste im Apple-Health-Stil. Immer sichtbar: Eiweiß, Kohlenhydrate, Fett,
 * Ballaststoffe. Zucker, ges. Fett und Salz hinter „Mehr“ — Zucker/Salz lassen sich
 * in den Einstellungen anheften.
 */
export function NutrientList({ totals, targets }: { totals: MealTotals; targets: NutrientTargets }) {
  const pins = useNutrientPins()
  const [open, setOpen] = useState(false)
  const rows: {
    label: string
    value: number
    target: number
    sub?: boolean
    digits?: number
    extra?: Extra
  }[] = [
    { label: 'Eiweiß', value: totals.protein, target: targets.protein },
    { label: 'Kohlenhydrate', value: totals.carbs, target: targets.carbs },
    { label: 'davon Zucker', value: totals.sugar, target: NUTRIENT_REFERENCE.sugar, sub: true, extra: 'sugar' },
    { label: 'Fett', value: totals.fat, target: targets.fat },
    {
      label: 'davon gesättigt',
      value: totals.sat_fat,
      target: NUTRIENT_REFERENCE.sat_fat,
      sub: true,
      extra: 'sat_fat',
    },
    { label: 'Ballaststoffe', value: totals.fiber, target: targets.fiber ?? DEFAULT_FIBER_TARGET },
    { label: 'Salz', value: totals.salt, target: NUTRIENT_REFERENCE.salt, digits: 2, extra: 'salt' },
  ]
  const pinned = (e?: Extra) => !e || (e === 'sugar' && pins.sugar) || (e === 'salt' && pins.salt)
  const hidden = rows.filter((r) => !pinned(r.extra)).length
  const shown = open ? rows : rows.filter((r) => pinned(r.extra))

  return (
    <div className="divide-y divide-sand-dark/60 overflow-hidden rounded-2xl bg-cream">
      {shown.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3 px-4 py-3">
          <span className={r.sub ? 'pl-3 text-sm text-cocoa-light' : 'text-sm text-cocoa'}>{r.label}</span>
          <span className="tabular flex items-baseline gap-2 text-right">
            {r.target > 0 && (
              <span className="text-xs text-cocoa-muted">{Math.round((r.value / r.target) * 100)} %</span>
            )}
            <span className="min-w-[4.5rem] text-sm font-semibold text-cocoa">{fmt(r.value, r.digits ?? 1)} g</span>
          </span>
        </div>
      ))}
      {hidden > 0 && (
        <button
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-cocoa-light"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'Weniger' : moreLabel(pins)}
          <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      <div className="px-4 py-2.5">
        <InfoTip
          className="text-[11px] text-cocoa-muted"
          info="Eiweiß, Kohlenhydrate, Fett und Ballaststoffe beziehen sich auf dein Tagesziel, Zucker, gesättigtes Fett und Salz auf Referenzwerte für Erwachsene (50 / 20 / 6 g). Zucker und Salz kannst du in den Einstellungen immer anzeigen."
        >
          % vom Tagesziel
        </InfoTip>
      </div>
    </div>
  )
}

/** „Mehr“-Beschriftung mit den versteckten Werten. */
function moreLabel(pins: { sugar: boolean; salt: boolean }): string {
  const names = [!pins.sugar && 'Zucker', 'ges. Fett', !pins.salt && 'Salz'].filter(Boolean) as string[]
  return `Mehr: ${names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0]}`
}
