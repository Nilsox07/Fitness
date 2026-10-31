import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Apple,
  BedDouble,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  ScanLine,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { TabHeader } from '../components/ui/TabHeader'
import { Hero, HeroPill } from '../components/health/ui'
import { BuddyTip } from '../components/buddy/BuddyTip'
import { useBuddyLevel } from '../components/buddy/useBuddy'
import { useToday } from '../hooks/useToday'
import { useBodyWeights } from '../hooks/useBodyWeight'
import { usePrefs } from '../lib/prefs'
import { hoursText, kmText } from '../lib/health'

type Row = { id: string; label: string; Icon: LucideIcon; to: string; value?: string | null }

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE')

/**
 * Fortschritt-Übersicht (wie die Zusammenfassung in Apple Health): oben die Woche,
 * darunter eine gruppierte Liste – jede Zeile führt in ihren Bereich. Keine Wisch-Leiste.
 */
export default function Progress() {
  const navigate = useNavigate()
  const { showNutrition, hasWatch } = usePrefs()
  const t = useToday()
  const level = useBuddyLevel()
  const { data: weights } = useBodyWeights()
  const lastWeight = weights?.length ? [...weights].sort((a, b) => b.date.localeCompare(a.date))[0] : null
  const caps = t.caps
  const has = (k: keyof NonNullable<typeof caps>['has']) => !caps?.known || caps.has[k]

  const training: Row[] = [
    {
      id: 'strength',
      label: 'Kraft',
      Icon: Dumbbell,
      to: '/analytics?view=strength',
      value: `${t.weekDone} von ${t.weekGoal} diese Woche`,
    },
    { id: 'history', label: 'Verlauf', Icon: CalendarDays, to: '/history' },
  ]
  const watch: Row[] = hasWatch
    ? [
        {
          id: 'cardio',
          label: 'Ausdauer',
          Icon: Activity,
          to: '/cardio',
          value: t.cardioWeek?.count ? `${kmText(t.cardioWeek.distance_m)} diese Woche` : null,
        },
        ...(has('sleep') || has('hrv')
          ? [
              {
                id: 'sleep',
                label: 'Schlaf & Erholung',
                Icon: BedDouble,
                to: '/sleep',
                value: t.sleep ? hoursText(t.sleep.asleep_min) : null,
              },
            ]
          : []),
        {
          id: 'vitals',
          label: 'Herz & Körper',
          Icon: HeartPulse,
          to: '/vitals',
          value: t.restingHr ? `Ruhepuls ${t.restingHr}` : null,
        },
      ]
    : []
  const body: Row[] = [
    ...(showNutrition
      ? [
          {
            id: 'food',
            label: 'Ernährung',
            Icon: Apple,
            to: '/analytics?view=food',
            value: t.kcalTarget ? `${fmt(t.kcalEaten)} / ${fmt(t.kcalTarget)} kcal` : null,
          },
        ]
      : []),
    {
      id: 'body',
      label: 'Gewicht & Körperfett',
      Icon: ScanLine,
      to: '/body',
      value: lastWeight ? `${lastWeight.weight_kg.toLocaleString('de-DE')} kg` : null,
    },
  ]
  const fun: Row[] = [
    { id: 'badges', label: 'Erfolge & Level', Icon: Trophy, to: '/badges', value: `Level ${level.level}` },
  ]

  const goalPct = t.weekGoal ? Math.min(1, t.weekDone / t.weekGoal) : 0

  return (
    <div className="space-y-5">
      <TabHeader overline="Deine Entwicklung" title="Fortschritt" />

      <Hero overline="Diese Woche" value={`${t.weekDone}/${t.weekGoal}`} unit="Trainings" index={1}>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15 dark:bg-sand-dark/60">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${goalPct * 100}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <HeroPill value={t.streakWeeks} label={t.streakWeeks === 1 ? 'Woche Serie' : 'Wochen Serie'} />
          <HeroPill value={level.level} label="Level" />
          {hasWatch && t.cardioWeek?.count ? (
            <HeroPill value={kmText(t.cardioWeek!.distance_m)} label="Ausdauer" />
          ) : (
            <HeroPill value={t.trainedToday ? '✓' : '–'} label="Heute" />
          )}
        </div>
      </Hero>

      <BuddyTip page="progress" />

      <Section title="Training" rows={training} onGo={navigate} />
      {watch.length > 0 && <Section title="Von deiner Uhr" rows={watch} onGo={navigate} />}
      <Section title="Körper & Ernährung" rows={body} onGo={navigate} />
      <Section title="Motivation" rows={fun} onGo={navigate} />
    </div>
  )
}

function Section({ title, rows, onGo }: { title: string; rows: Row[]; onGo: (to: string) => void }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{title}</h2>
      <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
        {rows.map(({ id, label, Icon, to, value }) => (
          <button
            key={id}
            onClick={() => onGo(to)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-sand/60"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold">{label}</span>
            {value && <span className="tabular max-w-[50%] truncate text-sm text-cocoa-light">{value}</span>}
            <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
          </button>
        ))}
      </div>
    </section>
  )
}
