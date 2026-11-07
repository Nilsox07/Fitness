import type { ReactNode } from 'react'
import { useMounted } from '../components/ui/CountUp'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Apple,
  BedDouble,
  CalendarDays,
  Droplet,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  NotebookPen,
  Scale,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
  Trophy,
} from 'lucide-react'
import { useBuddyLevel } from '../components/buddy/useBuddy'
import { TabHeader } from '../components/ui/TabHeader'
import { BuddyLine, HeroWithBuddy } from '../components/home/HeroBuddy'
import { useHeroBuddy } from '../components/home/useHeroBuddy'
import { enter } from '../components/home/motion'
import { useToday } from '../hooks/useToday'
import { useCycleState } from '../hooks/useCycle'
import { useBodyWeights } from '../hooks/useBodyWeight'
import { useAllSets } from '../hooks/useWorkouts'
import { useHealthActivities, useHealthDaily, useHealthSleep } from '../hooks/useHealth'
import { useAllFoodEntries } from '../hooks/useNutrition'
import { useInsights } from '../hooks/useInsights'
import { topInsights } from '../lib/insights'
import { InsightList } from '../components/insights/InsightList'
import { SectionLabel } from '../components/progress/ProgressHeader'
import { usePrefs } from '../lib/prefs'
import { hoursText } from '../lib/health'
import { isPerformed, setVolume } from '../lib/analytics'
import { dailySeries, lastWeeks, trendPct, weeklySum } from '../lib/progressSeries'
import { useGoalPath } from '../hooks/useGoalPath'
import { goalPathLine } from '../lib/goalPath'
import { useJournal } from '../hooks/useJournal'
import { useJournalImpacts } from '../hooks/useRecovery'
import { habitLabel } from '../lib/journal'
import { impactLine } from '../components/journal/HabitImpactList'

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE')
const tons = (kg: number) =>
  kg >= 1000 ? `${(kg / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} t` : `${fmt(kg)} kg`

/**
 * Fortschritt-Übersicht wie Apple Health / Whoop: Kacheln mit großer Zahl und kleinem Verlauf,
 * jede führt zu ihren Details. Uhr- und Ernährungs-Kacheln nur mit Modul; fehlende Werte → Kachel weg.
 */
