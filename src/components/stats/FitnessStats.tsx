import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Flame, Target, Trophy } from 'lucide-react'
import {
  balanceStats,
  estimate1RM,
  frequencyStats,
  lastTrainedPerMuscle,
  muscleVolume,
  onlyPerformed,
  onlyWorking,
  round1,
  sessionDates,
  setVolume,
  totalVolume,
} from '../../lib/analytics'
import { shiftDate, trainingDay } from '../../lib/day'
import { inRange, pctChange, periodRange, PERIOD_LABELS, type Period } from '../../lib/periods'
import { dailyQuests, weeklyQuests } from '../../lib/xp'
import { rankForSessions } from '../../lib/gamification'
import { weekStreakWithFreezes } from '../../lib/streaks'
import { useStreakState } from '../../hooks/useStreak'
import { GamePanel } from '../GamePanel'
import { StreakCard } from '../StreakCard'
import { MyBuddy } from '../buddy/MyBuddy'
import { BuddyLevelUp } from '../buddy/BuddyLevelUp'
import { useBuddyLevel } from '../buddy/useBuddy'
import { enter } from '../home/motion'
import { ProgressHeader, SectionLabel, Segmented } from '../progress/ProgressHeader'
import { StatsHero } from '../progress/StatsHero'
import { MuscleBalance } from '../progress/MuscleBalance'
import { MiniSpark } from '../progress/Sparklines'
import { GameCard, MetaChip } from '../progress/GameCard'
import { isoWeekNumber, MONTHS_LONG } from '../progress/progressUtils'
import type { Exercise, SetWithDate } from '../../types'
import { nf } from './shared'

/** Bester Wert eines Satzes (bei einseitigen Übungen die stärkere Seite). */
function setBest(s: SetWithDate) {
  const left = { weight: s.weight, reps: s.reps, e1: estimate1RM(s.weight, s.reps) }
  if (s.weight_right == null || s.reps_right == null) return left
  const right = { weight: s.weight_right, reps: s.reps_right, e1: estimate1RM(s.weight_right, s.reps_right) }
  return right.e1 > left.e1 ? right : left
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const COMPARE: Record<Period, string> = { week: 'Vorwoche', month: 'Vormonat', year: 'Vorjahr' }

/** Anzahl Tage von a bis b (inkl.). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000) + 1
}

interface ExerciseRow {
  id: string
  name: string
  sessions: number
  best: { weight: number; reps: number; e1: number }
  pr: boolean
  count: number
  /** bester Satz je Session (chronologisch, letzte 8) */
  trend: number[]
}

