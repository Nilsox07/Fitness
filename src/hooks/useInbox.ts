import { useMemo, useSyncExternalStore } from 'react'
import { useAuth } from '../lib/auth'
import { useActivities, useComments, useLikes, reactionOf } from './useFeed'
import { useKudos, usePokes } from './useSocial'

export type InboxItem =
  | { key: string; type: 'poke'; id: string; from: string; text: string | null; at: string }
  | { key: string; type: 'kudos'; from: string; at: string }
  | { key: string; type: 'comment'; from: string; text: string; activity: string; at: string }
  | { key: string; type: 'reaction'; from: string; emoji: string; activity: string; at: string }

const SEEN_KEY = 'inbox_seen_at'
const MAX_AGE_MS = 14 * 86400000
const listeners = new Set<() => void>()

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Glocke geöffnet → alles bis jetzt gilt als gelesen. */
export function markInboxSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

/**
 * Alle Benachrichtigungen an einem Ort: Anstupser, Kudos, Kommentare und
 * Reaktionen von Freunden auf meine Einträge (letzte 14 Tage), neueste zuerst.
 */
export function useInbox() {
  const { user } = useAuth()
  const me = user?.id
  const { data: pokes } = usePokes()
  const { data: kudos } = useKudos()
  const { data: activities } = useActivities()
  const mine = useMemo(() => (activities ?? []).filter((a) => a.user_id === me), [activities, me])
  const ids = useMemo(() => mine.map((a) => a.id), [mine])
  const titleOf = useMemo(() => new Map(mine.map((a) => [a.id, a.title])), [mine])
  const { data: comments } = useComments(ids)
  const { data: likes } = useLikes(ids)
  const seen = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    readSeen,
  )

  const items = useMemo<InboxItem[]>(() => {
    const out: InboxItem[] = []
    for (const p of pokes ?? [])
      out.push({ key: `p${p.id}`, type: 'poke', id: p.id, from: p.from_user, text: p.text, at: p.created_at })
    for (const k of kudos ?? [])
      if (k.to_user === me && k.created_at)
        out.push({ key: `k${k.from_user}${k.created_at}`, type: 'kudos', from: k.from_user, at: k.created_at })
    for (const c of comments ?? [])
      if (c.user_id !== me)
        out.push({
          key: `c${c.id}`,
          type: 'comment',
          from: c.user_id,
          text: c.text,
          activity: titleOf.get(c.activity_id) ?? '',
          at: c.created_at,
        })
    for (const l of likes ?? [])
      if (l.user_id !== me && l.created_at)
        out.push({
          key: `l${l.activity_id}${l.user_id}`,
          type: 'reaction',
          from: l.user_id,
          emoji: reactionOf(l),
          activity: titleOf.get(l.activity_id) ?? '',
          at: l.created_at,
        })
    const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString()
    return out.filter((x) => x.at >= cutoff).sort((a, b) => b.at.localeCompare(a.at))
  }, [pokes, kudos, comments, likes, me, titleOf])

  const unread = items.filter((x) => x.at > seen).length
  return { items, unread, seen }
}