export default function Progress() {
  const navigate = useNavigate()
  const { showNutrition, hasWatch, hasCycle } = usePrefs()
  const { data: journal = [] } = useJournal()
  const journalDays = journal.filter((e) => e.tags.length || e.feel != null).length
  const journalTop = useJournalImpacts().impacts.find((h) => h.status === 'ready' && h.main)
  const cycle = useCycleState()
  const t = useToday()
  const heroBuddy = useHeroBuddy('progress')
  const level = useBuddyLevel()
  const { data: weights } = useBodyWeights()
  const goalLine = goalPathLine(useGoalPath())
  const { data: allSets } = useAllSets()
  const { data: acts } = useHealthActivities(60)
  const { data: sleep } = useHealthSleep(14)
  const { data: daily } = useHealthDaily(14)
  const { data: food } = useAllFoodEntries()
  const top = topInsights(useInsights().insights)

  const today = t.trainingDay
  const weeks = lastWeeks(today, 8)
  const performed = (allSets ?? []).filter((s) => isPerformed(s))
  const volume = weeklySum(
    performed.map((s) => ({ date: s.date, value: setVolume(s) })),
    weeks,
  )
  const sessions = weeklySum(
    [...new Set(performed.map((s) => s.date))].map((date) => ({ date, value: 1 })),
    weeks,
  )
  const km = weeklySum(
    (acts ?? []).map((a) => ({ date: a.started_at.slice(0, 10), value: (a.distance_m ?? 0) / 1000 })),
    weeks,
  )
  const sleepSeries = dailySeries(
    (sleep ?? []).map((s) => ({ date: s.date, value: s.asleep_min })),
    t.day,
    7,
  )
  const rhrSeries = dailySeries(
    (daily ?? []).filter((d) => d.resting_hr != null).map((d) => ({ date: d.date, value: d.resting_hr! })),
    t.day,
    14,
  )
  const kcalSeries = dailySeries(
    (food ?? []).map((e) => ({ date: e.date, value: e.kcal })),
    t.day,
    7,
  )
  const sortedW = [...(weights ?? [])].sort((a, b) => a.date.localeCompare(b.date)).slice(-12)
  const lastW = sortedW[sortedW.length - 1]
  const firstW = sortedW[0]
  const wDelta =
    lastW && firstW && sortedW.length > 1 ? Math.round((lastW.weight_kg - firstW.weight_kg) * 10) / 10 : null

  const caps = t.caps
  const has = (k: keyof NonNullable<typeof caps>['has']) => !caps?.known || caps.has[k]
  const lastSleep = sleepSeries[sleepSeries.length - 1]
  const lastRhr = [...rhrSeries].reverse().find((v) => v != null) ?? null
  const goalPct = t.weekGoal ? Math.min(1, t.weekDone / t.weekGoal) : 0
  const volTrend = trendPct(volume.slice(-4))
  let i = 1

  return (
    <div className="space-y-4">
      <TabHeader overline="Deine Entwicklung" title="Fortschritt" />

      {/* Woche: Ring + Serie + Level – Buddy sitzt auf der Karte, sein Spruch oben */}
      <div style={enter(i++)}>
        <HeroWithBuddy buddy={heroBuddy}>
          <section className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
            <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
            <div className="relative">
              <BuddyLine line={heroBuddy.line} tone="dark" onClick={heroBuddy.onLine} />
            </div>
            <div className="relative flex items-center gap-5">
              <Ring pct={goalPct} size={104}>
                <span className="tabular text-3xl font-bold leading-none">
                  {t.weekDone}
                  <span className="text-base text-bg/50 dark:text-cocoa-light">/{t.weekGoal}</span>
                </span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
                  Woche
                </span>
              </Ring>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="tabular text-2xl font-bold leading-none">{t.streakWeeks}</p>
                  <p className="text-xs text-bg/60 dark:text-cocoa-light">
                    {t.streakWeeks === 1 ? 'Woche Serie' : 'Wochen Serie'}
                  </p>
                </div>
                <button className="flex items-center gap-2 text-left" onClick={() => navigate('/badges')}>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-bg/10 dark:bg-white/5">
                    <Trophy size={16} />
                  </span>
                  <span>
                    <span className="tabular block text-sm font-bold leading-none">Level {level.level}</span>
                    <span className="block text-[11px] text-bg/60 dark:text-cocoa-light">Erfolge ansehen</span>
                  </span>
                </button>
              </div>
            </div>
          </section>
        </HeroWithBuddy>
      </div>

      {/* Kraft – große Kachel */}
      <Tile
        icon={Dumbbell}
        label="Kraft"
        onClick={() => navigate('/analytics?view=strength')}
        index={i++}
        wide
        value={tons(volume[volume.length - 1])}
        sub={volTrend != null ? <Trend pct={volTrend} /> : 'Volumen diese Woche'}
      >
        <Bars values={volume} />
        <p className="mt-1 flex justify-between text-[10px] text-cocoa-muted">
          <span>vor 8 Wochen</span>
          <span>diese Woche · {sessions[sessions.length - 1]} Trainings</span>
        </p>
      </Tile>

      <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
        {hasWatch && (
          <Tile
            icon={Activity}
            label="Ausdauer"
            onClick={() => navigate('/cardio')}
            index={i++}
            value={`${km[km.length - 1].toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`}
            sub="diese Woche"
          >
            <Bars values={km} small />
          </Tile>
        )}
        {hasWatch && (has('sleep') || has('hrv')) && lastSleep != null && (
          <Tile
            icon={BedDouble}
            label="Schlaf"
            onClick={() => navigate('/sleep')}
            index={i++}
            value={lastSleep != null ? hoursText(lastSleep) : '–'}
            sub={t.readiness ? `Tagesform ${t.readiness.score}` : 'letzte Nacht'}
          >
            <Bars values={sleepSeries.map((v) => v ?? 0)} small />
          </Tile>
        )}
        {hasWatch && lastRhr != null && (
          <Tile
            icon={HeartPulse}
            label="Herz"
            onClick={() => navigate('/vitals')}
            index={i++}
            value={lastRhr != null ? `${lastRhr}` : '–'}
            unit={lastRhr != null ? 'bpm' : undefined}
            sub="Ruhepuls"
          >
            <Line values={rhrSeries} />
          </Tile>
        )}
        {showNutrition && (
          <Tile
            icon={Apple}
            label="Ernährung"
            onClick={() => navigate('/analytics?view=food')}
            index={i++}
            value={fmt(t.kcalEaten)}
            unit="kcal"
            sub={t.kcalTarget ? `Ziel ${fmt(t.kcalTarget)}` : 'heute'}
          >
            <Bars values={kcalSeries.map((v) => v ?? 0)} small target={t.kcalTarget || undefined} />
          </Tile>
        )}
        {hasCycle && (
          <Tile
            icon={Droplet}
            label="Zyklus"
            onClick={() => navigate('/cycle')}
            index={i++}
            value={cycle ? `Tag ${cycle.day}` : 'Eintragen'}
            sub={
              cycle
                ? cycle.onPeriod
                  ? 'Periode'
                  : `Periode in ${Math.max(0, cycle.daysUntilNext)} T.`
                : 'Periode & Phase'
            }
          >
            {cycle && <CycleBar day={cycle.day} length={cycle.length} period={cycle.periodLength} />}
          </Tile>
        )}
        <Tile
          icon={Scale}
          label="Gewicht"
          onClick={() => navigate('/body')}
          index={i++}
          value={lastW ? lastW.weight_kg.toLocaleString('de-DE') : '–'}
          unit={lastW ? 'kg' : undefined}
          sub={
            goalLine ??
            (wDelta != null ? `${wDelta > 0 ? '+' : ''}${wDelta.toLocaleString('de-DE')} kg` : 'Gewicht & Körperfett')
          }
        >
          <Line values={sortedW.map((w) => w.weight_kg)} />
        </Tile>
        <Tile
          icon={CalendarDays}
          label="Verlauf"
          onClick={() => navigate('/history?view=training')}
          index={i++}
          value={`${sessions.reduce((a, b) => a + b, 0)}`}
          sub="Trainings in 8 Wochen"
        >
          <Bars values={sessions} small />
        </Tile>
        <Tile
          icon={NotebookPen}
          label="Journal"
          onClick={() => navigate('/journal')}
          index={i++}
          value={journalDays > 0 ? `${journalDays}` : 'Eintragen'}
          unit={journalDays > 0 ? (journalDays === 1 ? 'Tag' : 'Tage') : undefined}
          sub={journalTop ? `${habitLabel(journalTop.habit)}: ${impactLine(journalTop)}` : 'Gewohnheiten & Schlaf'}
        />
      </div>

      {top.length > 0 && (
        <section style={enter(i++)}>
          <SectionLabel
            right={
              <button
                className="flex items-center text-xs font-semibold text-brand"
                onClick={() => navigate('/insights')}
              >
                Alle Erkenntnisse <ChevronRight size={14} />
              </button>
            }
          >
            Erkenntnisse
          </SectionLabel>
          <InsightList items={top} />
        </section>
      )}
    </div>
  )
}

