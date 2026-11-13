// Meal Prep: eine Mahlzeit auf weitere Tage eintragen (z. B. vorgekochtes Mittagessen Mo–Fr).
// Die Einträge zählen erst an dem jeweiligen Tag.

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { useAddFoodEntries } from '../../hooks/useNutrition'
import { localDate, shiftDate } from '../../lib/day'
import { weekdayIndex, WEEKDAY_SHORT } from '../../lib/schedule'
import { repeatEntry } from '../../lib/recentFoods'
import { MEAL_LABEL, type FoodEntry, type Meal } from '../../types'

export const PREP_DAYS = 14

export function PrepSheet({
  entries,
  meal,
  fromDate,
  onClose,
  onDone,
}: {
  entries: FoodEntry[]
  meal: Meal
  fromDate: string
  onClose: () => void
  onDone?: (n: number) => void
}) {
  const today = localDate()
  const add = useAddFoodEntries()
  const days = Array.from({ length: PREP_DAYS }, (_, i) => shiftDate(today, i)).filter((d) => d !== fromDate)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const kcal = entries.reduce((s, e) => s + e.kcal, 0)
  const toggle = (d: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(d)) n.delete(d)
      else n.add(d)
      return n
    })
  const pick = (list: string[]) => setSel(new Set(list))
  const nextN = (n: number) => days.filter((d) => d > fromDate).slice(0, n)
  const workdays = days.filter((d) => d > fromDate && weekdayIndex(d) < 5).slice(0, 5)

  return (
    <Sheet title="Für weitere Tage eintragen" onClose={onClose}>
      <p className="text-sm text-cocoa-light">
        <b className="text-cocoa">{MEAL_LABEL[meal]}</b> · {entries.length}{' '}
        {entries.length === 1 ? 'Eintrag' : 'Einträge'} · {Math.round(kcal).toLocaleString('de-DE')} kcal – zählt erst
        an dem Tag.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[
          ['Nächste 3 Tage', nextN(3)],
          ['Nächste 5 Tage', nextN(5)],
          ['Werktage', workdays],
        ].map(([l, list]) => (
          <button
            key={l as string}
            onClick={() => pick(list as string[])}
            className="rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-cocoa-light"
          >
            {l as string}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const on = sel.has(d)
          return (
            <button
              key={d}
              onClick={() => toggle(d)}
              aria-pressed={on}
              className={`flex flex-col items-center rounded-xl py-1.5 text-xs font-semibold transition ${
                on ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa-light'
              }`}
            >
              <span className="text-[10px] opacity-80">{WEEKDAY_SHORT[weekdayIndex(d)]}</span>
              <span className="tabular">{Number(d.slice(8))}</span>
            </button>
          )
        })}
      </div>
      <button
        className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3"
        disabled={sel.size === 0 || add.isPending}
        onClick={() => {
          const list = [...sel].sort().flatMap((d) => entries.map((e) => repeatEntry(e, d, meal)))
          add.mutate(list, {
            onSuccess: () => {
              onDone?.(sel.size)
              onClose()
            },
          })
        }}
      >
        <Check size={16} />
        {sel.size ? `Auf ${sel.size} ${sel.size === 1 ? 'Tag' : 'Tage'} eintragen` : 'Tage wählen'}
      </button>
    </Sheet>
  )
}
