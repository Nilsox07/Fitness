import { useState, type ReactNode } from 'react'
import { Check, Clock, HandFist, X } from 'lucide-react'
import { useDismissPoke, usePokes, useSendPoke, useSetGymStatus } from '../../hooks/useSocial'
import { Avatar } from './Avatar'
import { buddyLook, firstName, isNotToday, NOT_TODAY, planToday, timeAgo, type Person } from './format'

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
      className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors duration-200 disabled:opacity-50 ${
        active ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

/** Gym-Treff: eigener Plan, Pläne der Freunde (mit „Bin dabei") und eingehende Anstupser. */
export function GymMeetCard({
  me,
  friends,
  today,
  onOpenFriend,
}: {
  me: Person
  friends: Person[]
  today: string
  onOpenFriend: (u: Person) => void
}) {
  const setGymStatus = useSetGymStatus()
  const sendPoke = useSendPoke()
  const dismissPoke = useDismissPoke()
  const { data: pokes } = usePokes()
  const [custom, setCustom] = useState<string | null>(null)
  const [sent, setSent] = useState<Record<string, string>>({})

  const myPlan = planToday(me, today)
  const isPreset = myPlan != null && PRESETS.includes(myPlan)
  const byId = new Map(friends.map((u) => [u.user_id, u]))

  function save(text: string) {
    setGymStatus.mutate(text.trim(), { onSuccess: () => setCustom(null) })
  }
  function poke(toUser: string, text: string | undefined, label: string) {
    sendPoke.mutate({ toUser, text }, { onSuccess: () => setSent((s) => ({ ...s, [toUser]: label })) })
  }

  return (
    <div className="card space-y-4">
      {/* Eigener Plan */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">Wann gehst du?</h3>
          {myPlan && <span className="truncate text-xs text-cocoa-muted">Freunde sehen: {myPlan}</span>}
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
            <Clock size={14} />
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
      <ul className="space-y-2 border-t border-sand-dark/40 pt-3">
        {friends.map((u) => {
          const plan = planToday(u, today)
          const canJoin = plan != null && !isNotToday(plan)
          const done = sent[u.user_id]
          return (
            <li key={u.user_id} className="flex items-center gap-2.5">
              <button className="shrink-0" onClick={() => onOpenFriend(u)} aria-label={firstName(u)}>
                <Avatar buddy={buddyLook(u, false, 'classic', today)} name={u.display_name} size={32} />
              </button>
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{firstName(u)}</span>
                <span className="text-cocoa-muted"> · </span>
                <span className={plan ? 'text-cocoa' : 'text-cocoa-muted'}>{plan ?? 'noch kein Plan'}</span>
              </div>
              {done ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                  <Check size={14} strokeWidth={3} />
                  {done}
                </span>
              ) : canJoin ? (
                <button
                  className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand disabled:opacity-50"
                  onClick={() => poke(u.user_id, JOIN_TEXT, 'gesendet')}
                  disabled={sendPoke.isPending}
                >
                  Bin dabei
                </button>
              ) : !plan ? (
                <button
                  className="flex shrink-0 items-center gap-1 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-cocoa-light disabled:opacity-50"
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

      {/* Eingehende Anstupser */}
      {(pokes?.length ?? 0) > 0 && (
        <div className="space-y-3 border-t border-sand-dark/40 pt-3">
          {pokes!.map((p) => {
            const from = byId.get(p.from_user)
            return (
              <div key={p.id} className="anim-fade flex gap-2.5">
                <Avatar
                  buddy={from ? buddyLook(from, false, 'classic', today) : undefined}
                  name={from?.display_name}
                  size={32}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="relative rounded-2xl rounded-tl-md bg-sand px-3 py-2 pr-8 text-sm">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-semibold">{firstName(from)}</span>
                      <span className="text-[11px] text-cocoa-muted">{timeAgo(p.created_at)}</span>
                    </div>
                    <div className="text-cocoa-light">{p.text || 'Wann gehst du wieder ins Gym?'}</div>
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
                        className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-cocoa-light disabled:opacity-50"
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
    </div>
  )
}
