import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
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
          className={iLiked ? 'font-semibold text-brand' : 'text-cocoa-light'}
          onClick={() => toggleLike.mutate({ activity_id: a.id, liked: iLiked })}
        >
          👏 {likeCount || ''}
        </button>
        <button className="text-cocoa-light" onClick={() => setOpen((o) => !o)}>
          💬 {comments?.length || ''}
        </button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-sand-dark pt-2">
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
            <button className="btn-primary shrink-0" onClick={submit}>
              ➤
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function Feed() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: activities, isLoading } = useActivities()

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button className="btn-ghost px-3 text-base" onClick={() => navigate(-1)} aria-label="Zurück">
          ←
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
