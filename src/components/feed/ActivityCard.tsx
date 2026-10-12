import { useMemo, useState, type CSSProperties } from 'react'
import {
  Activity as ActivityIcon,
  ChefHat,
  Dumbbell,
  Flame,
  MessageCircle,
  Pizza,
  Send,
  Star,
  Trophy,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useCopyWorkout } from '../../hooks/useCopyWorkout'
import { useMyProfile } from '../../hooks/useSocial'
import {
  useAddComment,
  useComments,
  useLikes,
  useReact,
  reactionOf,
  REACTIONS,
  type Activity,
  type ActivityComment,
  type ActivityLike,
} from '../../hooks/useFeed'
import { Avatar } from '../social/Avatar'
import { timeAgo, type BuddyLook } from '../social/format'
import { activityWorld, detailStats, parsePr } from '../community/communityUtils'

/** Autor-Anzeige: Name + Buddy (falls die Stats bekannt sind). */
export interface AuthorInfo {
  label: string
  buddy?: BuddyLook
}

interface KindStyle {
  Icon: LucideIcon
  /** getönter Kreis + Icon-Farbe */
  tint: string
  label: string
}

function kindStyle(kind: string): KindStyle {
  const k = kind.toLowerCase()
  if (k === 'pr' || k.includes('record') || k.includes('rekord'))
    return { Icon: Trophy, tint: 'bg-gold/15 text-gold', label: 'Rekord' }
  if (k.includes('level')) return { Icon: Star, tint: 'bg-gold/15 text-gold', label: 'Level' }
  if (k.includes('streak')) return { Icon: Flame, tint: 'bg-brand/10 text-brand', label: 'Serie' }
  if (k === 'cheat') return { Icon: Pizza, tint: 'bg-brand/10 text-brand', label: 'Cheat-Meal' }
  if (k.includes('recipe') || k.includes('rezept'))
    return { Icon: ChefHat, tint: 'bg-success/10 text-success', label: 'Rezept' }
  if (activityWorld(k) === 'food') return { Icon: Utensils, tint: 'bg-success/10 text-success', label: 'Ernährung' }
  if (k.includes('workout') || k.includes('training'))
    return { Icon: Dumbbell, tint: 'bg-brand/10 text-brand', label: 'Training' }
  return { Icon: ActivityIcon, tint: 'bg-sand text-cocoa-light', label: 'Aktivität' }
}

