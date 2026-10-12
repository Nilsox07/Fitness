import { Check, Plus } from 'lucide-react'
import { effectiveProteinDays, effectiveSessions } from '../../lib/duel'
import { useBuddySkin } from '../buddy/useBuddy'
import { PROTEIN_TEAM_DAYS, shortName, type FeedWorld } from '../community/communityUtils'
import { RingAvatar } from './Avatar'
import { buddyLook, jointStreak, proteinToday, statusLine, type Person } from './format'

/**
 * Freunde-Leiste im Stories-Stil: du zuerst, dann Freunde.
 * Fitness: Ring = Trainings dieser Woche; Ernährung: Ring = Eiweiß-Ziel-Tage, darunter Eiweiß heute.
 */
export function FriendsRow({
  me,
  friends,
  today,
  world = 'fitness',
  combined = false,
  onOpen,
  onInvite,
}: {
  me: Person
  friends: Person[]
  today: string
  world?: FeedWorld
  /** Neue Community: Ring = Trainings, darunter Training oder Eiweiß von heute */
  combined?: boolean
  onOpen: (u: Person) => void
  onInvite: () => void
}) {
  const people = [me, ...friends]
  const mySkin = useBuddySkin()
  const food = !combined && world === 'food'
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-0.5 [scrollbar-width:none]">
      {people.map((u, i) => {
        const isMe = u.user_id === me.user_id
        const st = statusLine(u, today)
        // Eigene Zahlen sind lokal frisch; bei Freunden nur aktuelle Zeilen.
        const days = isMe ? Math.round(u.protein_week ?? 0) : effectiveProteinDays(u, today)
        const grams = isMe ? Math.round(u.protein_today ?? 0) : proteinToday(u, today)
        const trained = !food && st.kind === 'trained'
        return (
          <button
            key={u.user_id}
            className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center transition active:scale-95"
            onClick={() => onOpen(u)}
            aria-label={isMe ? 'Du' : shortName(u.display_name)}
            style={{ animation: 'fade-in .3s ease-out both', animationDelay: `${i * 40}ms` }}
          >
            <span className="relative">
              <RingAvatar
                name={u.display_name}
                sessions={effectiveSessions(u, today)}
                progress={food ? days / PROTEIN_TEAM_DAYS : undefined}
                buddy={buddyLook(u, isMe, mySkin, today)}
              />
              {trained && (
                <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-success text-white ring-2 ring-bg">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              {combined && !isMe && jointStreak(me, u) >= 2 && (
                <span
                  className="tabular absolute -left-1 -top-1 flex items-center rounded-full bg-bg px-1 text-[11px] font-bold shadow ring-1 ring-sand-dark/50"
                  title="Gemeinsame Serie (Wochen)"
                >
                  🔥{jointStreak(me, u)}
                </span>
              )}
            </span>
            <span className="w-full min-w-0">
              <span className={`block truncate text-sm font-semibold ${isMe ? 'text-brand' : ''}`}>
                {isMe ? 'Du' : shortName(u.display_name)}
              </span>
              <span className="block truncate text-[11px] leading-tight text-cocoa-muted">
                {combined && st.kind !== 'trained' && grams > 0 ? (
                  <span className="tabular text-cocoa-light">{grams} g Eiweiß</span>
                ) : food ? (
                  grams > 0 ? (
                    <span className="tabular text-cocoa-light">{grams} g Eiweiß</span>
                  ) : (
                    'heute noch nichts'
                  )
                ) : (
                  <span className={st.kind === 'idle' ? '' : 'text-cocoa-light'}>{st.text}</span>
                )}
              </span>
            </span>
          </button>
        )
      })}
      <button
        className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center transition active:scale-95"
        onClick={onInvite}
      >
        <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-sand-dark text-cocoa-light">
          <Plus size={22} />
        </span>
        <span className="block text-sm font-semibold text-cocoa-light">Einladen</span>
      </button>
    </div>
  )
}
