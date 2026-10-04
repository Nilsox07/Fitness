import { useState, type CSSProperties } from 'react'
import { ChevronRight, Crown, Dumbbell, Swords, Target, Drumstick } from 'lucide-react'
import { DUEL_POINTS, WEEKLY_GOAL, type DuelScore, type DuelStandings } from '../../lib/duel'
import { Buddy, type BuddyMood } from '../buddy/Buddy'
import { useBuddySkin } from '../buddy/useBuddy'
import { useCountUp } from '../food/useCountUp'
import { Sheet } from '../workout/Sheet'
import { daysLeftLabel, shortName } from '../community/communityUtils'
import { Avatar } from './Avatar'
import { buddyLook, type Person } from './format'

/**
 * Wochen-Duell als dunkle Hero-Karte: zwei Buddies stehen sich gegenüber (du links,
 * Gegner:in rechts). Bei mehreren Freunden: du gegen die Spitze der Freunde + „+N".
 */
export function DuelHero({
  people,
  meId,
  standings,
  includeProtein,
  today,
  daysLeft,
  style,
}: {
  /** Reihenfolge wie in `standings.scores` */
  people: Person[]
  meId: string
  standings: DuelStandings
  includeProtein: boolean
  today: string
  daysLeft: number
  style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const mySkin = useBuddySkin()
  const { scores, leaderId, lead } = standings
  const byId = new Map(scores.map((s) => [s.user_id, s]))
  const me = people.find((u) => u.user_id === meId)
  const friends = people.filter((u) => u.user_id !== meId)
  // Gegner:in = bester Freund nach Punkten (bei Gleichstand: zuerst gelistet)
  const opp = [...friends].sort((a, b) => (byId.get(b.user_id)?.total ?? 0) - (byId.get(a.user_id)?.total ?? 0))[0]
  const meScore = byId.get(meId)
  const oppScore = opp ? byId.get(opp.user_id) : undefined
  const myPts = useCountUp(meScore?.total ?? 0, 700)
  const oppPts = useCountUp(oppScore?.total ?? 0, 700)
  if (!me || !opp || !meScore || !oppScore) return null

  const pair = meScore.total + oppScore.total
  const myShare = pair > 0 ? (meScore.total / pair) * 100 : 50
  const oppName = shortName(opp.display_name)
  const more = friends.length - 1

  const mood = (id: string, fallback: BuddyMood): BuddyMood =>
    leaderId === id ? 'cheer' : leaderId ? 'focus' : fallback

  const headline = leaderId
    ? leaderId === meId
      ? `Du führst mit ${lead} P`
      : `${shortName(people.find((u) => u.user_id === leaderId)?.display_name)} führt mit ${lead} P`
    : pair > 0
      ? 'Gleichstand — jetzt zählt jedes Training'
      : 'Noch keine Punkte — wer legt vor?'

  const side = (u: Person, s: DuelScore, pts: number, isMe: boolean) => {
    const look = buddyLook(u, isMe, mySkin, today)
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center text-center">
        <div className="relative">
          <span className="absolute inset-2 rounded-full bg-bg/10 dark:bg-white/5" aria-hidden />
          <span className={`relative block ${isMe ? '' : '-scale-x-100'}`}>
            <Buddy size={84} stage={look.stage} skin={look.skin} mood={mood(u.user_id, look.mood)} />
          </span>
          {leaderId === u.user_id && (
            <Crown
              size={22}
              className={`absolute -top-1 fill-gold text-gold drop-shadow ${isMe ? 'right-0 rotate-12' : 'left-0 -rotate-12'}`}
              aria-label="Führt"
            />
          )}
        </div>
        <div className={`mt-1 w-full truncate text-sm font-semibold ${isMe ? 'text-brand' : ''}`}>
          {isMe ? 'Du' : shortName(u.display_name)}
        </div>
        <div className="tabular text-4xl font-bold leading-none tracking-tight">
          {Math.round(pts)}
          <span className="ml-0.5 text-base font-semibold opacity-60">P</span>
        </div>
        <div className="tabular mt-1 text-[11px] text-bg/60 dark:text-cocoa-light">
          {s.sessions} {s.sessions === 1 ? 'Training' : 'Trainings'}
        </div>
      </div>
    )
  }

  return (
    <section style={style}>
      <div
        role="button"
        tabIndex={0}
        className="relative w-full cursor-pointer overflow-hidden rounded-3xl bg-cocoa p-5 text-left text-bg shadow-lg shadow-black/10 transition active:scale-[0.99] dark:bg-sand-light dark:text-cocoa dark:shadow-none"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        aria-label={`Wochen-Duell: ${headline}. Details öffnen`}
      >
        <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
              <Swords size={13} className="text-brand" />
              Wochen-Duell
            </p>
            <span className="tabular rounded-full bg-bg/10 px-2.5 py-1 text-[11px] font-semibold text-bg/80 dark:bg-white/5 dark:text-cocoa-light">
              {daysLeftLabel(daysLeft)}
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{headline}</h2>

          <div className="mt-4 flex items-start gap-2">
            {side(me, meScore, myPts, true)}
            <div className="flex flex-col items-center gap-1.5 pt-9">
              <span className="text-xs font-bold uppercase tracking-widest text-bg/40 dark:text-cocoa-muted">vs</span>
              {more > 0 && (
                <span className="tabular rounded-full bg-bg/10 px-2 py-0.5 text-[10px] font-semibold text-bg/70 dark:bg-white/5 dark:text-cocoa-light">
                  +{more}
                </span>
              )}
            </div>
            {side(opp, oppScore, oppPts, false)}
          </div>

          {/* Verhältnis-Balken: du (links) vs. Gegner:in (rechts) */}
          <div className="mt-4 flex h-2.5 gap-1 overflow-hidden rounded-full" aria-hidden>
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out ${pair > 0 ? 'bg-brand' : 'bg-bg/15 dark:bg-white/10'}`}
              style={{ width: `${myShare}%` }}
            />
            <div
              className={`h-full flex-1 rounded-full ${pair > 0 ? 'bg-bg/35 dark:bg-cocoa/30' : 'bg-bg/15 dark:bg-white/10'}`}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-bg/60 dark:text-cocoa-light">
            <span>
              {more > 0 ? `Gegen die Spitze · ${oppName}` : `Du vs. ${oppName}`}
            </span>
            <span className="flex items-center gap-0.5 font-semibold text-bg/80 dark:text-cocoa">
              Details
              <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>

      {open && (
        <DuelSheet
          people={people}
          meId={meId}
          standings={standings}
          includeProtein={includeProtein}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  )
}

/** Aufschlüsselung aller Teilnehmer + „So zählt's". */
function DuelSheet({
  people,
  meId,
  standings,
  includeProtein,
  onClose,
}: {
  people: Person[]
  meId: string
  standings: DuelStandings
  includeProtein: boolean
  onClose: () => void
}) {
  const mySkin = useBuddySkin()
  const byId = new Map(people.map((u) => [u.user_id, u]))
  const ranked = [...standings.scores].sort((a, b) => b.total - a.total)
  const rules = [
    { Icon: Dumbbell, pts: `${DUEL_POINTS.training} P`, text: 'pro Training diese Woche' },
    { Icon: Target, pts: `+${DUEL_POINTS.goal} P`, text: `Bonus ab ${WEEKLY_GOAL} Trainings` },
    ...(includeProtein
      ? [{ Icon: Drumstick, pts: `${DUEL_POINTS.protein} P`, text: 'pro Tag mit erreichtem Eiweiß-Ziel' }]
      : []),
  ]

  return (
    <Sheet title="Wochen-Duell" onClose={onClose}>
      <div className="space-y-5">
        <ol className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-sand-light ring-1 ring-sand-dark/50">
          {ranked.map((s, i) => {
            const u = byId.get(s.user_id)
            if (!u) return null
            const isMe = s.user_id === meId
            const parts = [
              `${s.sessions}× Training`,
              ...(s.goal ? [`+${s.goal} Ziel`] : []),
              ...(includeProtein && s.proteinDays ? [`${s.proteinDays} Eiweiß-Tage`] : []),
            ]
            return (
              <li key={s.user_id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="tabular w-4 text-center text-sm font-bold text-cocoa-muted">{i + 1}</span>
                <span className="relative">
                  <Avatar buddy={buddyLook(u, isMe, mySkin)} name={u.display_name} size={36} />
                  {s.user_id === standings.leaderId && (
                    <Crown size={14} className="absolute -right-1 -top-1.5 rotate-12 fill-gold text-gold" aria-label="Führt" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-semibold ${isMe ? 'text-brand' : ''}`}>
                    {isMe ? 'Du' : shortName(u.display_name)}
                  </span>
                  <span className="tabular block truncate text-xs text-cocoa-light">{parts.join(' · ')}</span>
                </span>
                <span className="tabular text-lg font-bold">
                  {s.total}
                  <span className="ml-0.5 text-xs font-semibold text-cocoa-light">P</span>
                </span>
              </li>
            )
          })}
        </ol>

        <div className="space-y-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">So zählt's</h3>
          <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-sand-light ring-1 ring-sand-dark/50">
            {rules.map(({ Icon, pts, text }) => (
              <li key={text} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                  <Icon size={15} />
                </span>
                <span className="tabular w-12 shrink-0 font-bold">{pts}</span>
                <span className="text-cocoa-light">{text}</span>
              </li>
            ))}
          </ul>
          <p className="px-1 text-xs text-cocoa-muted">
            Zählt Mo–So und startet jeden Montag neu. Geteilt werden nur Summen.
          </p>
        </div>
      </div>
    </Sheet>
  )
}