// ---------- Bausteine ----------

function Tile({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  children,
  onClick,
  wide,
  index,
}: {
  icon: LucideIcon
  label: string
  value: string
  unit?: string
  sub?: ReactNode
  children?: ReactNode
  onClick: () => void
  wide?: boolean
  index: number
}) {
  return (
    <button
      onClick={onClick}
      style={enter(index)}
      className={`card flex w-full flex-col gap-1 text-left transition active:scale-[0.98] ${wide ? '' : 'min-h-[9.5rem]'}`}
    >
      <span className="flex w-full items-center gap-1.5 text-[13px] font-semibold text-cocoa-light">
        <Icon size={15} className="shrink-0 text-brand" />
        <span className="flex-1 truncate">{label}</span>
        <ChevronRight size={15} className="shrink-0 text-cocoa-muted" />
      </span>
      <span className="flex items-baseline gap-1">
        <span className={`tabular font-bold leading-tight ${wide ? 'text-3xl' : 'text-2xl'}`}>{value}</span>
        {unit && <span className="text-sm font-semibold text-cocoa-light">{unit}</span>}
      </span>
      {sub && <span className="truncate text-xs text-cocoa-light">{sub}</span>}
      <span className="mt-auto block w-full pt-2">{children}</span>
    </button>
  )
}

