import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Hand, MessageCircle, Send } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'
import { dayLabel, localDate } from '../lib/day'
import { ActivityList } from '../components/feed/ActivityCard'
import { useAuthorLookup } from '../components/feed/useAuthorLookup'
import {
  useActivities,
  useAddComment,
  useComments,
  useLikes,
  useToggleLike,
  type Activity,
} from '../hooks/useFeed'
import { useMyProfile } from '../hooks/useSocial'

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000)
  if (s < 3600) return `vor ${Math.max(1, Math.floor(s / 60))} Min`
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std`
  return `vor ${Math.floor(s / 86400)} Tg`
}

/** Zurück innerhalb der App; ohne App-Verlauf (Direktaufruf/Push) zur Startseite. */
function useGoBack() {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/')
  }
}

function ActivityItem({ a, authorLabel }: { a: Activity; authorLabel: string }) {
  const { user } = useAuth()
  const { data: profile } = useMyProfile()
  const ids = useMemo(() => [a.id], [a.id])
  const { data: comments } = useComments(ids)
  const { data: likes } = useLikes(ids)
  const toggleLike = useToggleLike()
  const addComment = useAddComment()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  const likeCount = likes?.length ?? 0
  const iLiked = (likes ?? []).some((l) => l.user_id === user?.id)

  function submit() {
    if (!text.trim()) return
    addComment.mutate({
      activity_id: a.id,
      text: text.trim(),
      author_name: profile?.display_name ?? user?.email?.split('@')[0] ?? undefined,
    })
    setText('')
  }

  return (
    <li className="card space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{authorLabel}</span>
        <span className="text-xs text-cocoa-muted">{timeAgo(a.created_at)}</span>
      </div>
      <div>
        <div className="font-medium">{a.title}</div>
        {a.detail && <div className="text-sm text-cocoa-light">{a.detail}</div>}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button
          className={`flex items-center gap-1.5 transition-colors duration-200 ${
            iLiked ? 'font-semibold text-brand' : 'text-cocoa-light'
          }`}
          onClick={() => toggleLike.mutate({ activity_id: a.id, liked: iLiked })}
          disabled={toggleLike.isPending}
          aria-label="Applaus"
        >
          <Hand size={16} />
          <span className="tabular">{likeCount || ''}</span>
        </button>
        <button
          className="flex items-center gap-1.5 text-cocoa-light"
          onClick={() => setOpen((o) => !o)}
          aria-label="Kommentare"
        >
          <MessageCircle size={16} />
          <span className="tabular">{comments?.length || ''}</span>
        </button>
      </div>

      {open && (
        <div className="anim-fade space-y-2 rounded-xl bg-sand p-2.5">
          {comments?.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium">{c.author_name ?? 'Freund'}:</span>{' '}
              <span className="text-cocoa-light">{c.text}</span>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Kommentar…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <button className="btn-primary shrink-0" onClick={submit} aria-label="Senden">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function Feed() {
  const { isNew } = usePrefs()
  return isNew ? <FeedNew /> : <FeedClassic />
}

/** Neues Design: Aktivitäten nach Tagen gruppiert, gleiche Karten wie in der Community. */
function FeedNew() {
  const goBack = useGoBack()
  const { data: activities, isLoading } = useActivities()
  const authorOf = useAuthorLookup()

  const groups = useMemo(() => {
    const out: { day: string; items: Activity[] }[] = []
    for (const a of activities ?? []) {
      const day = localDate(new Date(a.created_at))
      const last = out[out.length - 1]
      if (last && last.day === day) last.items.push(a)
      else out.push({ day, items: [a] })
    }
    return out
  }, [activities])

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <button
          className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa"
          onClick={goBack}
          aria-label="Zurück"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Aktivitäten</h1>
      </header>

      {isLoading && <p className="text-sm text-cocoa-light">Lädt…</p>}

      {groups.map((g) => (
        <section key={g.day} className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-cocoa-light">{dayLabel(g.day)}</h2>
          <ActivityList activities={g.items} authorOf={authorOf} />
        </section>
      ))}

      {activities?.length === 0 && !isLoading && (
        <div className="card text-center text-sm text-cocoa-light">
          Noch nichts los. Schließ ein Training ab oder füg Freunde hinzu.
        </div>
      )}
    </div>
  )
}

function FeedClassic() {
  const goBack = useGoBack()
  const { user } = useAuth()
  const { data: activities, isLoading } = useActivities()

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button className="btn-ghost px-3 text-base" onClick={goBack} aria-label="Zurück">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Feed</h1>
      </header>

      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      <ul className="space-y-2">
        {activities?.map((a) => (
          <ActivityItem
            key={a.id}
            a={a}
            authorLabel={a.user_id === user?.id ? 'Du' : a.author_name ?? 'Freund'}
          />
        ))}
        {activities?.length === 0 && !isLoading && (
          <li className="text-sm text-cocoa-light">
            Noch nichts los. Schließ ein Training ab oder füg Freunde hinzu.
          </li>
        )}
      </ul>
    </div>
  )
}
