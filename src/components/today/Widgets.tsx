// Die einzelnen Widgets auf „Heute“. Jedes Widget ist eigenständig und liest
// seine Daten aus useToday() – so lassen sie sich frei anordnen.

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  BedDouble,
  ChevronRight,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Loader2,
  Plus,
  Sparkles,
  Users,
  Watch,
} from 'lucide-react'
import type { TodaySummary } from '../../hooks/useToday'
import { useSetWater } from '../../hooks/useWater'
import { useLeaderboard } from '../../hooks/useSocial'
import { useAuth } from '../../lib/auth'
import { useAllSets } from '../../hooks/useWorkouts'
import { lastSessionStats } from '../../lib/home'
import { dayLabel } from '../../lib/day'
import { ACTIVITY_EMOJI, ACTIVITY_LABEL, durationText, hoursText, kmText, paceText, routePath } from '../../lib/health'
import { shortName } from '../community/communityUtils'
import { QuestStrip } from '../buddy/QuestStrip'
import { SupplementCard } from '../nutrition-home/SupplementCard'
import { BodyWeightCard } from '../BodyWeightCard'
import type { WidgetId } from '../../lib/dashboard'
import { CardioPlanCard } from './CardioPlanCard'
import { useBriefing } from '../buddy/useBriefing'

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE')

/** Grundgerüst: Kopfzeile mit Symbol + Titel, tippbar. */
function Tile({
  icon,
  tint,
  title,
  onClick,
  children,
  right,
}: {
  icon: ReactNode
  tint: string
  title: string
  onClick?: () => void
  children: ReactNode
  right?: ReactNode
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`card flex h-full w-full flex-col gap-2 text-left ${onClick ? 'transition active:scale-[0.98]' : ''}`}
    >
      <span className="flex w-full items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tint}`}>{icon}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-cocoa-light">{title}</span>
        {right ?? (onClick && <ChevronRight size={15} className="shrink-0 text-cocoa-muted" />)}
      </span>
      {children}
    </Tag>
  )
}

/** Ring 0–1 als SVG. */
function Ring({
  value,
  size = 56,
  stroke = 6,
  color = 'rgb(var(--c-ruby))',
  track = 'text-sand-dark/50',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className={track}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  )
}

function ConnectWatch() {
  const navigate = useNavigate()
  return (
    <button
      className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-brand"
      onClick={(e) => {
        e.stopPropagation()
        navigate('/profile?s=modules')
      }}
    >
      <Watch size={15} /> Uhr verbinden
    </button>
  )
}

// ---------- Uhr ----------

