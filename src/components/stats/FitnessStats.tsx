import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronRight, Flame, Target, Trophy } from 'lucide-react'
import {
  balanceStats,
  estimate1RM,
  frequencyStats,
  lastTrainedPerMuscle,
  muscleVolume,
  onlyWorking,
  round1,
  setVolume,
  totalVolume,
} from '../../lib/analytics'
import { localDate } from '../../lib/day'
import { inRange, pctChange, periodBuckets, periodRange, sumByBucket, type Period } from '../../lib/periods'
import { computeXp, dailyQuests, levelInfo, weeklyQuests } from '../../lib/xp'
import { rankForSessions } from '../../lib/gamification'
import { mascotEmoji } from '../../lib/cosmetics'
import { weekStreakWithFreezes } from '../../lib/streaks'
import { useStreakState } from '../../hooks/useStreak'
import { GamePanel } from '../GamePanel'
import { StreakCard } from '../StreakCard'
import { SeasonCard } from '../SeasonCard'
import { Heatmap } from '../Heatmap'
import { AiPanel } from '../AiPanel'
import type { Exercise, SetWithDate } from '../../types'
import {
  GameSummaryCard,
  KpiTile,
  PeriodSwitch,
  Trend,
  nf,
  useChartTheme,
  useGameToggle,
} from './shared'

/** Volumen als „12,4 t" bzw. „850 kg". */
function volumeParts(kg: number): { value: string; unit: string } {
  return kg >= 10000 ? { value: nf(kg / 1000, 1), unit: 't' } : { value: nf(Math.round(kg)), unit: 'kg' }
}

/** Bester Wert eines Satzes (bei einseitigen Übungen die stärkere Seite). */
function setBest(s: SetWithDate) {
  const left = { weight: s.weight, reps: s.reps, e1: estimate1RM(s.weight, s.reps) }
  if (s.weight_right == null || s.reps_right == null) return left
  const right = { weight: s.weight_right, reps: s.reps_right, e1: estimate1RM(s.weight_right, s.reps_right) }
  return right.e1 > left.e1 ? right : left
}

/** YYYY-MM-DD → „01.09.2026" */
const dmy = (d: string) => d.split('-').reverse().join('.')

interface ExerciseRow {
  id: string
  name: string
  sessions: number
  best: { weight: number; reps: number; e1: number }
  pr: boolean
}

function Ratio({ a, b, labelA, labelB }: { a: number; b: number; labelA: string; labelB: string }) {
  const total = a + b
  const pct = total > 0 ? Math.round((a / total) * 100) : 50
  return (
    <div>
      <div className="tabular mb-1 flex justify-between text-xs text-cocoa-light">
        <span>
          {labelA} · {pct} %
        </span>
        <span>
          {100 - pct} % · {labelB}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-sand-dark/40">
        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        <div className="h-full bg-sand-dark" style={{ width: `${100 - pct}%` }} />
      </div>
    </div>
  )
}

