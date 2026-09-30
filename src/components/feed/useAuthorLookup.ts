import { useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/auth'
import { useLeaderboard } from '../../hooks/useSocial'
import type { Activity } from '../../hooks/useFeed'
import { avatarEmoji } from '../social/format'
import type { AuthorInfo } from './ActivityCard'

/** Autor einer Aktivität → Anzeigename („Du") + Maskottchen aus den geteilten Stats. */
export function useAuthorLookup(): (a: Activity) => AuthorInfo {
  const { user } = useAuth()
  const { data: board } = useLeaderboard()
  const byId = useMemo(() => new Map((board ?? []).map((u) => [u.user_id, u])), [board])
  return useCallback(
    (a: Activity) => {
      const me = a.user_id === user?.id
      const u = byId.get(a.user_id)
      return {
        label: me ? 'Du' : (a.author_name ?? u?.display_name ?? 'Freund'),
        emoji: u ? avatarEmoji(u, me) : undefined,
      }
    },
    [byId, user?.id],
  )
}