export function FitnessStats({ sets: allSets, exercises }: { sets: SetWithDate[]; exercises: Exercise[] }) {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('month')
  // „Heute" = Trainings-Tag (Wechsel um 4 Uhr, wie im Training)
  const today = trainingDay()
  // Nur ausgeführte Sätze — leere Vorlagen-Sätze (0 Wdh) zählen nirgends.
  const sets = useMemo(() => onlyPerformed(allSets), [allSets])

  const range = useMemo(() => periodRange(period, today), [period, today])
  const cur = useMemo(() => sets.filter((s) => inRange(s.date, range.start, range.end)), [sets, range])
  const prev = useMemo(
    () => sets.filter((s) => inRange(s.date, range.prevStart, range.prevEnd)),
    [sets, range],
  )

  const kpi = useMemo(() => {
    const sessions = (list: SetWithDate[]) => new Set(list.map((s) => s.date)).size
    const c = { sessions: sessions(cur), volume: totalVolume(cur), sets: onlyWorking(cur).length }
    const p = { volume: totalVolume(prev) }
    return { c, volumeTrend: pctChange(c.volume, p.volume) }
  }, [cur, prev])

  // Kumulierte Volumen-Kurve: laufender Zeitraum bis heute vs. ganzer Vorzeitraum
  const spark = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const s of sets) byDay.set(s.date, (byDay.get(s.date) ?? 0) + setVolume(s))
    const cumulative = (start: string, days: number) => {
      const out: number[] = []
      let acc = 0
      for (let i = 0; i < days; i++) {
        acc += byDay.get(shiftDate(start, i)) ?? 0
        out.push(acc)
      }
      return out
    }
    const length = daysBetween(range.start, range.periodEnd)
    const values = cumulative(range.start, daysBetween(range.start, range.end))
    const ghost = cumulative(range.prevStart, Math.min(length, daysBetween(range.prevStart, shiftDate(range.start, -1))))
    return { length, values, ghost }
  }, [sets, range])

  const [, sm, sd] = range.start.split('-').map(Number)
  const [, em, ed] = range.periodEnd.split('-').map(Number)
  const periodName =
    period === 'week'
      ? `KW ${isoWeekNumber(range.start)}`
      : period === 'month'
        ? MONTHS_LONG[sm - 1]
        : range.start.slice(0, 4)
  const axis: [string, string] =
    period === 'week'
      ? ['Mo', 'So']
      : period === 'month'
        ? [`${sd}. ${MONTHS_SHORT[sm - 1]}`, `${ed}. ${MONTHS_SHORT[em - 1]}`]
        : ['Jan', 'Dez']

  const balance = useMemo(() => balanceStats(cur, exercises), [cur, exercises])
  const byMuscle = useMemo(() => muscleVolume(cur, exercises).filter((m) => m.value > 0), [cur, exercises])
  const stale = useMemo(
    () => lastTrainedPerMuscle(sets, exercises).filter((r) => r.daysAgo >= 5).slice(0, 3),
    [sets, exercises],
  )

  const exerciseRows = useMemo<ExerciseRow[]>(() => {
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const acc = new Map<
      string,
      { dates: Set<string>; count: number; best: ExerciseRow['best']; before: number; perDay: Map<string, number> }
    >()
    for (const s of onlyWorking(sets)) {
      if (s.date > range.end) continue
      const b = setBest(s)
      const row = acc.get(s.exercise_id) ?? {
        dates: new Set<string>(),
        count: 0,
        best: { weight: 0, reps: 0, e1: -1 },
        before: 0,
        perDay: new Map<string, number>(),
      }
      // Kurve: bestes 1RM je Session (Körpergewicht: Wdh)
      const metric = b.e1 > 0 ? b.e1 : b.reps
      row.perDay.set(s.date, Math.max(row.perDay.get(s.date) ?? 0, metric))
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
        trend: [...r.perDay.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-8)
          .map(([, v]) => v),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [sets, exercises, range])
  const [showAllEx, setShowAllEx] = useState(false)
  const visibleRows = showAllEx ? exerciseRows : exerciseRows.slice(0, 6)
  const prCount = exerciseRows.filter((r) => r.pr).length

  // Gamification-Zusammenfassung — ein Level für alles (Buddy-Level).
  const { data: streakState } = useStreakState()
  const buddyLevel = useBuddyLevel()
  const game = useMemo(() => {
    const dates = sessionDates(sets)
    const freq = frequencyStats(dates)
    const quests = [...dailyQuests(sets, today), ...weeklyQuests(sets, today)]
    return {
      rank: rankForSessions(freq.totalSessions),
      streak: weekStreakWithFreezes(dates, streakState?.frozen_weeks ?? []),
      open: quests.filter((q) => !q.done).length,
    }
  }, [sets, today, streakState])
  const [gameOpen, setGameOpen] = useState(false)

  return (
    <>
      <ProgressHeader
        title="Fortschritt"
        subtitle={`${periodName} · ${nf(kpi.c.sessions)} ${kpi.c.sessions === 1 ? 'Training' : 'Trainings'}`}
        action={
          <Segmented
            label="Zeitraum"
            value={period}
            onChange={setPeriod}
            options={(Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
          />
        }
      />

      <StatsHero
        label={periodName}
        volumeKg={kpi.c.volume}
        trend={kpi.volumeTrend}
        compare={COMPARE[period]}
        spark={spark.values}
        ghost={spark.ghost}
        length={spark.length}
        axis={axis}
        sessions={kpi.c.sessions}
        sets={kpi.c.sets}
        prs={prCount}
        index={1}
      />

      <MuscleBalance
        muscles={byMuscle}
        push={balance.push}
        pull={balance.pull}
        upper={balance.upper}
        lower={balance.lower}
        stale={stale}
        index={2}
      />

      {/* Übungen */}
      <section style={enter(3)}>
        <SectionLabel
          right={
            prCount > 0 && (
              <span className="tabular flex items-center gap-1 text-xs font-semibold text-gold">
                <Trophy size={13} strokeWidth={2.5} />
                {prCount} {prCount === 1 ? 'Rekord' : 'Rekorde'}
              </span>
            )
          }
        >
          Übungen
        </SectionLabel>
        <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
          {exerciseRows.length === 0 && (
            <p className="px-4 py-3 text-sm text-cocoa-light">In diesem Zeitraum noch keine Arbeitssätze.</p>
          )}
          {visibleRows.map((r) => (
            <button
              key={r.id}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-sand/60"
              onClick={() => navigate(`/exercises/${r.id}`)}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-cocoa">{r.name}</span>
                  {r.pr && <Trophy size={14} strokeWidth={2.5} className="shrink-0 text-gold" aria-label="Neuer Rekord" />}
                </span>
                <span className="tabular block truncate text-xs text-cocoa-light">
                  {r.best.weight > 0 ? (
                    <>
                      <span className="font-semibold text-cocoa">
                        {nf(r.best.weight, 1)} kg × {r.best.reps}
                      </span>
                      {' · '}1RM ≈ {nf(round1(r.best.e1), 1)} kg
                    </>
                  ) : (
                    <span className="font-semibold text-cocoa">{r.best.reps} Wdh.</span>
                  )}
                  <span className="text-cocoa-muted"> · {r.sessions}×</span>
                </span>
              </span>
              <MiniSpark values={r.trend} highlight={r.pr} />
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

      {/* Gamification (kompakt, aufklappbar) — Buddy-Level + Quests */}
      <GameCard
        style={enter(4)}
        buddy={<MyBuddy size={44} mood="happy" animate={false} />}
        banner={<BuddyLevelUp />}
        title={`Buddy-Level ${buddyLevel.level}`}
        subtitle={`${game.rank.title} · ${nf(buddyLevel.xpInLevel)} / ${nf(buddyLevel.xpForLevel)} XP`}
        progress={buddyLevel.progress}
        meta={
          <>
            <MetaChip>
              <Flame size={12} className="text-brand" />
              {game.streak} {game.streak === 1 ? 'Woche' : 'Wochen'}
            </MetaChip>
            <MetaChip>
              <Target size={12} className={game.open === 0 ? 'text-success' : 'text-cocoa-muted'} />
              {game.open === 0 ? 'Quests erledigt' : `${game.open} Quests offen`}
            </MetaChip>
          </>
        }
        open={gameOpen}
        onToggle={() => setGameOpen((o) => !o)}
      >
        <GamePanel sets={sets} exercises={exercises} compact />
        <StreakCard sets={sets} />
      </GameCard>
    </>
  )
}
