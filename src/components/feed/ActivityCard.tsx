import { useMemo, useState } from 'react'
import {
  Activity as ActivityIcon,
  Dumbbell,
  Heart,
  MessageCircle,
  Send,
  Star,
  Trophy,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useMyProfile } from '../../hooks/useSocial'
import {
  useAddComment,
  useComments,
  useLikes,
  useToggleLike,
  type Activity,
  type ActivityComment,
  type ActivityLike,
} from '../../hooks/useFeed'
import { Avatar } from '../social/Avatar'
import { timeAgo, type BuddyLook } from '../social/format'

/** Autor-Anzeige: Name + Buddy (falls die Stats bekannt sind). */
export interface AuthorInfo {
  label: string
  buddy?: BuddyLook
}

function kindIcon(kind: string): { Icon: LucideIcon; className: string } {
  const k = kind.toLowerCase()
  if (k === 'pr' || k.includes('record') || k.includes('rekord'))
    return { Icon: Trophy, className: 'text-gold' }
  if (k.includes('level')) return { Icon: Star, className: 'text-gold' }
  if (k === 'cheat' || k.includes('food') || k.includes('meal') || k.includes('nutrition'))
    return { Icon: Utensils, className: 'text-cocoa-light' }
  if (k.includes('workout') || k.includes('training'))
    return { Icon: Dumbbell, className: 'text-cocoa-light' }
  return { Icon: ActivityIcon, className: 'text-cocoa-light' }
}

/** Eine Aktivität im Strava-Stil: Autor, Art, Inhalt, Applaus & Kommentare. */
export function ActivityCard({
  activity: a,
  author,
  comments,
  likes,
}: {
  activity: Activity
  author: AuthorInfo
  comments: ActivityComment[]
  likes: ActivityLike[]
}) {
  const { user } = useAuth()
  const { data: profile } = useMyProfile()
  const toggleLike = useToggleLike()
  const addComment = useAddComment()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const iLiked = likes.some((l) => l.user_id === user?.id)
  const { Icon, className } = kindIcon(a.kind)

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
    <li className="card space-y-3">
      <div className="flex items-center gap-2.5">
        <Avatar buddy={author.buddy} name={author.label} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{author.label}</div>
          <div className="text-xs text-cocoa-muted">{timeAgo(a.created_at)}</div>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand">
          <Icon size={16} className={className} />
        </span>
      </div>

      <div>
        <div className="font-semibold leading-snug">{a.title}</div>
        {a.detail && <div className="tabular mt-0.5 text-sm text-cocoa-light">{a.detail}</div>}
      </div>

      <div className="flex items-center gap-5 border-t border-sand-dark/40 pt-2.5 text-sm">
        <button
          className={`flex items-center gap-1.5 transition-colors duration-200 ${
            iLiked ? 'font-semibold text-brand' : 'text-cocoa-light'
          }`}
          onClick={() => toggleLike.mutate({ activity_id: a.id, liked: iLiked })}
          disabled={toggleLike.isPending}
          aria-label={iLiked ? 'Applaus zurücknehmen' : 'Applaus'}
          aria-pressed={iLiked}
        >
          <Heart size={17} fill={iLiked ? 'currentColor' : 'none'} />
          <span className="tabular">{likes.length || ''}</span>
        </button>
        <button
          className={`flex items-center gap-1.5 ${open ? 'text-cocoa' : 'text-cocoa-light'}`}
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
      {activities.map((a) => (
        <ActivityCard
          key={a.id}
          activity={a}
          author={authorOf(a)}
          comments={byActivity.c.get(a.id) ?? []}
          likes={byActivity.l.get(a.id) ?? []}
        />
      ))}
    </ul>
  )
}
