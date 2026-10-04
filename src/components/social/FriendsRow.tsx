import { Plus } from 'lucide-react'
import { effectiveSessions } from '../../lib/duel'
import { mascotStageIndex } from '../../lib/cosmetics'
import { friendBuddyMood } from '../../lib/buddyMood'
import { usePrefs } from '../../lib/prefs'
import { useBuddySkin } from '../buddy/useBuddy'
import { RingAvatar } from './Avatar'
import { avatarEmoji, firstName, statusLine, type Person } from './format'

/** Freunde-Leiste im Stories-Stil: du zuerst, dann Freunde; Ring = Trainings dieser Woche. */
export function FriendsRow({
  me,
  friends,
  today,
  onOpen,
  onInvite,
}: {
  me: Person
  friends: Person[]
  today: string
  onOpen: (u: Person) => void
  onInvite: () => void
}) {
  const people = [me, ...friends]
  const { isNew } = usePrefs()
  const mySkin = useBuddySkin()
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {people.map((u) => {
        const isMe = u.user_id === me.user_id
        const st = statusLine(u, today)
        return (
          <button
            key={u.user_id}
            className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center transition active:scale-95"
            onClick={() => onOpen(u)}
            aria-label={isMe ? 'Du' : firstName(u)}
          >
            <RingAvatar
              emoji={avatarEmoji(u, isMe)}
              name={u.display_name}
              sessions={effectiveSessions(u, today)}
              buddy={
                isNew
                  ? {
                      stage: mascotStageIndex(u.total_sessions ?? 0),
                      mood: friendBuddyMood(u.last_workout, today),
                      // Skins der Freunde werden nicht geteilt → Standard-Skin
                      skin: isMe ? mySkin : 'classic',
                    }
                  : undefined
              }
            />
            <span className="w-full min-w-0">
              <span className="block truncate text-sm font-semibold">{isMe ? 'Du' : firstName(u)}</span>
              <span className="flex items-center justify-center gap-1 text-[11px] leading-tight text-cocoa-muted">
                {st.kind === 'trained' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />}
                <span className={`truncate ${st.kind === 'plan' ? 'text-cocoa-light' : ''}`}>{st.text}</span>
              </span>
            </span>
          </button>
        )
      })}
      {friends.length === 0 && (
        <button
          className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center transition active:scale-95"
          onClick={onInvite}
        >
          <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-sand-dark text-cocoa-light">
            <Plus size={22} />
          </span>
          <span className="block text-sm font-semibold text-cocoa-light">Einladen</span>
        </button>
      )}
    </div>
  )
}
