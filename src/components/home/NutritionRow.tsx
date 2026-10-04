import { ChevronRight, Utensils } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePrefs } from '../../lib/prefs'
import { localDate } from '../../lib/day'
import { sumEntries } from '../../lib/nutrition'
import { kcalTargetFor, trainedOn } from '../../lib/dayTarget'
import { useFoodEntries, useNutritionSettings } from '../../hooks/useNutrition'
import type { SetWithDate } from '../../types'
import { enter } from './motion'
import { useNutritionPrefs } from '../../hooks/usePrefsSync'

/** Eine Zeile Ernährung statt doppeltem Tagesüberblick → wechselt in die Ernährungs-Welt. */
export function NutritionRow({ allSets, index }: { allSets: SetWithDate[] | undefined; index: number }) {
  const { kcalBonus } = useNutritionPrefs()
  const navigate = useNavigate()
  const { showNutrition, setWorld } = usePrefs()
  const day = localDate() // Ernährung zählt nach Kalendertag
  const { data: settings } = useNutritionSettings()
  const { data: entries } = useFoodEntries(day)
  if (!showNutrition) return null

  const totals = sumEntries(entries ?? [])
  const target = kcalTargetFor(settings, trainedOn(day, allSets), kcalBonus)
  const pct = target ? Math.min(100, Math.round((totals.kcal / target) * 100)) : 0
  const fmt = (n: number) => n.toLocaleString('de-DE')

  return (
    <button
      className="card flex w-full items-center gap-3 py-3 text-left transition active:scale-[0.99]"
      style={enter(index)}
      onClick={() => {
        setWorld('food')
        navigate('/nutrition')
      }}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light">
        <Utensils size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-cocoa-muted">Ernährung heute</span>
        <span className="tabular block truncate text-sm font-semibold">
          {fmt(totals.kcal)}
          {target > 0 && <span className="font-normal text-cocoa-light"> / {fmt(target)}</span>} kcal
          <span className="font-normal text-cocoa-light"> · {fmt(totals.protein)} g Eiweiß</span>
        </span>
        {target > 0 && (
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-sand">
            <span
              className={`block h-full rounded-full ${pct >= 100 ? 'bg-success' : 'bg-cocoa-muted'}`}
              style={{ width: `${pct}%` }}
            />
          </span>
        )}
      </span>
      <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
    </button>
  )
}
