import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, Hand, Medal } from 'lucide-react'
import { Buddy } from '../buddy/Buddy'
import { useBuddySkin } from '../buddy/useBuddy'
import { shortName } from '../community/communityUtils'
import { accessoryProps } from '../../lib/seasonBadges'
import { buddyLook, type Person } from './format'
import { FITNESS, FOOD, metricText, metricValue, type Metric } from './LeaderboardSection'

const PLACE = [
  { ring: 'ring-[#F2B705]', tone: 'text-[#F2B705]', h: 'h-20' },
  { ring: 'ring-[#A8B2C1]', tone: 'text-[#A8B2C1]', h: 'h-16' },
  { ring: 'ring-[#C77B3A]', tone: 'text-[#C77B3A]', h: 'h-14' },
]

/**
 * Bestenliste als Karussell-Karte im Duell-Stil: Podest mit Buddys für die Top 3,
 * darunter weitere Plätze. Kategorie über eine Auswahl – kein zweites Wischen.
 */
export function LeaderboardHero({
  people,
  meId,
  today,
  withFood,
  kudosGiven,
  onKudos,
  style,
}: {
  people: Person[]
  meId: string
  today: string
  withFood: boolean
  kudosGiven: Set<string>
  onKudos: (userId: string) => void
  style?: CSSProperties
}) {
  const mySkin = useBuddySkin()
  const options: { id: Metric; label: string }[] = [
    ...FITNESS,
    ...(withFood ? FOOD.filter((f) => f.id !== 'level') : []),
  ]
  const [metric, setMetric] = useState<Metric>('monthly_prs')
  const ranked = useMemo(
    () => [...people].sort((a, b) => metricValue(metric, b, meId, today) - metricValue(metric, a, meId, today)),
    [people, metric, meId, today],
  )
  const top = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  // Podest-Reihenfolge: 2 – 1 – 3
  const podium = [top[1], top[0], top[2]].map((u, i) => (u ? { u, place: [1, 0, 2][i] } : null))

  const name = (u: Person) => (u.user_id === meId ? 'Du' : shortName(u.display_name, 'Athlet'))

  return (
    <section
      className="relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      style={style}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
          <Medal size={14} className="text-gold" /> Bestenliste
        </span>
        <label className="relative">
          <span className="sr-only">Kategorie</span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            className="appearance-none rounded-full bg-bg/10 py-1.5 pl-3 pr-8 text-sm font-semibold text-bg outline-none dark:bg-white/5 dark:text-cocoa"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id} className="text-cocoa">
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-bg/70 dark:text-cocoa-light"
          />
        </label>
      </div>

      {/* Podest */}
      <div className="relative grid grid-cols-3 items-end gap-2">
        {podium.map((p, i) =>
          p ? (
            <div key={p.u.user_id} className="flex min-w-0 flex-col items-center text-center">
              {(() => {
                const look = buddyLook(p.u, p.u.user_id === meId, mySkin, today)
                const big = p.place === 0
                return (
                  <span
                    className={`grid place-items-center rounded-full bg-bg/10 ring-[3px] dark:bg-white/5 ${PLACE[p.place].ring}`}
                    style={{ width: big ? 76 : 60, height: big ? 76 : 60 }}
                  >
                    <Buddy
                      size={big ? 72 : 56}
                      stage={look.stage}
                      mood={p.place === 0 ? 'proud' : look.mood}
                      skin={look.skin}
                      variant={look.variant}
                      {...accessoryProps(look.accessory)}
                      animate={big}
                    />
                  </span>
                )
              })()}
              <span
                className={`mt-1.5 w-full truncate text-sm font-semibold ${p.u.user_id === meId ? 'text-brand' : ''}`}
              >
                {name(p.u)}
              </span>
              <span className="tabular text-xs text-bg/70 dark:text-cocoa-light">
                {metricText(metric, metricValue(metric, p.u, meId, today))}
              </span>
              <div
                className={`mt-2 flex w-full flex-col items-center justify-start rounded-t-2xl bg-bg/10 pt-1.5 dark:bg-white/5 ${PLACE[p.place].h}`}
              >
                <span className={`tabular text-lg font-black ${PLACE[p.place].tone}`}>{p.place + 1}</span>
                {p.u.user_id !== meId && (
                  <button
                    className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-bg/10 text-bg/80 transition active:scale-90 disabled:opacity-40 dark:bg-white/5 dark:text-cocoa"
                    onClick={() => onKudos(p.u.user_id)}
                    disabled={kudosGiven.has(p.u.user_id)}
                    aria-label={`Kudos an ${name(p.u)}`}
                  >
                    <Hand size={12} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>

      {rest.length > 0 && (
        <ol className="relative space-y-1.5">
          {rest.map((u, i) => (
            <li key={u.user_id} className="flex items-center gap-3 rounded-2xl bg-bg/10 px-3 py-2 dark:bg-white/5">
              <span className="tabular w-5 text-center text-sm font-bold text-bg/60 dark:text-cocoa-light">
                {i + 4}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm font-semibold ${u.user_id === meId ? 'text-brand' : ''}`}
              >
                {name(u)}
              </span>
              <span className="tabular text-sm">{metricText(metric, metricValue(metric, u, meId, today))}</span>
              {u.user_id !== meId && (
                <button
                  className="grid h-7 w-7 place-items-center rounded-full bg-bg/10 transition active:scale-90 disabled:opacity-40 dark:bg-white/5"
                  onClick={() => onKudos(u.user_id)}
                  disabled={kudosGiven.has(u.user_id)}
                  aria-label={`Kudos an ${name(u)}`}
                >
                  <Hand size={14} />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {(metric === 'weekly_volume' || metric === 'monthly_prs') && (
        <p className="relative text-[11px] leading-snug text-bg/50 dark:text-cocoa-muted">
          {metric === 'monthly_prs'
            ? 'Neue Bestleistungen diesen Monat – fair für jedes Kraftniveau.'
            : 'Volumen hängt vom Kraftniveau ab – zum Vergleichen besser „Fortschritt“.'}
        </p>
      )}
    </section>
  )
}