function ReadinessWidget({ t }: { t: TodaySummary }) {
  const navigate = useNavigate()
  const brief = useBriefing()
  const r = t.readiness
  const color = 'rgb(var(--c-ruby))'
  return (
    <section className="relative w-full overflow-hidden rounded-3xl bg-cocoa p-5 text-left text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
      <button className="relative block w-full text-left" onClick={() => navigate('/sleep')}>
        <span className="flex items-center justify-between gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
          Tagesform · heute
          <ChevronRight size={15} />
        </span>
        {r ? (
          <div className="mt-2 flex items-center gap-4">
            <Ring value={r.score / 100} size={76} stroke={8} color={color} track="text-white/10 dark:text-sand-dark/50">
              <span className="tabular text-2xl font-bold">{r.score}</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-snug">{r.advice}</p>
              <p className="mt-1 text-xs text-bg/60 dark:text-cocoa-light">
                {r.factors
                  .slice(0, 3)
                  .map((f) => f.label)
                  .join(' · ')}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-[15px] font-semibold">Noch keine Daten</p>
            <p className="text-xs text-bg/60 dark:text-cocoa-light">Uhr beim Schlafen tragen</p>
          </div>
        )}
      </button>
      {r && brief.aiOn && (
        <div className="relative mt-3 border-t border-white/10 pt-3 dark:border-sand-dark/40">
          {brief.text ? (
            <p className="flex gap-2 text-sm leading-snug">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-brand" />
              {brief.text}
            </p>
          ) : (
            <button
              className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand active:scale-95"
              onClick={() => void brief.load()}
              disabled={brief.busy}
            >
              {brief.busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Buddy-Briefing für heute
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function SleepWidget({ t }: { t: TodaySummary }) {
  const navigate = useNavigate()
  const s = t.sleep
  return (
    <Tile
      icon={<BedDouble size={15} />}
      tint="bg-sand text-cocoa-light"
      title="Schlaf"
      onClick={() => navigate('/sleep')}
    >
      {s ? (
        <>
          <span className="tabular text-2xl font-bold leading-none">{hoursText(s.asleep_min)}</span>
          <span className="text-xs text-cocoa-light">
            {s.deep_min != null ? `Tief ${hoursText(s.deep_min)}` : 'letzte Nacht'}
            {s.rem_min != null && ` · REM ${hoursText(s.rem_min)}`}
          </span>
        </>
      ) : (
        <span className="text-sm text-cocoa-light">Noch keine Daten</span>
      )}
    </Tile>
  )
}

function StepsWidget({ t }: { t: TodaySummary }) {
  const goal = 8000
  return (
    <Tile icon={<Footprints size={15} />} tint="bg-sand text-cocoa-light" title="Schritte">
      {t.steps != null ? (
        <span className="flex items-center gap-3">
          <Ring value={t.steps / goal} size={46} stroke={5} color="rgb(var(--c-ruby))" />
          <span>
            <span className="tabular block text-xl font-bold leading-none">{fmt(t.steps)}</span>
            <span className="text-xs text-cocoa-light">von {fmt(goal)}</span>
          </span>
        </span>
      ) : (
        <span className="text-sm text-cocoa-light">Noch keine Daten</span>
      )}
    </Tile>
  )
}

function LastActivityWidget({ t }: { t: TodaySummary }) {
  const navigate = useNavigate()
  const a = t.lastActivity
  if (!a)
    return (
      <Tile icon={<Activity size={15} />} tint="bg-sand text-cocoa-light" title="Letzte Aktivität">
        <span className="text-sm text-cocoa-light">Noch keine Aktivität</span>
        <ConnectWatch />
      </Tile>
    )
  const d = routePath(a.route, 88, 64)
  return (
    <Tile
      icon={<Activity size={15} />}
      tint="bg-sand text-cocoa-light"
      title={`${ACTIVITY_EMOJI[a.type]} ${a.title || ACTIVITY_LABEL[a.type]} · ${dayLabel(a.started_at.slice(0, 10))}`}
      onClick={() => navigate(`/cardio/${a.id}`)}
    >
      <span className="flex w-full items-center gap-3">
        <span className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          <Stat value={kmText(a.distance_m)} label="Distanz" />
          <Stat value={durationText(a.duration_s)} label="Dauer" />
          <Stat value={paceText(a) ?? (a.avg_hr ? `${a.avg_hr} bpm` : '–')} label={paceText(a) ? 'Tempo' : 'Puls'} />
        </span>
        {d && (
          <svg width={88} height={64} className="shrink-0 rounded-xl bg-sand/60">
            <path
              d={d}
              fill="none"
              style={{ stroke: 'rgb(var(--c-ruby))' }}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
    </Tile>
  )
}

function HeartWidget({ t }: { t: TodaySummary }) {
  const navigate = useNavigate()
  return (
    <Tile
      icon={<HeartPulse size={15} />}
      tint="bg-sand text-cocoa-light"
      title="Herz"
      onClick={() => navigate('/vitals')}
    >
      {t.restingHr != null || t.hrv != null ? (
        <>
          <span className="tabular text-2xl font-bold leading-none">
            {t.restingHr ?? '–'} <span className="text-sm font-semibold text-cocoa-light">bpm Ruhe</span>
          </span>
          <span className="text-xs text-cocoa-light">
            {t.hrv != null ? `Erholung (HRV) ${Math.round(t.hrv)} ms` : 'HRV noch nicht gemessen'}
          </span>
        </>
      ) : (
        <span className="text-sm text-cocoa-light">Noch keine Daten</span>
      )}
    </Tile>
  )
}

function CardioWeekWidget({ t }: { t: TodaySummary }) {
  const navigate = useNavigate()
  const w = t.cardioWeek
  return (
    <Tile
      icon={<Activity size={15} />}
      tint="bg-sand text-cocoa-light"
      title="Ausdauer-Woche"
      onClick={() => navigate('/cardio')}
    >
      <span className="tabular text-2xl font-bold leading-none">{w ? kmText(w.distance_m) : '–'}</span>
      <span className="text-xs text-cocoa-light">
        {w?.count ? `${w.count}× · ${durationText(w.duration_s)}` : 'diese Woche noch nichts'}
      </span>
    </Tile>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="min-w-0">
      <span className="tabular block truncate text-[15px] font-bold leading-tight">{value}</span>
      <span className="block text-[11px] text-cocoa-muted">{label}</span>
    </span>
  )
}

// ---------- Training ----------

function NextWorkoutWidget({ t }: { t: TodaySummary }) {
  const navigate = useNavigate()
  const title = t.trainedToday
    ? 'Heute schon trainiert 💪'
    : t.restDay
      ? 'Ruhetag'
      : (t.nextWorkout ?? 'Freies Training')
  const sub = t.trainedToday
    ? 'Stark!'
    : t.restDay
      ? 'Erholung gehört dazu'
      : t.nextWorkout
        ? 'Laut deinem Plan'
        : 'Plan wählen oder loslegen'
  return (
    <button
      onClick={() => navigate('/')}
      className="card flex w-full items-center gap-3 text-left transition active:scale-[0.99]"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-on-brand shadow-lg shadow-brand/25">
        <Dumbbell size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">
          Training heute
        </span>
        <span className="block truncate text-[17px] font-bold">{title}</span>
        <span className="block truncate text-xs text-cocoa-light">{sub}</span>
      </span>
      {!t.trainedToday && !t.restDay && (
        <span className="rounded-full bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand">Start</span>
      )}
    </button>
  )
}

function StreakWidget({ t }: { t: TodaySummary }) {
  return (
    <Tile icon={<Flame size={15} />} tint="bg-sand text-cocoa-light" title="Serie">
      <span className="tabular text-2xl font-bold leading-none">
        {t.streakWeeks}{' '}
        <span className="text-sm font-semibold text-cocoa-light">{t.streakWeeks === 1 ? 'Woche' : 'Wochen'}</span>
      </span>
      <span className="flex gap-1" aria-label={`${t.weekDone} von ${t.weekGoal} Trainings diese Woche`}>
        {Array.from({ length: Math.max(t.weekGoal, t.weekDone) }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < t.weekDone ? 'bg-brand' : 'bg-sand-dark/60'}`} />
        ))}
      </span>
    </Tile>
  )
}

function LastWorkoutWidget({ t }: { t: TodaySummary }) {
  const navigate = useNavigate()
  const { data: allSets } = useAllSets()
  const last = lastSessionStats(allSets ?? [], shiftNext(t.trainingDay))
  return (
    <Tile
      icon={<Dumbbell size={15} />}
      tint="bg-sand text-cocoa-light"
      title="Letztes Training"
      onClick={() => navigate('/history')}
    >
      {last ? (
        <>
          <span className="tabular text-xl font-bold leading-none">{last.sets} Sätze</span>
          <span className="text-xs text-cocoa-light">
            {dayLabel(last.date)}
            {last.prs > 0 && ` · ${last.prs} PR`}
          </span>
        </>
      ) : (
        <span className="text-sm text-cocoa-light">Noch kein Training</span>
      )}
    </Tile>
  )
}

/** lastSessionStats sucht „vor“ einem Datum – heute soll mitzählen. */
function shiftNext(day: string) {
  const d = new Date(day + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

// ---------- Ernährung ----------

function KcalWidget({ t }: { t: TodaySummary }) {
  const navigate = useNavigate()
  const left = t.kcalTarget - t.kcalEaten
  const pct = t.kcalTarget ? t.kcalEaten / t.kcalTarget : 0
  const pPct = t.proteinTarget ? t.proteinEaten / t.proteinTarget : 0
  return (
    <button
      onClick={() => navigate('/nutrition')}
      className="card flex w-full items-center gap-4 text-left transition active:scale-[0.99]"
    >
      <Ring value={pct} size={72} stroke={7} color={pct > 1.05 ? 'rgb(var(--c-gold))' : 'rgb(var(--c-ruby))'}>
        <span className="text-center leading-none">
          <span className="tabular block text-lg font-bold">{fmt(Math.abs(left))}</span>
          <span className="text-[9px] font-semibold text-cocoa-muted">{left >= 0 ? 'übrig' : 'drüber'}</span>
        </span>
      </Ring>
      <span className="min-w-0 flex-1 space-y-2">
        <span className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">Kalorien</span>
          <span className="tabular text-sm font-semibold">
            {fmt(t.kcalEaten)} <span className="font-normal text-cocoa-light">/ {fmt(t.kcalTarget)} kcal</span>
          </span>
        </span>
        <span className="block">
          <span className="flex justify-between text-xs">
            <span className="font-semibold text-cocoa-light">Eiweiß</span>
            <span className="tabular text-cocoa-light">
              {t.proteinEaten} / {t.proteinTarget} g
            </span>
          </span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sand-dark/50">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, pPct * 100)}%` }} />
          </span>
        </span>
      </span>
    </button>
  )
}

function WaterWidget({ t }: { t: TodaySummary }) {
  const setWater = useSetWater()
  return (
    <Tile
      icon={<Droplet size={15} />}
      tint="bg-sand text-cocoa-light"
      title="Wasser"
      right={
        <button
          aria-label="250 ml trinken"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white transition active:scale-90"
          onClick={() => setWater.mutate({ date: t.day, ml: t.waterMl + 250 })}
        >
          <Plus size={16} strokeWidth={3} />
        </button>
      }
    >
      <span className="tabular text-2xl font-bold leading-none">
        {(t.waterMl / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })}
        <span className="text-sm font-semibold text-cocoa-light">
          {' '}
          / {(t.waterTarget / 1000).toLocaleString('de-DE')} l
        </span>
      </span>
      <span className="block h-1.5 overflow-hidden rounded-full bg-sand-dark/50">
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${Math.min(100, (t.waterMl / t.waterTarget) * 100)}%` }}
        />
      </span>
    </Tile>
  )
}

// ---------- Community ----------

function FriendsWidget({ t }: { t: TodaySummary }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data } = useLeaderboard()
  const friends = (data ?? []).filter((f) => f.user_id !== user?.id)
  const active = friends.filter((f) => f.last_workout === t.trainingDay)
  return (
    <Tile
      icon={<Users size={15} />}
      tint="bg-sand text-cocoa-light"
      title="Freunde"
      onClick={() => navigate('/social')}
    >
      {friends.length === 0 ? (
        <span className="text-sm text-cocoa-light">Lade Freunde ein – zusammen bleibt man dran.</span>
      ) : (
        <span className="text-sm">
          {active.length ? (
            <>
              <b>
                {active
                  .map((f) => shortName(f.display_name))
                  .slice(0, 3)
                  .join(', ')}
              </b>
              {active.length > 3 && ` +${active.length - 3}`} {active.length === 1 ? 'war' : 'waren'} heute schon im Gym
              💪
            </>
          ) : (
            <span className="text-cocoa-light">
              Heute war noch keiner deiner {friends.length} Freunde aktiv – sei der Erste!
            </span>
          )}
        </span>
      )}
    </Tile>
  )
}

/** Widget-ID → Inhalt. */
export function renderWidget(id: WidgetId, t: TodaySummary): ReactNode {
  switch (id) {
    case 'readiness':
      return <ReadinessWidget t={t} />
    case 'cardioPlan':
      return <CardioPlanCard />
    case 'nextWorkout':
      return <NextWorkoutWidget t={t} />
    case 'streak':
      return <StreakWidget t={t} />
    case 'kcal':
      return <KcalWidget t={t} />
    case 'water':
      return <WaterWidget t={t} />
    case 'quests':
      return <QuestStrip area="training" />
    case 'sleep':
      return <SleepWidget t={t} />
    case 'steps':
      return <StepsWidget t={t} />
    case 'lastActivity':
      return <LastActivityWidget t={t} />
    case 'heart':
      return <HeartWidget t={t} />
    case 'cardioWeek':
      return <CardioWeekWidget t={t} />
    case 'supplements':
      return <SupplementCard date={t.day} />
    case 'weight':
      return <BodyWeightCard />
    case 'friends':
      return <FriendsWidget t={t} />
    case 'lastWorkout':
      return <LastWorkoutWidget t={t} />
  }
}