export function FitnessStats({ sets, exercises }: { sets: SetWithDate[]; exercises: Exercise[] }) {
  const navigate = useNavigate()
  const chart = useChartTheme()
  const [period, setPeriod] = useState<Period>('month')
  const today = localDate()

  const range = useMemo(() => periodRange(period, today), [period, today])
  const cur = useMemo(() => sets.filter((s) => inRange(s.date, range.start, range.end)), [sets, range])
  const prev = useMemo(
    () => sets.filter((s) => inRange(s.date, range.prevStart, range.prevEnd)),
    [sets, range],
  )

  const kpi = useMemo(() => {
    const sessions = (list: SetWithDate[]) => new Set(list.map((s) => s.date)).size
    const c = { sessions: sessions(cur), volume: totalVolume(cur), sets: onlyWorking(cur).length }
    const p = { sessions: sessions(prev), volume: totalVolume(prev), sets: onlyWorking(prev).length }
    return {
      c,
      trend: {
        sessions: pctChange(c.sessions, p.sessions),
        volume: pctChange(c.volume, p.volume),
        sets: pctChange(c.sets, p.sets),
      },
    }
  }, [cur, prev])

  const volumeChart = useMemo(() => {
    const data = sumByBucket(
      cur.map((s) => ({ date: s.date, value: setVolume(s) })),
      periodBuckets(period, today),
    )
    const max = Math.max(0, ...data.map((d) => d.value))
    return { data, inTons: max >= 10000 }
  }, [cur, period, today])

  const balance = useMemo(() => balanceStats(cur, exercises), [cur, exercises])
  const byMuscle = useMemo(() => muscleVolume(cur, exercises).filter((m) => m.value > 0), [cur, exercises])
  const maxMuscle = Math.max(1, ...byMuscle.map((m) => m.value))
  const stale = useMemo(
    () => lastTrainedPerMuscle(sets, exercises).filter((r) => r.daysAgo >= 5).slice(0, 3),
    [sets, exercises],
  )

  const exerciseRows = useMemo<ExerciseRow[]>(() => {
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const acc = new Map<string, { dates: Set<string>; count: number; best: ExerciseRow['best']; before: number }>()
    for (const s of onlyWorking(sets)) {
      if (s.date > range.end) continue
      const b = setBest(s)
      const row = acc.get(s.exercise_id) ?? {
        dates: new Set<string>(),
        count: 0,
        best: { weight: 0, reps: 0, e1: -1 },
        before: 0,
      }
      if (s.date < range.start) {
        row.before = Math.max(row.before, b.e1)
      } else {
        row.dates.add(s.date)
        row.count++
        // Bester Satz: höchstes geschätztes 1RM, bei Körpergewicht die meisten Wdh.
        if (b.e1 > row.best.e1 || (b.e1 === row.best.e1 && b.reps > row.best.reps)) row.best = b
      }
      acc.set(s.exercise_id, row)
    }
    return [...acc.entries()]
      .filter(([id, r]) => r.count > 0 && byId.has(id))
      .map(([id, r]) => ({
        id,
        name: byId.get(id)!.name,
        sessions: r.dates.size,
        best: r.best,
        pr: r.before > 0 && r.best.e1 > r.before + 0.01,
        count: r.count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [sets, exercises, range])
  const [showAllEx, setShowAllEx] = useState(false)
  const visibleRows = showAllEx ? exerciseRows : exerciseRows.slice(0, 6)
  const prCount = exerciseRows.filter((r) => r.pr).length

  // Gamification-Zusammenfassung
  const { data: streakState } = useStreakState()
  const game = useMemo(() => {
    const dates = [...new Set(sets.map((s) => s.date))]
    const freq = frequencyStats(dates)
    const quests = [...dailyQuests(sets, today), ...weeklyQuests(sets)]
    return {
      xp: levelInfo(computeXp(sets)),
      rank: rankForSessions(freq.totalSessions),
      mascot: mascotEmoji(freq.totalSessions),
      streak: weekStreakWithFreezes(dates, streakState?.frozen_weeks ?? []),
      open: quests.filter((q) => !q.done).length,
    }
  }, [sets, today, streakState])
  const gameToggle = useGameToggle(game.xp.level, 'seen_level')

  const vol = volumeParts(kpi.c.volume)

  return (
    <>
      <PeriodSwitch value={period} onChange={setPeriod} />

      {/* Kennzahlen */}
      <section>
        <div className="grid grid-cols-3 gap-2">
          <KpiTile label="Trainings" value={nf(kpi.c.sessions)} footer={<Trend pct={kpi.trend.sessions} />} />
          <KpiTile label="Volumen" value={vol.value} unit={vol.unit} footer={<Trend pct={kpi.trend.volume} />} />
          <KpiTile label="Sätze" value={nf(kpi.c.sets)} footer={<Trend pct={kpi.trend.sets} />} />
        </div>
        <p className="mt-1.5 text-[11px] text-cocoa-muted">
          {dmy(range.start)} – {dmy(range.end)} · verglichen mit dem gleichen Zeitraum{' '}
          {period === 'week' ? 'der Vorwoche' : period === 'month' ? 'im Vormonat' : 'im Vorjahr'}
        </p>
      </section>

      {/* Volumen-Verlauf */}
      <section className="card">
        <h2 className="mb-2 font-semibold">
          Volumen pro {period === 'week' ? 'Tag' : period === 'month' ? 'Woche' : 'Monat'}
          <span className="ml-1 text-xs font-normal text-cocoa-muted">({volumeChart.inTons ? 't' : 'kg'})</span>
        </h2>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={volumeChart.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
            <XAxis dataKey="label" tick={chart.axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={4} />
            <YAxis
              tick={chart.axisStyle}
              width={48}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tickFormatter={(v: number) => (volumeChart.inTons ? nf(v / 1000, 1) : nf(v))}
            />
            <Tooltip
              {...chart.tooltip}
              formatter={(v: number) => {
                const p = volumeParts(v)
                return [`${p.value} ${p.unit}`, 'Volumen']
              }}
            />
            <Bar dataKey="value" fill={chart.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Muskel-Balance */}
      {byMuscle.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Muskelbalance</h2>
          <Ratio a={balance.push} b={balance.pull} labelA="Drücken" labelB="Ziehen" />
          <Ratio a={balance.upper} b={balance.lower} labelA="Oberkörper" labelB="Beine" />
          <ul className="space-y-1.5 pt-1">
            {byMuscle.slice(0, 8).map((m) => (
              <li key={m.muscle} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-sm">{m.muscle}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-dark/40">
                  <div className="h-full bg-brand" style={{ width: `${(m.value / maxMuscle) * 100}%` }} />
                </div>
                <span className="tabular w-14 shrink-0 text-right text-xs text-cocoa-light">
                  {(() => {
                    const p = volumeParts(m.value)
                    return `${p.value} ${p.unit}`
                  })()}
                </span>
              </li>
            ))}
          </ul>
          {stale.length > 0 && (
            <p className="border-t border-sand-dark/40 pt-2 text-xs text-cocoa-light">
              Länger nicht trainiert:{' '}
              {stale.map((r, i) => (
                <span key={r.muscle}>
                  {i > 0 && ', '}
                  <span className="text-cocoa">{r.muscle}</span>{' '}
                  <span className="tabular">({r.daysAgo} T.)</span>
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      {/* Übungen */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-semibold">Übungen</h2>
          {prCount > 0 && (
            <span className="tabular flex items-center gap-1 text-xs text-cocoa-light">
              <Trophy size={13} className="text-gold" />
              {prCount} {prCount === 1 ? 'Rekord' : 'Rekorde'}
            </span>
          )}
        </div>
        <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
          {exerciseRows.length === 0 && (
            <p className="px-4 py-3 text-sm text-cocoa-light">
              In diesem Zeitraum noch keine Arbeitssätze.
            </p>
          )}
          {visibleRows.map((r) => (
            <button
              key={r.id}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-sand/60"
              onClick={() => navigate(`/exercises/${r.id}`)}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-cocoa">{r.name}</span>
                  {r.pr && <Trophy size={14} className="shrink-0 text-gold" aria-label="Neuer Rekord" />}
                </span>
                <span className="tabular block text-xs text-cocoa-light">
                  {r.best.weight > 0
                    ? `${nf(r.best.weight, 1)} kg × ${r.best.reps} · 1RM ≈ ${nf(round1(r.best.e1), 1)} kg`
                    : `${r.best.reps} Wdh.`}
                  <span className="text-cocoa-muted"> · {r.sessions}× trainiert</span>
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
            </button>
          ))}
          {exerciseRows.length > 6 && (
            <button
              className="w-full px-4 py-2.5 text-left text-sm font-semibold text-brand"
              onClick={() => setShowAllEx((v) => !v)}
            >
              {showAllEx ? 'Weniger anzeigen' : `${exerciseRows.length - 6} weitere anzeigen`}
            </button>
          )}
          <button
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
            onClick={() => navigate('/exercises')}
          >
            <span className="flex-1 text-sm font-semibold text-cocoa">Alle Übungen</span>
            <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
          </button>
        </div>
      </section>

      {/* Gamification (kompakt, aufklappbar) */}
      <GameSummaryCard
        mascot={game.mascot}
        title={`Level ${game.xp.level} · ${game.rank.title}`}
        progress={game.xp.progress}
        meta={
          <>
            <span>
              {nf(game.xp.xpInLevel)} / {nf(game.xp.xpForLevel)} XP
            </span>
            <span className="flex items-center gap-0.5">
              <Flame size={12} />
              {game.streak} {game.streak === 1 ? 'Woche' : 'Wochen'}
            </span>
            <span className="flex items-center gap-0.5">
              <Target size={12} />
              {game.open === 0 ? 'Alle Quests erledigt' : `${game.open} Quests offen`}
            </span>
          </>
        }
        open={gameToggle.open}
        onToggle={gameToggle.toggle}
      >
        <GamePanel sets={sets} exercises={exercises} />
        <StreakCard sets={sets} />
        <SeasonCard sets={sets} />
        <Heatmap dates={sets.map((s) => s.date)} />
      </GameSummaryCard>

      <AiPanel sets={sets} exercises={exercises} />
    </>
  )
}
