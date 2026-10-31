import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { enter } from '../components/home/motion'
import { ProgressHeader, SectionLabel } from '../components/progress/ProgressHeader'
import { Group, GroupRow, Hero, HeroPill, IconBox, ruby } from '../components/health/ui'
import { useHealthActivities } from '../hooks/useHealth'
import { localDate, shiftDate, dayLabel } from '../lib/day'
import { weekDates } from '../lib/home'
import {
  ACTIVITY_EMOJI,
  ACTIVITY_LABEL,
  activityBests,
  cardioSummary,
  durationText,
  kmText,
  paceText,
  routePath,
} from '../lib/health'
import type { ActivityType, HealthActivity } from '../types'

const km = (m: number) => (m / 1000).toLocaleString('de-DE', { maximumFractionDigits: m >= 10000 ? 1 : 2 })

/** Fortschritt → Ausdauer: Läufe, Radtouren & Co. von der Uhr. */
export default function Cardio() {
  const { data: list = [], isLoading } = useHealthActivities(365)
  const [type, setType] = useState<ActivityType | 'all'>('all')
  const navigate = useNavigate()
  const today = localDate()
  const week = weekDates(today)
  const types = useMemo(() => [...new Set(list.map((a) => a.type))], [list])
  const shown = type === 'all' ? list : list.filter((a) => a.type === type)
  const thisWeek = cardioSummary(shown, week[0], week[6])
  const lastWeek = cardioSummary(shown, shiftDate(week[0], -7), shiftDate(week[6], -7))
  const month = cardioSummary(shown, shiftDate(today, -29), today)
  const bests = type !== 'all' ? activityBests(list, type) : null

  // Kilometer der letzten 8 Wochen
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = shiftDate(week[0], -7 * (7 - i))
    const w = cardioSummary(shown, from, shiftDate(from, 6))
    return { from, km: w.distance_m / 1000 }
  })
  const maxKm = Math.max(1, ...weeks.map((w) => w.km))
  const trend =
    lastWeek.distance_m > 0
      ? Math.round(((thisWeek.distance_m - lastWeek.distance_m) / lastWeek.distance_m) * 100)
      : null

  return (
    <div className="space-y-5">
      <ProgressHeader title="Fortschritt" subtitle="Ausdauer · von deiner Uhr" />

      {types.length > 1 && (
        <div className="flex gap-1 overflow-x-auto rounded-full bg-sand p-1 [scrollbar-width:none]" style={enter(1)}>
          {(['all', ...types] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                type === t ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
              }`}
            >
              {t === 'all' ? 'Alle' : ACTIVITY_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      <Hero
        overline="Strecke · diese Woche"
        value={km(thisWeek.distance_m)}
        unit="km"
        right={
          trend != null && (
            <span
              className={`tabular rounded-full px-2 py-0.5 text-xs font-semibold ${
                trend > 0 ? 'bg-good/20 text-good' : 'bg-bg/10 text-bg/70 dark:bg-white/5 dark:text-cocoa-light'
              }`}
            >
              {trend > 0 ? '+' : ''}
              {trend} % zur Vorwoche
            </span>
          )
        }
      >
        <div className="mt-3 flex h-16 items-end gap-1.5" aria-label="Kilometer pro Woche">
          {weeks.map((w, i) => (
            <div
              key={w.from}
              className="flex-1 rounded-md"
              style={{ height: `${Math.max(4, (w.km / maxKm) * 64)}px`, background: ruby(i === 7 ? 1 : 0.35) }}
              title={`${w.km.toFixed(1)} km`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-bg/45 dark:text-cocoa-muted">
          <span>vor 8 Wochen</span>
          <span>diese Woche</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <HeroPill value={thisWeek.count} label={thisWeek.count === 1 ? 'Einheit' : 'Einheiten'} />
          <HeroPill value={durationText(thisWeek.duration_s)} label="Zeit" />
          <HeroPill value={`${km(month.distance_m)} km`} label="30 Tage" />
        </div>
      </Hero>

      {bests && (
        <section style={enter(2)}>
          <SectionLabel>Bestwerte · {ACTIVITY_LABEL[type as ActivityType]}</SectionLabel>
          <Group>
            <GroupRow
              leading={
                <IconBox>
                  <Trophy size={18} className="text-gold" />
                </IconBox>
              }
              title={`Längste: ${kmText(bests.longest.distance_m)}`}
              sub={dayLabel(bests.longest.started_at.slice(0, 10))}
              onClick={() => navigate(`/cardio/${bests.longest.id}`)}
            />
            {bests.fastest && (
              <GroupRow
                leading={
                  <IconBox>
                    <Trophy size={18} className="text-gold" />
                  </IconBox>
                }
                title={`Schnellste: ${paceText(bests.fastest)}`}
                sub={`${kmText(bests.fastest.distance_m)} · ${dayLabel(bests.fastest.started_at.slice(0, 10))}`}
                onClick={() => navigate(`/cardio/${bests.fastest!.id}`)}
              />
            )}
          </Group>
        </section>
      )}

      <section style={enter(3)}>
        <SectionLabel>Aktivitäten</SectionLabel>
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-sand" />
        ) : shown.length === 0 ? (
          <p className="card text-sm text-cocoa-light">
            Noch keine Aktivitäten. Sobald deine Uhr einen Lauf oder eine Radtour an Health Connect gibt, taucht sie
            hier auf.
          </p>
        ) : (
          <Group>
            {shown.slice(0, 60).map((a) => (
              <ActivityRow key={a.id} a={a} onOpen={() => navigate(`/cardio/${a.id}`)} />
            ))}
          </Group>
        )}
      </section>
    </div>
  )
}

function ActivityRow({ a, onOpen }: { a: HealthActivity; onOpen: () => void }) {
  const d = routePath(a.route, 40, 40, 5)
  return (
    <GroupRow
      onClick={onOpen}
      leading={
        <IconBox>
          {d ? (
            <svg width={40} height={40}>
              <path
                d={d}
                fill="none"
                style={{ stroke: ruby() }}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <span className="text-lg">{ACTIVITY_EMOJI[a.type]}</span>
          )}
        </IconBox>
      }
      title={a.title || ACTIVITY_LABEL[a.type]}
      sub={
        <span className="tabular">
          {[dayLabel(a.started_at.slice(0, 10)), a.distance_m ? kmText(a.distance_m) : null, durationText(a.duration_s)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      }
      right={
        <span className="shrink-0 text-right">
          {paceText(a) && <span className="tabular block text-sm font-semibold">{paceText(a)}</span>}
          {a.avg_hr && <span className="tabular block text-xs text-cocoa-muted">Ø {a.avg_hr} bpm</span>}
        </span>
      }
    />
  )
}
