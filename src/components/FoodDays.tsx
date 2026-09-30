import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Droplet } from 'lucide-react'
import { useAllFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useAllWater } from '../hooks/useWater'
import { dayLabel, localDate, shiftDate } from '../lib/day'

const DAYS = 30

/** Ernährungs-Tagesliste: letzte 30 Tage, Tipp öffnet den Tag zum Nachtragen/Korrigieren. */
export function FoodDays() {
  const navigate = useNavigate()
  const { data: entries, isLoading } = useAllFoodEntries()
  const { data: water } = useAllWater()
  const { data: settings } = useNutritionSettings()
  const today = localDate()

  const days = useMemo(() => {
    const byDate = new Map<string, { kcal: number; protein: number; count: number }>()
    for (const e of entries ?? []) {
      const d = byDate.get(e.date) ?? { kcal: 0, protein: 0, count: 0 }
      d.kcal += e.kcal
      d.protein += e.protein
      d.count++
      byDate.set(e.date, d)
    }
    const waterBy = new Map((water ?? []).map((w) => [w.date, w.ml]))
    return Array.from({ length: DAYS }, (_, i) => {
      const date = shiftDate(today, -i)
      const d = byDate.get(date)
      return {
        date,
        kcal: Math.round(d?.kcal ?? 0),
        protein: Math.round(d?.protein ?? 0),
        count: d?.count ?? 0,
        water: waterBy.get(date) ?? 0,
      }
    })
  }, [entries, water, today])

  const kcalTarget = settings?.kcal_target ?? 0
  const proteinTarget = settings?.protein_target ?? 0

  if (isLoading) return <p className="text-cocoa-light">Lädt…</p>

  return (
    <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
      {days.map((d) => {
        const inRange = kcalTarget > 0 && d.count > 0 && Math.abs(d.kcal - kcalTarget) <= kcalTarget * 0.1
        const proteinOk = proteinTarget > 0 && d.protein >= proteinTarget
        return (
          <li key={d.date}>
            <button
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-200 active:bg-sand"
              onClick={() => navigate(d.date === today ? '/nutrition' : `/nutrition?date=${d.date}`)}
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{dayLabel(d.date, today)}</div>
                {d.count > 0 ? (
                  <div className="tabular flex flex-wrap items-center gap-x-2 text-sm text-cocoa-light">
                    <span className={inRange ? 'text-success' : ''}>
                      {d.kcal}
                      {kcalTarget > 0 && ` / ${kcalTarget}`} kcal
                    </span>
                    <span className={`flex items-center gap-0.5 ${proteinOk ? 'text-success' : ''}`}>
                      {d.protein} g Eiweiß
                      {proteinOk && <Check size={13} strokeWidth={2.5} />}
                    </span>
                    {d.water > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Droplet size={12} />
                        {(d.water / 1000).toFixed(1).replace('.', ',')} l
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-cocoa-muted">Nichts erfasst</div>
                )}
              </div>
              <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
