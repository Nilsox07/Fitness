import type { CSSProperties } from 'react'
import { Crown, Drumstick } from 'lucide-react'
import { Ring } from '../nutrition-home/Ring'
import { useBuddySkin } from '../buddy/useBuddy'
import { useCountUp } from '../food/useCountUp'
import { daysLeftLabel, shortName, type ProteinRow } from '../community/communityUtils'
import { Avatar } from './Avatar'
import { buddyLook, type Person } from './format'

const MAX_ROWS = 4

/**
 * Eiweiß-Duell als dunkle Hero-Karte: Tage mit erreichtem Eiweiß-Ziel (7 Punkte
 * pro Person) und Eiweiß heute als kleiner Ring (relativ zur Tagesbesten).
 */
export function ProteinDuelHero({
  people,
  meId,
  rows,
  leaderId,
  maxToday,
  today,
  daysLeft,
  style,
}: {
  people: Person[]
  meId: string
  /** sortiert (Spitze zuerst) */
  rows: ProteinRow[]
  leaderId: string | null
  maxToday: number
  today: string
  daysLeft: number
  style?: CSSProperties
}) {
  const mySkin = useBuddySkin()
  const byId = new Map(people.map((u) => [u.user_id, u]))
  const mine = rows.find((r) => r.user_id === meId)
  const myDays = useCountUp(mine?.days ?? 0, 700)
  // Vergangene Tage dieser Woche inkl. heute (für die Punkte-Optik)
  const elapsed = 7 - daysLeft

  // Du bist immer sichtbar, auch wenn du nicht unter den ersten vier bist.
  let shown = rows.slice(0, MAX_ROWS)
  if (mine && !shown.includes(mine)) shown = [...shown.slice(0, MAX_ROWS - 1), mine]
  const more = rows.length - shown.length

  const leader = leaderId ? byId.get(leaderId) : undefined
  const headline = leaderId
    ? leaderId === meId
      ? 'Du liegst vorne'
      : `${shortName(leader?.display_name)} liegt vorne`
    : rows.some((r) => r.days > 0 || r.today > 0)
      ? 'Kopf an Kopf'
      : 'Wer schafft zuerst sein Eiweiß-Ziel?'

  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      style={style}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-success/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
            <Drumstick size={13} className="text-success" />
            Eiweiß-Duell
          </p>
          <span className="tabular rounded-full bg-bg/10 px-2.5 py-1 text-[11px] font-semibold text-bg/80 dark:bg-white/5 dark:text-cocoa-light">
            {daysLeftLabel(daysLeft)}
          </span>
        </div>

        <div className="mt-1 flex items-end justify-between gap-3">
          <h2 className="min-w-0 text-xl font-bold tracking-tight">{headline}</h2>
          <div className="shrink-0 text-right leading-none">
            <span className="tabular text-4xl font-bold tracking-tight">{Math.round(myDays)}</span>
            <span className="tabular text-base font-semibold opacity-60">/7</span>
            <div className="mt-1 text-[11px] text-bg/60 dark:text-cocoa-light">deine Ziel-Tage</div>
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {shown.map((r) => {
            const u = byId.get(r.user_id)
            if (!u) return null
            const isMe = r.user_id === meId
            const topToday = r.today > 0 && r.today === maxToday
            return (
              <li key={r.user_id} className="flex items-center gap-3">
                <span className="relative shrink-0">
                  <Avatar
                    buddy={buddyLook(u, isMe, mySkin, today)}
                    name={u.display_name}
                    size={38}
                    className="bg-bg/10 dark:bg-white/5"
                  />
                  {r.user_id === leaderId && (
                    <Crown size={15} className="absolute -right-1.5 -top-1.5 rotate-12 fill-gold text-gold" aria-label="Führt" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm font-semibold ${isMe ? 'text-brand' : ''}`}>
                      {isMe ? 'Du' : shortName(u.display_name)}
                    </span>
                    <span className="tabular shrink-0 text-xs text-bg/60 dark:text-cocoa-light">
                      {r.days} {r.days === 1 ? 'Tag' : 'Tage'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1" aria-label={`${r.days} von 7 Tagen`}>
                    {Array.from({ length: 7 }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2.5 flex-1 rounded-full transition-colors duration-500 ${
                          i < r.days
                            ? 'bg-success'
                            : i < elapsed
                              ? 'bg-bg/20 dark:bg-cocoa/20'
                              : 'bg-bg/[0.07] dark:bg-cocoa/[0.08]'
                        }`}
                        style={i < r.days ? { animation: 'check-pop .28s ease-out both', animationDelay: `${i * 50}ms` } : undefined}
                      />
                    ))}
                  </div>
                </div>
                <Ring
                  size={44}
                  stroke={4}
                  progress={maxToday > 0 ? r.today / maxToday : 0}
                  trackClass="stroke-bg/15 dark:stroke-cocoa/15"
                  barClass={topToday ? 'stroke-success' : 'stroke-bg/60 dark:stroke-cocoa/50'}
                >
                  <span className="tabular flex flex-col items-center text-[11px] font-bold leading-none">
                    {r.today}
                    <span className="text-[8px] font-medium opacity-60">g</span>
                  </span>
                </Ring>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 flex items-center justify-between text-[11px] text-bg/50 dark:text-cocoa-muted">
          <span>Punkte = Tage mit Eiweiß-Ziel · Ring = heute</span>
          {more > 0 && <span className="tabular font-semibold">+{more} weitere</span>}
        </p>
      </div>
    </section>
  )
}
