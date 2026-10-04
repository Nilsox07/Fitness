import type { MealTotals } from '../../lib/mealScore'
import { fmt } from './mealItems'

/** Referenzwerte (Tageszufuhr Erwachsene) für Nährwerte ohne eigenes Ziel. */
const REFERENCE = { sugar: 50, sat_fat: 20, fiber: 30, salt: 6 }

export interface NutrientTargets {
  protein: number
  carbs: number
  fat: number
}

/** Nährwert-Liste im Apple-Health-Stil (Zeilen in einem Container). */
export function NutrientList({ totals, targets }: { totals: MealTotals; targets: NutrientTargets }) {
  const rows: {
    label: string
    value: number
    target: number
    sub?: boolean
    digits?: number
  }[] = [
    { label: 'Eiweiß', value: totals.protein, target: targets.protein },
    { label: 'Kohlenhydrate', value: totals.carbs, target: targets.carbs },
    {
      label: 'davon Zucker',
      value: totals.sugar,
      target: REFERENCE.sugar,
      sub: true,
    },
    { label: 'Fett', value: totals.fat, target: targets.fat },
    {
      label: 'davon gesättigt',
      value: totals.sat_fat,
      target: REFERENCE.sat_fat,
      sub: true,
    },
    { label: 'Ballaststoffe', value: totals.fiber, target: REFERENCE.fiber },
    { label: 'Salz', value: totals.salt, target: REFERENCE.salt, digits: 2 },
  ]
  return (
    <div className="divide-y divide-sand-dark/60 overflow-hidden rounded-2xl bg-cream">
      {rows.map((r) => (
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
      <p className="px-4 py-2.5 text-[11px] text-cocoa-muted">
        % vom Tagesziel · Zucker, ges. Fett, Ballaststoffe & Salz nach Referenzwerten
      </p>
    </div>
  )
}
