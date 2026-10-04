import { useState, type CSSProperties, type ReactNode } from 'react'
import { CalendarClock, Check, Clock, HandFist, X } from 'lucide-react'
import { useDismissPoke, usePokes, useSendPoke, useSetGymStatus } from '../../hooks/useSocial'
import { useBuddySkin } from '../buddy/useBuddy'
import { shortName } from '../community/communityUtils'
import { Avatar } from './Avatar'
import { buddyLook, isNotToday, NOT_TODAY, planToday, timeAgo, type Person } from './format'

const PRESETS = ['Heute früh', 'Heute Mittag', 'Heute Abend', 'Morgen', NOT_TODAY]
const JOIN_TEXT = 'Bin dabei! 👊'
const REPLIES = ['Bin dabei 👊', 'Heute nicht']

function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition duration-200 active:scale-95 disabled:opacity-50 ${
        active ? 'bg-cocoa text-cream shadow-sm' : 'bg-sand text-cocoa-light'
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {active && <Check size={13} strokeWidth={3} />}
      {children}
    </button>
  )
}

/** Gym-Treff: eigener Plan (Chips), Pläne der Freunde (mit „Bin dabei") und Anstupser als Chat. */
export function GymMeetCard({
  me,
  friends,
  today,
  onOpenFriend,
  style,
}: {
  me: Person
  friends: Person[]
  today: string
  onOpenFriend: (u: Person) => void
  style?: CSSProperties
}) {
  const setGymStatus = useSetGymStatus()
  const sendPoke = useSendPoke()
  const mySkin = useBuddySkin()
  const [custom, setCustom] = useState<string | null>(null)
  const [sent, setSent] = useState<Record<string, string>>({})

  const myPlan = planToday(me, today)
  const isPreset = myPlan != null && PRESETS.includes(myPlan)

  function save(text: string) {
    setGymStatus.mutate(text.trim(), { onSuccess: () => setCustom(null) })
  }
  function poke(toUser: string, text: string | undefined, label: string) {
    sendPoke.mutate({ toUser, text }, { onSuccess: () => setSent((s) => ({ ...s, [toUser]: label })) })
  }

  return (
    <div className="card space-y-4" style={style}>
      {/* Eigener Plan */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <CalendarClock size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Wann gehst du?</h3>
            <p className="truncate text-xs text-cocoa-light">
              {myPlan ? `Freunde sehen: ${myPlan}` : 'Sag Bescheid — vielleicht kommt wer mit.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Chip
              key={p}
              active={myPlan === p}
              onClick={() => save(myPlan === p ? '' : p)}
              disabled={setGymStatus.isPending}
            >
              {p}
            </Chip>
          ))}
          <Chip
            active={custom !== null || (myPlan != null && !isPreset)}
            onClick={() => setCustom(custom === null ? (myPlan && !isPreset ? myPlan : '') : null)}
          >
            {!(custom !== null || (myPlan != null && !isPreset)) && <Clock size={14} />}
            <span className="max-w-[10rem] truncate">{myPlan && !isPreset ? myPlan : 'Uhrzeit…'}</span>
          </Chip>
        </div>
        {custom !== null && (
          <div className="anim-fade flex gap-2">
            <input
              className="input py-2 text-sm"
              placeholder="z. B. heute 18 Uhr"
              value={custom}
              autoFocus
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save(custom)}
              aria-label="Eigener Plan"
            />
            <button
              className="btn-primary shrink-0 px-3 py-2 text-sm"
              onClick={() => save(custom)}
              disabled={setGymStatus.isPending}
            >
              Setzen
            </button>
          </div>
        )}
      </div>

      {/* Pläne der Freunde */}
      {friends.length > 0 && (
        <div className="space-y-2">
          <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-cocoa-muted">Freunde</h4>
          <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-sand-light ring-1 ring-sand-dark/40">
            {friends.map((u) => {
              const plan = planToday(u, today)
              const trained = u.last_workout === today
              const canJoin = plan != null && !isNotToday(plan) && !trained
              const done = sent[u.user_id]
              return (
                <li key={u.user_id} className="flex items-center gap-3 px-3 py-2.5">
                  <button className="shrink-0" onClick={() => onOpenFriend(u)} aria-label={shortName(u.display_name)}>
                    <Avatar buddy={buddyLook(u, false, mySkin, today)} name={u.display_name} size={34} className="bg-sand" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{shortName(u.display_name)}</div>
                    <div className="flex items-center gap-1 truncate text-xs">
                      {trained ? (
                        <>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                          <span className="text-success">hat heute trainiert</span>
                        </>
                      ) : plan ? (
                        <span className={isNotToday(plan) ? 'text-cocoa-muted' : 'font-medium text-cocoa'}>{plan}</span>
                      ) : (
                        <span className="text-cocoa-muted">noch kein Plan</span>
                      )}
                    </div>
                  </div>
                  {done ? (
                    <span className="anim-fade flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                      <Check size={14} strokeWidth={3} />
                      {done}
                    </span>
                  ) : canJoin ? (
                    <button
                      className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand transition active:scale-95 disabled:opacity-50"
                      onClick={() => poke(u.user_id, JOIN_TEXT, 'gesendet')}
                      disabled={sendPoke.isPending}
                    >
                      Bin dabei
                    </button>
                  ) : !plan && !trained ? (
                    <button
                      className="flex shrink-0 items-center gap-1 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-cocoa-light transition active:scale-95 disabled:opacity-50"
                      onClick={() => poke(u.user_id, undefined, 'gefragt')}
                      disabled={sendPoke.isPending}
                    >
                      <HandFist size={13} />
                      Fragen
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Eingehende Anstupser als Chat-Blasen */}
      <PokeBubbles friends={friends} today={today} />
    </div>
  )
}

/** Eingehende Anstupser als Chat-Blasen mit Schnell-Antworten (nichts, wenn keine da sind). */
export function PokeBubbles({ friends, today }: { friends: Person[]; today: string }) {
  const sendPoke = useSendPoke()
  const dismissPoke = useDismissPoke()
  const { data: pokes } = usePokes()
  const mySkin = useBuddySkin()
  const byId = new Map(friends.map((u) => [u.user_id, u]))
  return (
    <>
      {(pokes?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-cocoa-muted">Nachrichten</h4>
          {pokes!.map((p) => {
            const from = byId.get(p.from_user)
            return (
              <div key={p.id} className="anim-fade flex items-end gap-2">
                <Avatar
                  buddy={from ? buddyLook(from, false, mySkin, today) : undefined}
                  name={from?.display_name}
                  size={30}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="relative w-fit max-w-full rounded-2xl rounded-bl-md bg-sand px-3.5 py-2 pr-9 text-sm">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold">{shortName(from?.display_name)}</span>
                      <span className="text-[10px] text-cocoa-muted">{timeAgo(p.created_at)}</span>
                    </div>
                    <div className="text-cocoa">{p.text || 'Wann gehst du wieder ins Gym?'}</div>
                    <button
                      className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-cocoa-muted"
                      onClick={() => dismissPoke.mutate(p.id)}
                      aria-label="Ausblenden"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    {REPLIES.map((r) => (
                      <button
                        key={r}
                        className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand transition active:scale-95 disabled:opacity-50"
                        disabled={sendPoke.isPending}
                        onClick={() =>
                          sendPoke.mutate(
                            { toUser: p.from_user, text: r },
                            { onSuccess: () => dismissPoke.mutate(p.id) },
                          )
                        }
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