function Trend({ pct }: { pct: number }) {
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-brand">
      <Icon size={13} /> {up ? '+' : ''}
      {pct} % zum Schnitt
    </span>
  )
}

/** Balken; der letzte (aktuelle) kräftig, die anderen blass. */
function Bars({ values, small, target }: { values: number[]; small?: boolean; target?: number }) {
  const h = small ? 34 : 56
  const max = Math.max(1, target ?? 0, ...values)
  const mounted = useMounted()
  return (
    <span className="relative flex w-full items-end gap-1" style={{ height: h }}>
      {target != null && (
        <span
          className="absolute inset-x-0 border-t border-dashed border-cocoa-muted/50"
          style={{ bottom: (target / max) * h }}
        />
      )}
      {values.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-t-[4px] ${i === values.length - 1 ? 'bg-brand' : 'bg-brand/25'}`}
          style={{
            height: mounted ? Math.max(v > 0 ? 3 : 2, (v / max) * h) : 2,
            transition: `height .6s cubic-bezier(.2,.8,.2,1) ${i * 40}ms`,
          }}
        />
      ))}
    </span>
  )
}

/** Linie mit Punkt am letzten Wert; Lücken werden übersprungen. */
function Line({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
  const w = 120
  const h = 34
  if (pts.length < 2) return <span className="block h-[34px]" />
  const min = Math.min(...pts.map((p) => p.v))
  const max = Math.max(...pts.map((p) => p.v))
  const span = max - min || 1
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 6) + 3
  const y = (v: number) => h - 4 - ((v - min) / span) * (h - 8)
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[34px] w-full" preserveAspectRatio="none" aria-hidden>
      <path
        d={d}
        fill="none"
        style={{ stroke: 'rgb(var(--c-ruby))' }}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(last.i)} cy={y(last.v)} r={3} style={{ fill: 'rgb(var(--c-ruby))' }} />
    </svg>
  )
}

function Ring({ pct, size, children }: { pct: number; size: number; children: ReactNode }) {
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const mounted = useMounted()
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-white/10 dark:stroke-sand-dark/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (mounted ? pct : 0))}
          style={{ stroke: 'rgb(var(--c-ruby))', transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <span className="relative flex flex-col items-center">{children}</span>
    </span>
  )
}

/** Zyklus als Leiste: Periode (kräftig), Rest blass, Markierung = heute. */
function CycleBar({ day, length, period }: { day: number; length: number; period: number }) {
  return (
    <span className="relative flex h-[34px] w-full items-center">
      <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-brand/15">
        <span className="h-full bg-brand" style={{ width: `${(period / length) * 100}%` }} />
      </span>
      <span
        className="absolute h-5 w-1.5 -translate-x-1/2 rounded-full bg-cocoa ring-2 ring-cream"
        style={{ left: `${Math.min(100, (day / length) * 100)}%` }}
      />
    </span>
  )
}
