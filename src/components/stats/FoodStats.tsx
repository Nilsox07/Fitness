import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Flame, Target } from 'lucide-react'
import { useAllFoodEntries, useFoodEntries, useNutritionSettings } from '../../hooks/useNutrition'
import { useWater } from '../../hooks/useWater'
import { useBodyWeights } from '../../hooks/useBodyWeight'
import { useAllSets } from '../../hooks/useWorkouts'
import { kcalTargetFor, trainedOn } from '../../lib/dayTarget'
import { localDate, shiftDate } from '../../lib/day'
import { sumEntries } from '../../lib/nutrition'
import { levelInfo } from '../../lib/xp'
import {
  byDay,
  computeNutritionXp,
  nutritionDailyQuests,
  nutritionStreak,
  nutritionWeeklyQuests,
} from '../../lib/nutritionXp'
import { trendChange, weightTrend } from '../../lib/weightTrend'
import { NutritionGamePanel } from '../NutritionGamePanel'
import { GameSummaryCard, KpiTile, nf, signed, useChartTheme, useGameToggle } from './shared'

const WINDOW = 14

/** Gleiches Maskottchen wie im NutritionGamePanel. */
function foodMascot(level: number): string {
  if (level >= 20) return '🏆'
  if (level >= 12) return '🥇'
  if (level >= 8) return '🥗'
  if (level >= 4) return '🍎'
  return '🌱'
}

