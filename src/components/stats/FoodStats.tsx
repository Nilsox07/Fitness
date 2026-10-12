import { useMemo } from 'react'
import { useAllFoodEntries, useNutritionSettings } from '../../hooks/useNutrition'
import { useAllSets } from '../../hooks/useWorkouts'
import { kcalTargetFor } from '../../lib/dayTarget'
import { localDate, shiftDate } from '../../lib/day'
import { foodTotalsByDate, kcalStatus, proteinDots, proteinStreak } from '../../lib/foodProgress'
import { stagger } from '../nutrition-home/motion'
import { StatsHero } from '../food-progress/StatsHero'
import { MacroSplitCard } from '../food-progress/MacroSplitCard'
import { KcalChartCard } from '../food-progress/KcalChartCard'
import { WeightTrendCard } from '../food-progress/WeightTrendCard'
import { ProteinDotsCard } from '../food-progress/ProteinDotsCard'
import { NutritionGameCard } from '../food-progress/NutritionGameCard'
import { ProgressHeader, Segmented } from '../progress/ProgressHeader'
import { useNutritionPrefs } from '../../hooks/usePrefsSync'
import { useProgressPeriod } from '../../lib/progressPeriod'
import { periodRange, PERIOD_LABELS, type Period } from '../../lib/periods'
import { daysBetween } from '../social/format'
import { isoWeekNumber, MONTHS_LONG } from '../progress/progressUtils'

const ddmm = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`

/** Ernährungs-Statistik (neue App). */
export function FoodStats() {
  const { kcalBonus } = useNutritionPrefs()
  const { data: entries, isLoading } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()
  const { data: allSets } = useAllSets()
  const today = localDate()
  const [period, setPeriod] = useProgressPeriod()
  const range = useMemo(() => periodRange(period, today), [period, today])
  const proteinTarget = settings?.protein_target ?? 0
  const hasKcalTarget = kcalTargetFor(settings, false) > 0

  const stats = useMemo(() => {
    const days = foodTotalsByDate(entries)
    const trainedDates = new Set((allSets ?? []).map((s) => s.date))
    // Kalorienziel je Tag (inkl. Trainingsbonus) — gleiche Regel wie auf der Ernährungsseite.
    const targetOn = (date: string) => kcalTargetFor(settings, trainedDates.has(date), kcalBonus)
    // Ø nur über abgeschlossene Tage mit Einträgen im Zeitraum (ohne heute, ohne Lücken)
    const complete = [...days.entries()].filter(([d]) => d >= range.start && d < today)
    const n = complete.length
    const avg = (f: (v: (typeof complete)[number][1]) => number) =>
      n ? Math.round(complete.reduce((s, [, v]) => s + f(v), 0) / n) : null
    // Ø-Ziel über dieselben Tage (ohne Tage → Ziel von heute)
    const avgTarget = n ? Math.round(complete.reduce((s, [d]) => s + targetOn(d), 0) / n) : targetOn(today)
    const inTarget = complete.filter(([d, v]) => kcalStatus(v.kcal, targetOn(d), true) === 'ok').length
    // Woche/Monat: ein Balken pro Tag des Zeitraums. Jahr: Ø pro Woche (sonst 365 Balken).
    const dayBar = (date: string) => {
      const v = days.get(date)
      const target = targetOn(date)
      return { date, label: ddmm(date), kcal: v ? Math.round(v.kcal) : 0, target: target > 0 ? target : null, today: date === today }
    }
    let data
    if (period === 'year') {
      data = []
      for (let w = range.start; w <= today; w = shiftDate(w, 7)) {
        const span = Array.from({ length: 7 }, (_, i) => shiftDate(w, i)).filter((d) => d <= today && days.has(d))
        const kcal = span.length ? Math.round(span.reduce((s2, d) => s2 + (days.get(d)?.kcal ?? 0), 0) / span.length) : 0
        const target = targetOn(w)
        data.push({ date: w, label: ddmm(w), kcal, target: target > 0 ? target : null, today: shiftDate(w, 7) > today })
      }
    } else {
      data = Array.from({ length: daysBetween(range.start, range.periodEnd) + 1 }, (_, i) => dayBar(shiftDate(range.start, i)))
    }
    const elapsed = daysBetween(range.start, today) + 1
    return {
      n,
      avgKcal: avg((v) => v.kcal),
      avgProtein: avg((v) => v.protein),
      avgCarbs: avg((v) => v.carbs),
      avgFat: avg((v) => v.fat),
      avgTarget,
      inTarget,
      data,
      elapsed,
      dots: proteinDots(days, today, proteinTarget, Math.min(elapsed, 31)),
      streak: proteinStreak(days, today, proteinTarget),
      hasAny: days.size > 0,
    }
  }, [entries, settings, allSets, today, proteinTarget, kcalBonus, range, period])

  const [, sm] = range.start.split('-').map(Number)
  const periodName =
    period === 'week' ? `KW ${isoWeekNumber(range.start)}` : period === 'month' ? MONTHS_LONG[sm - 1] : range.start.slice(0, 4)

  if (isLoading) return <p className="text-cocoa-light">Lädt…</p>

  let i = 1
  return (
    <div className="space-y-5">
      <ProgressHeader
        title="Fortschritt"
        subtitle={`${periodName} · ${stats.n} ${stats.n === 1 ? 'Tag' : 'Tage'} erfasst`}
        action={
          <Segmented
            label="Zeitraum"
            value={period}
            onChange={setPeriod}
            options={(Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
          />
        }
      />

      {!stats.hasAny && (
        <p className="text-cocoa-light">Noch keine Ernährungsdaten — logge dein erstes Essen.</p>
      )}

      {stats.hasAny && (
        <>
          <StatsHero
            windowDays={stats.elapsed}
            n={stats.n}
            avgKcal={stats.avgKcal}
            avgTarget={stats.avgTarget}
            inTarget={stats.inTarget}
            avgProtein={stats.avgProtein}
            proteinTarget={proteinTarget}
            style={stagger(i++)}
          />

          {stats.n > 0 && (
            <MacroSplitCard
              protein={stats.avgProtein ?? 0}
              carbs={stats.avgCarbs ?? 0}
              fat={stats.avgFat ?? 0}
              targets={{
                protein: proteinTarget,
                carbs: settings?.carbs_target ?? 0,
                fat: settings?.fat_target ?? 0,
              }}
              style={stagger(i++)}
            />
          )}

          <KcalChartCard
            data={stats.data}
            showTarget={hasKcalTarget}
            title={period === 'year' ? 'Ø Kalorien pro Woche' : 'Kalorien pro Tag'}
            right={period === 'year' ? `${stats.data.length} Wochen` : periodName}
            style={stagger(i++)}
          />

          {proteinTarget > 0 && (
            <ProteinDotsCard
              dots={stats.dots}
              target={proteinTarget}
              streak={stats.streak}
              today={today}
              style={stagger(i++)}
            />
          )}
        </>
      )}

      <WeightTrendCard style={stagger(i++)} />

      {stats.hasAny && <NutritionGameCard style={stagger(i++)} />}
    </div>
  )
}