/** Eine Aktivität im Strava-Stil: Autor, Art, Inhalt, Applaus & Kommentare. */
export function ActivityCard({
  activity: a,
  author,
  comments,
  likes,
  extras = [],
  style,
}: {
  activity: Activity
  author: AuthorInfo
  comments: ActivityComment[]
  likes: ActivityLike[]
  /** Weitere Einträge derselben Person am selben Tag (Rekorde, Cheat …) */
  extras?: Activity[]
  style?: CSSProperties
}) {
  const { user } = useAuth()
  const { data: profile } = useMyProfile()
  const react = useReact()
  const copy = useCopyWorkout()
  const navigate = useNavigate()
  const shared = a.kind === 'workout' && a.user_id !== user?.id ? (a.meta?.exercises ?? []) : []
  const addComment = useAddComment()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const mine = likes.find((l) => l.user_id === user?.id)
  const myReaction = mine ? reactionOf(mine) : null
  const counts = new Map<string, number>()
  for (const l of likes) counts.set(reactionOf(l), (counts.get(reactionOf(l)) ?? 0) + 1)
  const { Icon, tint, label } = kindStyle(a.kind)
  const pr = a.kind === 'pr' ? parsePr(a.title, a.detail) : null
  const stats = a.kind === 'workout' ? detailStats(a.detail) : []

  function submit() {
    const t = text.trim()
    if (!t) return
    addComment.mutate({
      activity_id: a.id,
      text: t,
      author_name: profile?.display_name ?? user?.email?.split('@')[0] ?? undefined,
    })
    setText('')
  }

  return (
    <li className="card space-y-3" style={style}>
      <div className="flex items-center gap-3">
        <Avatar buddy={author.buddy} name={author.label} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{author.label}</div>
          <div className="truncate text-xs text-cocoa-muted">
            {label} · {timeAgo(a.created_at)}
          </div>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tint}`} aria-hidden>
          <Icon size={17} />
        </span>
      </div>

      {pr ? (
        <div className="flex items-center gap-3 rounded-xl bg-gold/10 px-3 py-2.5 ring-1 ring-gold/25">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gold">Neuer Rekord</div>
            <div className="truncate font-semibold leading-snug">{pr.exercise}</div>
          </div>
          {pr.value && (
            <div className="shrink-0 text-right leading-none">
              <span className="tabular text-xl font-bold text-gold">{pr.value}</span>
              {pr.unit && <div className="mt-0.5 text-[10px] font-medium text-cocoa-light">{pr.unit}</div>}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="font-semibold leading-snug">{a.title}</div>
          {stats.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stats.map((x) => (
                <span key={x} className="tabular rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-cocoa-light">
                  {x}
                </span>
              ))}
            </div>
          ) : (
            a.detail && <div className="tabular mt-0.5 text-sm text-cocoa-light">{a.detail}</div>
          )}
          {shared.length > 0 && (
            <div className="mt-3 space-y-2 rounded-xl bg-sand/60 p-3">
              <ul className="space-y-1 text-sm">
                {shared.slice(0, 6).map((x) => (
                  <li key={x.name} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{x.name}</span>
                    <span className="tabular shrink-0 text-xs text-cocoa-muted">
                      {x.sets} × {x.reps}
                      {x.weight ? ` · ${x.weight.toLocaleString('de-DE')} kg` : ''}
                    </span>
                  </li>
                ))}
                {shared.length > 6 && <li className="text-xs text-cocoa-muted">+ {shared.length - 6} weitere</li>}
              </ul>
              <button
                className="btn-primary w-full gap-1.5 py-2 text-sm"
                disabled={copy.isPending}
                onClick={() =>
                  copy.mutate(
                    { name: `Training von ${author.label}`, exercises: shared },
                    { onSuccess: (planId) => navigate(`/plans?edit=${planId}`) },
                  )
                }
              >
                <Dumbbell size={15} />
                {copy.isPending ? 'Wird übernommen…' : 'Training nachmachen'}
              </button>
              {copy.isError && <p className="text-xs text-red-500">Übernehmen fehlgeschlagen – bitte nochmal.</p>}
            </div>
          )}
        </div>
      )}

      {extras.length > 0 && (
        <ul className="space-y-1.5">
          {extras.map((x) => {
            const xpr = x.kind === 'pr' ? parsePr(x.title, x.detail) : null
            const xs = kindStyle(x.kind)
            return (
              <li key={x.id} className="flex items-center gap-2.5 rounded-xl bg-sand/70 px-3 py-2 text-sm">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${xs.tint}`} aria-hidden>
                  <xs.Icon size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {xpr ? (
                    <>
                      <span className="font-semibold">Rekord</span> · {xpr.exercise}
                    </>
                  ) : (
                    x.title
                  )}
                </span>
                {xpr?.value && (
                  <span className="tabular shrink-0 font-semibold text-gold">
                    {xpr.value}
                    {xpr.unit ? ` ${xpr.unit}` : ''}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center gap-1.5 border-t border-sand-dark/40 pt-2.5 text-sm">
        {REACTIONS.map((emo) => {
          const n = counts.get(emo) ?? 0
          const on = myReaction === emo
          return (
            <button
              key={emo}
              className={`flex h-8 items-center gap-1 rounded-full px-2.5 transition active:scale-90 ${
                on ? 'bg-brand/15 font-semibold text-brand ring-1 ring-brand/30' : 'bg-sand text-cocoa-light'
              }`}
              onClick={() => react.mutate({ activity_id: a.id, emoji: on ? null : emo })}
              aria-label={on ? `${emo} zurücknehmen` : `Mit ${emo} reagieren`}
              aria-pressed={on}
            >
              <span className="text-base leading-none">{emo}</span>
              {n > 0 && <span className="tabular text-xs">{n}</span>}
            </button>
          )
        })}
        <span className="flex-1" />
        <button
          className={`flex h-8 items-center gap-1.5 rounded-full px-2 ${open ? 'text-cocoa' : 'text-cocoa-light'}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="Kommentare"
          aria-expanded={open}
        >
          <MessageCircle size={17} />
          <span className="tabular">{comments.length || ''}</span>
        </button>
      </div>

      {open && (
        <div className="anim-fade space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-sand px-3 py-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {c.user_id === user?.id ? 'Du' : (c.author_name ?? 'Freund')}
                </span>
                <span className="shrink-0 text-[11px] text-cocoa-muted">{timeAgo(c.created_at)}</span>
              </div>
              <div className="text-cocoa-light">{c.text}</div>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              className="input py-2 text-sm"
              placeholder="Kommentar…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              aria-label="Kommentar"
            />
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40"
              onClick={submit}
              disabled={!text.trim() || addComment.isPending}
              aria-label="Senden"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Liste von Aktivitäten; lädt Kommentare & Likes gebündelt für alle. */
export function ActivityList({
  activities,
  authorOf,
}: {
  activities: Activity[]
  authorOf: (a: Activity) => AuthorInfo
}) {
  const ids = useMemo(() => activities.map((a) => a.id), [activities])
  const { data: comments } = useComments(ids)
  const { data: likes } = useLikes(ids)

  const byActivity = useMemo(() => {
    const c = new Map<string, ActivityComment[]>()
    const l = new Map<string, ActivityLike[]>()
    for (const x of comments ?? []) c.set(x.activity_id, [...(c.get(x.activity_id) ?? []), x])
    for (const x of likes ?? []) l.set(x.activity_id, [...(l.get(x.activity_id) ?? []), x])
    return { c, l }
  }, [comments, likes])

  return (
    <ul className="space-y-3">
      {activities.map((a, i) => (
        <ActivityCard
          key={a.id}
          style={{ animation: 'fade-in .3s ease-out both', animationDelay: `${Math.min(i, 8) * 45}ms` }}
          activity={a}
          author={authorOf(a)}
          comments={byActivity.c.get(a.id) ?? []}
          likes={byActivity.l.get(a.id) ?? []}
        />
      ))}
    </ul>
  )
}

/** Feed-Zusammenfassungen (eine Karte pro Freund und Tag); lädt Kommentare & Reaktionen gebündelt. */
export function DigestList({
  digests,
  authorOf,
}: {
  digests: { primary: Activity; extras: Activity[] }[]
  authorOf: (a: Activity) => AuthorInfo
}) {
  const ids = useMemo(() => digests.map((d) => d.primary.id), [digests])
  const { data: comments } = useComments(ids)
  const { data: likes } = useLikes(ids)
  const byActivity = useMemo(() => {
    const c = new Map<string, ActivityComment[]>()
    const l = new Map<string, ActivityLike[]>()
    for (const x of comments ?? []) c.set(x.activity_id, [...(c.get(x.activity_id) ?? []), x])
    for (const x of likes ?? []) l.set(x.activity_id, [...(l.get(x.activity_id) ?? []), x])
    return { c, l }
  }, [comments, likes])
  return (
    <ul className="space-y-3">
      {digests.map((d, i) => (
        <ActivityCard
          key={d.primary.id}
          style={{ animation: 'fade-in .3s ease-out both', animationDelay: `${Math.min(i, 8) * 45}ms` }}
          activity={d.primary}
          extras={d.extras}
          author={authorOf(d.primary)}
          comments={byActivity.c.get(d.primary.id) ?? []}
          likes={byActivity.l.get(d.primary.id) ?? []}
        />
      ))}
    </ul>
  )
}
