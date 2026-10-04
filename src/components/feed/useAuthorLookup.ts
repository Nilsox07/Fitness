import { useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/auth'
import { useLeaderboard } from '../../hooks/useSocial'
import type { Activity } from '../../hooks/useFeed'
import { buddyLook } from '../social/format'
import { useBuddySkin } from '../buddy/useBuddy'
import type { AuthorInfo } from './ActivityCard'

/** Autor einer Aktivität → Anzeigename („Du") + Buddy aus den geteilten Stats. */
export function useAuthorLookup(): (a: Activity) => AuthorInfo {
  const { user } = useAuth()
  const mySkin = useBuddySkin()
  const { data: board } = useLeaderboard()
  const byId = useMemo(() => new Map((board ?? []).map((u) => [u.user_id, u])), [board])
  return useCallback(
    (a: Activity) => {
      const me = a.user_id === user?.id
      const u = byId.get(a.user_id)
      return {
        label: me ? 'Du' : (a.author_name ?? u?.display_name ?? 'Freund'),
        buddy: u ? buddyLook(u, me, mySkin) : undefined,
      }
    },
    [byId, user?.id, mySkin],
  )
}
