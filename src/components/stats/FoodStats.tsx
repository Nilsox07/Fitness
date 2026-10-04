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
import { PageHeader } from '../food-progress/ui'

const WINDOW = 14

const ddmm = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`

/** Ernährungs-Statistik (neue App). */
export function FoodStats() {
  const { data: entries, isLoading } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()
  const { data: allSets } = useAllSets()
  const today = localDate()
  const proteinTarget = settings?.protein_target ?? 0
  const hasKcalTarget = kcalTargetFor(settings, false) > 0

  const stats = useMemo(() => {
    const days = foodTotalsByDate(entries)
    const trainedDates = new Set((allSets ?? []).map((s) => s.date))
    // Kalorienziel je Tag (inkl. Trainingsbonus) — gleiche Regel wie auf der Ernährungsseite.
    const targetOn = (date: string) => kcalTargetFor(settings, trainedDates.has(date))
    // Ø nur über abgeschlossene Tage mit Einträgen (ohne heute, ohne Lücken)
    const complete = [...days.entries()].filter(([d]) => d >= shiftDate(today, -WINDOW) && d < today)
    const n = complete.length
    const avg = (f: (v: (typeof complete)[number][1]) => number) =>
      n ? Math.round(complete.reduce((s, [, v]) => s + f(v), 0) / n) : null
    // Ø-Ziel über dieselben Tage (ohne Tage → Ziel von heute)
    const avgTarget = n ? Math.round(complete.reduce((s, [d]) => s + targetOn(d), 0) / n) : targetOn(today)
    const inTarget = complete.filter(([d, v]) => kcalStatus(v.kcal, targetOn(d), true) === 'ok').length
    const from = shiftDate(today, -(WINDOW - 1))
    const data = Array.from({ length: WINDOW }, (_, i) => {
      const date = shiftDate(from, i)
      const v = days.get(date)
      const target = targetOn(date)
      return {
        date,
        label: ddmm(date),
        kcal: v ? Math.round(v.kcal) : 0,
        target: target > 0 ? target : null,
        today: date === today,
      }
    })
    return {
      n,
      avgKcal: avg((v) => v.kcal),
      avgProtein: avg((v) => v.protein),
      avgCarbs: avg((v) => v.carbs),
      avgFat: avg((v) => v.fat),
      avgTarget,
      inTarget,
      data,
      dots: proteinDots(days, today, proteinTarget, WINDOW),
      streak: proteinStreak(days, today, proteinTarget),
      hasAny: days.size > 0,
    }
  }, [entries, settings, allSets, today, proteinTarget])

  if (isLoading) return <p className="text-cocoa-light">Lädt…</p>

  let i = 1
  return (
    <div className="space-y-5">
      <PageHeader
        title="Fortschritt"
        subtitle={stats.hasAny ? `Letzte ${WINDOW} Tage` : undefined}
        style={stagger(0)}
      />

      {!stats.hasAny && (
        <p className="text-cocoa-light">Noch keine Ernährungsdaten — logge dein erstes Essen.</p>
      )}

      {stats.hasAny && (
        <>
          <StatsHero
            windowDays={WINDOW}
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

          <KcalChartCard data={stats.data} showTarget={hasKcalTarget} style={stagger(i++)} />

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
