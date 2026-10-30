import { useMemo, useState } from 'react'
import { Activity, Heart, Mountain, Timer, Trophy, X } from 'lucide-react'
import { enter } from '../components/home/motion'
import { useHealthActivities } from '../hooks/useHealth'
import { localDate, shiftDate, dayLabel } from '../lib/day'
import { weekDates } from '../lib/home'
import {
  ACTIVITY_EMOJI,
  ACTIVITY_LABEL,
  activityBests,
  cardioSummary,
  durationText,
  hrZone,
  kmText,
  paceText,
  routePath,
} from '../lib/health'
import type { ActivityType, HealthActivity } from '../types'

const ZONE_COLOR = ['', '#94a3b8', '#22c55e', '#f2b705', '#f97316', '#ef4444']
const ZONE_LABEL = ['', 'Locker', 'Grundlage', 'Tempo', 'Schwelle', 'Maximum']

/** Fortschritt → Ausdauer: Läufe, Radtouren & Co. von der Uhr. */
export default function Cardio() {
  const { data: list = [], isLoading } = useHealthActivities(365)
  const [type, setType] = useState<ActivityType | 'all'>('all')
  const [open, setOpen] = useState<HealthActivity | null>(null)
  const today = localDate()
  const week = weekDates(today)
  const types = useMemo(() => [...new Set(list.map((a) => a.type))], [list])
  const shown = type === 'all' ? list : list.filter((a) => a.type === type)
  const thisWeek = cardioSummary(shown, week[0], week[6])
  const lastWeek = cardioSummary(shown, shiftDate(week[0], -7), shiftDate(week[6], -7))
  const month = cardioSummary(shown, shiftDate(today, -29), today)
  const bests = type !== 'all' ? activityBests(list, type) : null

  // Kilometer der letzten 8 Wochen für das Balkendiagramm
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = shiftDate(week[0], -7 * (7 - i))
    const w = cardioSummary(shown, from, shiftDate(from, 6))
    return { from, km: w.distance_m / 1000, min: w.duration_s / 60 }
  })
  const maxKm = Math.max(1, ...weeks.map((w) => w.km))

  return (
    <div className="space-y-4">
      <h1 className="text-[28px] font-bold leading-tight" style={enter(0)}>
        Ausdauer
      </h1>
      {types.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" style={enter(0)}>
          {(['all', ...types] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${type === t ? 'bg-cocoa text-bg' : 'bg-sand'}`}
            >
              {t === 'all' ? 'Alle' : `${ACTIVITY_EMOJI[t]} ${ACTIVITY_LABEL[t]}`}
            </button>
          ))}
        </div>
      )}

      <section className="card space-y-3" style={enter(1)}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">Diese Woche</div>
            <div className="tabular text-3xl font-black">{kmText(thisWeek.distance_m)}</div>
            <div className="text-sm text-cocoa-light">
              {thisWeek.count}× · {durationText(thisWeek.duration_s)}
              {lastWeek.distance_m > 0 && (
                <span className={thisWeek.distance_m >= lastWeek.distance_m ? 'text-success' : ''}>
                  {' '}
                  · Vorwoche {kmText(lastWeek.distance_m)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-cocoa-light">
            30 Tage
            <div className="tabular text-base font-bold text-cocoa">{kmText(month.distance_m)}</div>
          </div>
        </div>
        <div className="flex h-24 items-end gap-1.5" aria-label="Kilometer pro Woche">
          {weeks.map((w, i) => (
            <div key={w.from} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-md ${i === 7 ? 'bg-orange-500' : 'bg-orange-500/30'}`}
                style={{ height: `${Math.max(4, (w.km / maxKm) * 80)}px` }}
                title={`${w.km.toFixed(1)} km`}
              />
              <span className="text-[9px] text-cocoa-muted">{Number(w.from.slice(8))}.</span>
            </div>
          ))}
        </div>
      </section>

      {bests && (
        <section className="grid grid-cols-2 gap-3" style={enter(2)}>
          <div className="card">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cocoa-light">
              <Trophy size={14} className="text-gold" /> Längste
            </div>
            <div className="tabular text-xl font-black">{kmText(bests.longest.distance_m)}</div>
            <div className="text-xs text-cocoa-muted">{dayLabel(bests.longest.started_at.slice(0, 10))}</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cocoa-light">
              <Trophy size={14} className="text-gold" /> Schnellste
            </div>
            <div className="tabular text-xl font-black">{bests.fastest ? paceText(bests.fastest) : '–'}</div>
            <div className="text-xs text-cocoa-muted">
              {bests.fastest
                ? `${kmText(bests.fastest.distance_m)} · ${dayLabel(bests.fastest.started_at.slice(0, 10))}`
                : 'ab 3 km'}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-2" style={enter(3)}>
        <h2 className="px-1 text-sm font-semibold text-cocoa-light">Aktivitäten</h2>
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-3xl bg-sand" />
        ) : shown.length === 0 ? (
          <div className="card text-center text-sm text-cocoa-light">
            <Activity className="mx-auto mb-2 text-orange-500" />
            Noch keine Aktivitäten. Sobald deine Uhr einen Lauf oder eine Radtour an Health Connect gibt, taucht sie
            hier auf.
          </div>
        ) : (
          shown.slice(0, 60).map((a) => <ActivityRow key={a.id} a={a} onOpen={() => setOpen(a)} />)
        )}
      </section>

      {open && <ActivityDetail a={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ActivityRow({ a, onOpen }: { a: HealthActivity; onOpen: () => void }) {
  const d = routePath(a.route, 56, 44, 4)
  return (
    <button onClick={onOpen} className="card flex w-full items-center gap-3 text-left transition active:scale-[0.99]">
      {d ? (
        <svg width={56} height={44} className="shrink-0 rounded-xl bg-sand/60">
          <path d={d} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : (
        <span className="grid h-11 w-14 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-2xl">
          {ACTIVITY_EMOJI[a.type]}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {a.title || ACTIVITY_LABEL[a.type]}
          <span className="font-normal text-cocoa-muted"> · {dayLabel(a.started_at.slice(0, 10))}</span>
        </span>
        <span className="tabular block text-xs text-cocoa-light">
          {[a.distance_m ? kmText(a.distance_m) : null, durationText(a.duration_s), paceText(a)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      {a.avg_hr && (
        <span
          className="tabular flex items-center gap-1 text-xs font-semibold"
          style={{ color: ZONE_COLOR[hrZone(a.avg_hr) ?? 0] }}
        >
          <Heart size={13} /> {a.avg_hr}
        </span>
      )}
    </button>
  )
}

function ActivityDetail({ a, onClose }: { a: HealthActivity; onClose: () => void }) {
  const d = routePath(a.route, 340, 200)
  const zone = hrZone(a.avg_hr)
  const stats: [string, string, typeof Timer][] = [
    ['Distanz', kmText(a.distance_m), Activity],
    ['Dauer', durationText(a.duration_s), Timer],
    ['Tempo', paceText(a) ?? '–', Activity],
    ['Ø Puls', a.avg_hr ? `${a.avg_hr} bpm` : '–', Heart],
    ['Max. Puls', a.max_hr ? `${a.max_hr} bpm` : '–', Heart],
    ['Höhenmeter', a.elevation_m ? `${Math.round(a.elevation_m)} m` : '–', Mountain],
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="anim-sheet mx-auto max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-bg p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">
              {ACTIVITY_EMOJI[a.type]} {a.title || ACTIVITY_LABEL[a.type]}
            </h2>
            <p className="text-sm text-cocoa-light">
              {new Date(a.started_at).toLocaleString('de-DE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {a.source && ` · ${a.source}`}
            </p>
          </div>
          <button
            aria-label="Schließen"
            className="grid h-9 w-9 place-items-center rounded-full bg-sand"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {d && (
          <svg viewBox="0 0 340 200" className="w-full rounded-2xl bg-sand/60">
            <path d={d} fill="none" stroke="#f97316" strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        )}
        <div className="grid grid-cols-3 gap-2">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-cream p-3">
              <div className="tabular text-base font-bold">{value}</div>
              <div className="text-[11px] text-cocoa-muted">{label}</div>
            </div>
          ))}
        </div>
        {zone && (
          <div className="flex items-center gap-2 rounded-2xl bg-cream p-3 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ background: ZONE_COLOR[zone] }} />
            Überwiegend Zone {zone} – {ZONE_LABEL[zone]}
          </div>
        )}
        {a.kcal != null && <p className="text-sm text-cocoa-light">ca. {Math.round(a.kcal)} kcal verbrannt</p>}
      </div>
    </div>
  )
}
