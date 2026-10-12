import { useMemo, useState, type CSSProperties } from 'react'
import { Check, ChevronDown, Hand, Medal } from 'lucide-react'
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
  const [menu, setMenu] = useState(false)
  const val = (u: Person) => metricValue(metric, u, meId, today)
  const ranked = useMemo(
    () => [...people].sort((a, b) => metricValue(metric, b, meId, today) - metricValue(metric, a, meId, today)),
    [people, metric, meId, today],
  )
  // Gleichstand = geteilter Platz (1, 1, 3 …)
  const rankOf = (u: Person) => 1 + ranked.filter((x) => val(x) > val(u)).length
  const top = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  // Podest-Reihenfolge: 2 – 1 – 3 (Farbe & Höhe nach echtem Platz)
  const podium = [top[1], top[0], top[2]].map((u) => (u ? { u, place: Math.min(rankOf(u), 3) - 1 } : null))
  const current = options.find((o) => o.id === metric)?.label ?? ''

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
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-haspopup="listbox"
          aria-expanded={menu}
          className="flex items-center gap-1.5 rounded-full bg-bg/10 py-1.5 pl-3.5 pr-2.5 text-sm font-semibold transition active:scale-95 dark:bg-white/5"
        >
          {current}
          <ChevronDown size={15} className={`transition-transform duration-200 ${menu ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Auswahl öffnet sich über die Kartenbreite (statt der System-Auswahl) */}
      {menu && (
        <>
          <button
            type="button"
            aria-label="Auswahl schließen"
            className="absolute inset-0 z-10 cursor-default"
            onClick={() => setMenu(false)}
          />
          <ul
            role="listbox"
            aria-label="Kategorie"
            className="anim-fade absolute inset-x-4 top-[4.25rem] z-20 grid grid-cols-2 gap-1 overflow-hidden rounded-2xl bg-[#1E2638] p-1.5 shadow-2xl ring-1 ring-white/10 dark:bg-cream dark:ring-sand-dark"
          >
            {options.map((o) => {
              const on = o.id === metric
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setMetric(o.id)
                      setMenu(false)
                    }}
                    className={`flex w-full items-center justify-between gap-1 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                      on ? 'bg-white/10 dark:bg-sand' : 'active:bg-white/5'
                    }`}
                  >
                    {o.label}
                    {on && <Check size={16} strokeWidth={3} className="text-brand" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

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
          {rest.map((u) => (
            <li key={u.user_id} className="flex items-center gap-3 rounded-2xl bg-bg/10 px-3 py-2 dark:bg-white/5">
              <span className="tabular w-5 text-center text-sm font-bold text-bg/60 dark:text-cocoa-light">
                {rankOf(u)}
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
