import { useMemo, useState } from 'react'
import { ChevronDown, Flame, Hand, Medal, Trophy } from 'lucide-react'
import type { UserStat } from '../../hooks/useSocial'
import { effectiveMonthlyPrs, effectiveWeeklyVolume } from '../../lib/duel'
import { useBuddySkin } from '../buddy/useBuddy'
import { Avatar } from './Avatar'
import { buddyLook } from './format'

// Reihenfolge = faire Kennzahlen zuerst; Volumen (kraftabhängig) zuletzt.
type Metric = 'monthly_prs' | 'total_sessions' | 'week_streak' | 'level' | 'weekly_volume'
const METRIC_LABEL: Record<Metric, string> = {
  monthly_prs: 'Fortschritt',
  total_sessions: 'Trainings',
  week_streak: 'Streak',
  level: 'Level',
  weekly_volume: 'Volumen',
}

function metricValue(u: UserStat, m: Metric): number {
  // Wochen-/Monatswerte nur, wenn sie aus dem aktuellen Zeitraum stammen.
  if (m === 'weekly_volume') return effectiveWeeklyVolume(u)
  if (m === 'monthly_prs') return effectiveMonthlyPrs(u)
  return (u[m] as number) ?? 0
}

/** Aufklappbare Allzeit-Bestenliste mit allen alten Kennzahlen. */
export function LeaderboardSection({
  board,
  meId,
  kudosReceived,
  kudosGiven,
  onKudos,
}: {
  board: UserStat[]
  meId: string
  kudosReceived: Map<string, number>
  kudosGiven: Set<string>
  onKudos: (userId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const mySkin = useBuddySkin()
  const [metric, setMetric] = useState<Metric>('monthly_prs')
  const ranked = useMemo(
    () => [...board].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)),
    [board, metric],
  )

  function display(u: UserStat) {
    const v = metricValue(u, metric)
    switch (metric) {
      case 'monthly_prs':
        return (
          <span className="inline-flex items-center gap-1">
            {v}
            <Trophy size={14} className="text-gold" />
          </span>
        )
      case 'level':
        return `Lvl ${v || 1}`
      case 'weekly_volume':
        return `${v.toLocaleString('de-DE')} kg`
      case 'week_streak':
        return (
          <span className="inline-flex items-center gap-1">
            <Flame size={14} className="text-cocoa-light" />
            {v}
          </span>
        )
      default:
        return `${v}`
    }
  }

  return (
    <section className="space-y-3">
      <button
        className="card flex w-full items-center gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light">
          <Medal size={16} />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Bestenliste</span>
          <span className="block text-xs text-cocoa-light">
            Allzeit · Trainings, Streak, Level, Volumen …
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-cocoa-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="anim-fade space-y-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ${
                  metric === m ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
                }`}
                aria-pressed={metric === m}
              >
                {METRIC_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="px-1 text-xs text-cocoa-muted">
            Fair vergleichen: <strong>Fortschritt</strong> (neue Bestleistungen/Monat) &amp;{' '}
            <strong>Trainings</strong> zählen für alle gleich — Volumen hängt vom Kraftniveau ab.
          </p>
          <ol className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
            {ranked.map((u, i) => {
              const me = u.user_id === meId
              return (
                <li key={u.user_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="tabular w-5 text-center text-sm font-bold text-cocoa-muted">{i + 1}</span>
                  <Avatar buddy={buddyLook(u, me, mySkin)} name={u.display_name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-semibold ${me ? 'text-brand' : ''}`}>
                      {me ? 'Du' : (u.display_name ?? 'Athlet')}
                    </div>
                    <div className="tabular flex flex-wrap items-center gap-x-1 text-xs text-cocoa-light">
                      {u.rank_title ?? ''} · {u.total_sessions} Trainings
                      {kudosReceived.get(u.user_id) ? (
                        <span className="inline-flex items-center gap-1">
                          · <Hand size={12} /> {kudosReceived.get(u.user_id)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="tabular text-right text-sm font-semibold">{display(u)}</div>
                  {!me && (
                    <button
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light transition-colors duration-200 disabled:opacity-40"
                      onClick={() => onKudos(u.user_id)}
                      disabled={kudosGiven.has(u.user_id)}
                      aria-label="Kudos geben"
                    >
                      <Hand size={16} />
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