const ddmm = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`

function WeightTrendCard() {
  const chart = useChartTheme()
  const { data: weights } = useBodyWeights()

  const w = useMemo(() => {
    const trend = weightTrend((weights ?? []).map((x) => ({ date: x.date, kg: Number(x.weight_kg) })))
    const last = trend[trend.length - 1]
    // Anzeige: die letzten 90 Tage (der Trend nutzt die ganze Historie)
    const from = last ? shiftDate(last.date, -90) : ''
    return {
      last,
      c7: trendChange(trend, 7),
      c30: trendChange(trend, 30),
      data: trend.filter((p) => p.date >= from).map((p) => ({ ...p, label: ddmm(p.date) })),
    }
  }, [weights])

  if (!w.last) return null

  return (
    <section className="card space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Körpergewicht</h2>
        <span className="text-xs text-cocoa-muted">Trend</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="tabular text-2xl font-bold text-cocoa">
          {nf(w.last.trend, 1)}
          <span className="ml-0.5 text-sm font-semibold text-cocoa-light">kg</span>
        </span>
        <span className="tabular text-xs text-cocoa-light">
          {w.c7 !== null && <span>{signed(w.c7)} kg in 7 Tagen</span>}
          {w.c7 !== null && w.c30 !== null && ' · '}
          {w.c30 !== null && <span>{signed(w.c30)} kg in 30 Tagen</span>}
          {w.c7 === null && w.c30 === null && 'Noch zu wenige Messungen für einen Trend'}
        </span>
      </div>
      {w.data.length >= 2 && (
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={w.data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
            <XAxis dataKey="label" tick={chart.axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              tick={chart.axisStyle}
              width={36}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => nf(v, 1)}
            />
            <Tooltip
              {...chart.tooltip}
              cursor={{ stroke: chart.grid }}
              formatter={(v: number, name: string) => [`${nf(v, 1)} kg`, name]}
            />
            <Line
              dataKey="kg"
              name="Gewogen"
              stroke="transparent"
              dot={{ r: 2.5, fill: chart.muted, stroke: 'none' }}
              activeDot={{ r: 3.5, fill: chart.muted, stroke: 'none' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="trend"
              name="Trend"
              stroke={chart.primary}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      <p className="text-[11px] text-cocoa-muted">
        Punkte = gewogene Werte, Linie = geglätteter Trend. Gewicht trägst du im Ernährungs-Tag „Heute“ ein.
      </p>
    </section>
  )
}

function NutritionGameCard() {
  const today = localDate()
  const { data: allEntries } = useAllFoodEntries()
  const { data: todayEntries } = useFoodEntries(today)
  const { data: water } = useWater(today)
  const { data: settings } = useNutritionSettings()
  const { data: allSets } = useAllSets()

  const g = useMemo(() => {
    const entries = allEntries ?? []
    const proteinTarget = settings?.protein_target ?? 0
    const kcalTarget = kcalTargetFor(settings, trainedOn(today, allSets))
    const totals = sumEntries(todayEntries ?? [])
    const quests = [
      ...nutritionDailyQuests({
        loggedToday: (todayEntries?.length ?? 0) > 0,
        protein: totals.protein,
        proteinTarget,
        kcal: totals.kcal,
        kcalTarget,
        waterMl: water?.ml ?? 0,
        waterTarget: settings?.water_target_ml || 2500,
      }),
      ...nutritionWeeklyQuests(entries, proteinTarget),
    ]
    return {
      xp: levelInfo(computeNutritionXp(entries, proteinTarget, today)),
      streak: nutritionStreak(new Set(byDay(entries).keys()), today),
      open: quests.filter((q) => !q.done).length,
    }
  }, [allEntries, todayEntries, water, settings, allSets, today])
  const toggle = useGameToggle(g.xp.level, 'seen_nutrition_level')

  return (
    <GameSummaryCard
      mascot={foodMascot(g.xp.level)}
      title={`Ernährungs-Level ${g.xp.level}`}
      progress={g.xp.progress}
      meta={
        <>
          <span>
            {nf(g.xp.xpInLevel)} / {nf(g.xp.xpForLevel)} XP
          </span>
          <span className="flex items-center gap-0.5">
            <Flame size={12} />
            {g.streak} {g.streak === 1 ? 'Tag' : 'Tage'}
          </span>
          <span className="flex items-center gap-0.5">
            <Target size={12} />
            {g.open === 0 ? 'Alle Quests erledigt' : `${g.open} Quests offen`}
          </span>
        </>
      }
      open={toggle.open}
      onToggle={toggle.toggle}
    >
      <NutritionGamePanel />
    </GameSummaryCard>
  )
}

export function FoodStats() {
  const chart = useChartTheme()
  const { data: entries } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()
  const { data: allSets } = useAllSets()
  const today = localDate()
  const proteinTarget = settings?.protein_target ?? 0
  const hasKcalTarget = kcalTargetFor(settings, false) > 0

  const stats = useMemo(() => {
    const days = byDay(entries ?? [])
    const from = shiftDate(today, -(WINDOW - 1))
    // Kalorienziel je Tag (inkl. Trainingsbonus) — gleiche Regel wie auf der Ernährungsseite.
    const targetOn = (date: string) => kcalTargetFor(settings, trainedOn(date, allSets))
    // Ø nur über abgeschlossene Tage mit Einträgen (ohne heute, ohne Lücken)
    const complete = [...days.entries()].filter(([d]) => d >= shiftDate(today, -WINDOW) && d < today)
    const n = complete.length
    const avgKcal = n ? Math.round(complete.reduce((s, [, v]) => s + v.kcal, 0) / n) : null
    const avgProtein = n ? Math.round(complete.reduce((s, [, v]) => s + v.protein, 0) / n) : null
    // Ø-Ziel über dieselben Tage (ohne Tage → Ziel von heute)
    const avgTarget = n
      ? Math.round(complete.reduce((s, [d]) => s + targetOn(d), 0) / n)
      : targetOn(today)
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
    return { n, avgKcal, avgProtein, avgTarget, data, hasAny: days.size > 0 }
  }, [entries, settings, allSets, today])

  const kcalTarget = stats.avgTarget
  const kcalOk =
    stats.avgKcal !== null && kcalTarget > 0 && Math.abs(stats.avgKcal - kcalTarget) <= kcalTarget * 0.1
  const proteinOk = stats.avgProtein !== null && proteinTarget > 0 && stats.avgProtein >= proteinTarget

  return (
    <>
      {!stats.hasAny && (
        <p className="text-cocoa-light">Noch keine Ernährungsdaten — logge dein erstes Essen.</p>
      )}

      {stats.hasAny && (
        <>
          <section>
            <div className="grid grid-cols-2 gap-2">
              <KpiTile
                label="Ø kcal/Tag"
                value={stats.avgKcal === null ? '–' : nf(stats.avgKcal)}
                valueClass={kcalOk ? 'text-success' : 'text-cocoa'}
                footer={
                  kcalTarget > 0 && (
                    <span className="tabular text-[11px] text-cocoa-muted">
                      {stats.n > 0 ? 'Ø Ziel' : 'Ziel'} {nf(kcalTarget)}
                    </span>
                  )
                }
              />
              <KpiTile
                label="Ø Eiweiß/Tag"
                value={stats.avgProtein === null ? '–' : nf(stats.avgProtein)}
                unit="g"
                valueClass={proteinOk ? 'text-success' : 'text-cocoa'}
                footer={
                  proteinTarget > 0 && (
                    <span className="tabular text-[11px] text-cocoa-muted">Ziel {nf(proteinTarget)} g</span>
                  )
                }
              />
            </div>
            <p className="mt-1.5 text-[11px] text-cocoa-muted">
              {stats.n === 0
                ? 'Noch kein abgeschlossener Tag in den letzten 14 Tagen.'
                : `Ø der letzten ${WINDOW} Tage · ${stats.n} abgeschlossene ${stats.n === 1 ? 'Tag' : 'Tage'} mit Einträgen (ohne heute)`}
            </p>
          </section>

          <section className="card">
            <h2 className="mb-2 font-semibold">Kalorien pro Tag</h2>
            <ResponsiveContainer width="100%" height={170}>
              <ComposedChart data={stats.data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis dataKey="label" tick={chart.axisStyle} tickLine={false} axisLine={false} minTickGap={8} />
                <YAxis tick={chart.axisStyle} width={40} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...chart.tooltip} formatter={(v: number, name: string) => [`${nf(v)} kcal`, name]} />
                <Bar dataKey="kcal" name="Kalorien" radius={[4, 4, 0, 0]} maxBarSize={22}>
                  {stats.data.map((d) => (
                    <Cell key={d.date} fill={chart.primary} fillOpacity={d.today ? 0.4 : 1} />
                  ))}
                </Bar>
                {/* Ziel je Tag (Trainingstage +250 kcal) als Stufenlinie */}
                {hasKcalTarget && (
                  <Line
                    type="step"
                    dataKey="target"
                    name="Ziel"
                    stroke={chart.axis}
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </section>
        </>
      )}

      <WeightTrendCard />

      {stats.hasAny && <NutritionGameCard />}
    </>
  )
}
