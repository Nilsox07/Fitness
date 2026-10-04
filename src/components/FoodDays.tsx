import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Droplet } from 'lucide-react'
import { useAllFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useAllWater } from '../hooks/useWater'
import { useAllSets } from '../hooks/useWorkouts'
import { dayLabel, localDate, shiftDate } from '../lib/day'
import { kcalTargetFor } from '../lib/dayTarget'
import { foodTotalsByDate, kcalStatus, loggedSummary } from '../lib/foodProgress'
import { fmtInt, fmtLiters } from '../lib/nutritionHome'
import { stagger } from './nutrition-home/motion'
import { MonthCalendar } from './food-progress/MonthCalendar'
import { PageHeader, SectionTitle } from './food-progress/ui'

const RECENT = 7

/** Ernährungs-Tage (neue App): Monatskalender mit kcal-Ringen + die letzten 7 Tage als Liste. */
export function FoodDays() {
  const navigate = useNavigate()
  const { data: entries, isLoading } = useAllFoodEntries()
  const { data: water } = useAllWater()
  const { data: settings } = useNutritionSettings()
  const { data: allSets } = useAllSets()
  const today = localDate()

  const d = useMemo(() => {
    const totals = foodTotalsByDate(entries)
    const kcalBy = new Map([...totals].map(([k, v]) => [k, v.kcal]))
    const waterBy = new Map((water ?? []).map((w) => [w.date, w.ml]))
    const trainedDates = new Set((allSets ?? []).map((s) => s.date))
    // Kalorienziel des Tages inkl. Trainingsbonus (gleiche Regel wie auf „Ernährung")
    const targetFor = (date: string) => kcalTargetFor(settings, trainedDates.has(date))
    let earliest: string | null = null
    for (const k of totals.keys()) if (!earliest || k < earliest) earliest = k
    const recent = Array.from({ length: RECENT }, (_, i) => {
      const date = shiftDate(today, -i)
      const t = totals.get(date)
      return {
        date,
        kcal: Math.round(t?.kcal ?? 0),
        protein: Math.round(t?.protein ?? 0),
        count: t?.count ?? 0,
        water: waterBy.get(date) ?? 0,
        kcalTarget: targetFor(date),
      }
    })
    return { kcalBy, targetFor, earliest, recent, summary: loggedSummary(totals, today, 30) }
  }, [entries, water, allSets, settings, today])

  const proteinTarget = settings?.protein_target ?? 0
  const open = (date: string) => navigate(date === today ? '/nutrition' : `/nutrition?date=${date}`)

  if (isLoading) return <p className="text-cocoa-light">Lädt…</p>

  const { summary } = d
  const subtitle =
    summary.logged === 0
      ? 'Noch nichts geloggt in den letzten 30 Tagen'
      : `${summary.avgKcal !== null ? `Ø ${fmtInt(summary.avgKcal)} kcal · ` : ''}${summary.logged} von ${summary.days} Tagen geloggt`

  return (
    <div className="space-y-4">
      <PageHeader title="Tage" subtitle={subtitle} style={stagger(0)} />

      <MonthCalendar
        today={today}
        kcalByDate={d.kcalBy}
        targetFor={d.targetFor}
        earliest={d.earliest}
        onOpen={open}
        style={stagger(1)}
      />

      <section style={stagger(2)}>
        <SectionTitle>Letzte 7 Tage</SectionTitle>
        <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
          {d.recent.map((r) => {
            const status = kcalStatus(r.kcal, r.kcalTarget, r.count > 0)
            const proteinOk = proteinTarget > 0 && r.protein >= proteinTarget
            return (
              <li key={r.date}>
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-200 active:bg-sand"
                  onClick={() => open(r.date)}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      status === 'ok'
                        ? 'bg-success'
                        : status === 'over'
                          ? 'bg-gold'
                          : status === 'empty'
                            ? 'bg-sand-dark/60'
                            : 'bg-brand'
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{dayLabel(r.date, today)}</span>
                      {r.count > 0 && (
                        <span className="tabular shrink-0 text-sm">
                          <span
                            className={`font-semibold ${
                              status === 'ok' ? 'text-success' : status === 'over' ? 'text-gold' : 'text-cocoa'
                            }`}
                          >
                            {fmtInt(r.kcal)}
                          </span>
                          <span className="text-cocoa-muted">
                            {r.kcalTarget > 0 && ` / ${fmtInt(r.kcalTarget)}`} kcal
                          </span>
                        </span>
                      )}
                    </div>
                    {r.count > 0 ? (
                      <div className="tabular mt-1 flex flex-wrap items-center gap-1.5 text-xs text-cocoa-light">
                        <span
                          className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium ${
                            proteinOk ? 'bg-success/15 text-success' : 'bg-sand text-cocoa-light'
                          }`}
                        >
                          {r.protein} g Eiweiß
                          {proteinOk && <Check size={12} strokeWidth={2.75} />}
                        </span>
                        {r.water > 0 && (
                          <span className="flex items-center gap-0.5 rounded-full bg-sand px-2 py-0.5 font-medium">
                            <Droplet size={11} className="text-brand" />
                            {fmtLiters(r.water)} l
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-cocoa-muted">Nichts erfasst</div>
                    )}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
