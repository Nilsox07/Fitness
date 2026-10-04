import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'

export interface Activity {
  id: string
  user_id: string
  author_name: string | null
  kind: string
  title: string
  detail: string | null
  created_at: string
}
export interface ActivityComment {
  id: string
  activity_id: string
  user_id: string
  author_name: string | null
  text: string
  created_at: string
}
export interface ActivityLike {
  activity_id: string
  user_id: string
}

/** Cheat-Meal-Posts ausblenden (Ernährung ist aus). Stabil für `select`. */
const withoutCheat = (list: Activity[]) => list.filter((a) => a.kind !== 'cheat')

export function useActivities() {
  const { showNutrition } = usePrefs()
  return useQuery({
    queryKey: ['activities'],
    select: showNutrition ? undefined : withoutCheat,
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Activity[]
    },
  })
}

export function useComments(activityIds: string[]) {
  return useQuery({
    queryKey: ['activity_comments', activityIds.join(',')],
    enabled: activityIds.length > 0,
    queryFn: async (): Promise<ActivityComment[]> => {
      const { data, error } = await supabase
        .from('activity_comments')
        .select('*')
        .in('activity_id', activityIds)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ActivityComment[]
    },
  })
}

export function useLikes(activityIds: string[]) {
  return useQuery({
    queryKey: ['activity_likes', activityIds.join(',')],
    enabled: activityIds.length > 0,
    queryFn: async (): Promise<ActivityLike[]> => {
      const { data, error } = await supabase
        .from('activity_likes')
        .select('activity_id, user_id')
        .in('activity_id', activityIds)
      if (error) throw error
      return data as ActivityLike[]
    },
  })
}

export function usePostActivity() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { kind: string; title: string; detail?: string; author_name?: string }) => {
      const { error } = await supabase.from('activities').insert({ user_id: user!.id, ...input })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { activity_id: string; text: string; author_name?: string }) => {
      const { error } = await supabase
        .from('activity_comments')
        .insert({ user_id: user!.id, ...input })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity_comments'] }),
  })
}

type LikesSnapshot = [readonly unknown[], ActivityLike[] | undefined][]

/** Applaus an/aus — optimistisch (sofort sichtbar), bei Fehler zurückgerollt. */
export function useToggleLike() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation<void, Error, { activity_id: string; liked: boolean }, { prev: LikesSnapshot }>({
    mutationFn: async ({ activity_id, liked }: { activity_id: string; liked: boolean }) => {
      if (liked) {
        const { error } = await supabase
          .from('activity_likes')
          .delete()
          .eq('activity_id', activity_id)
          .eq('user_id', user!.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('activity_likes')
          .insert({ activity_id, user_id: user!.id })
        if (error) throw error
      }
    },
    onMutate: async ({ activity_id, liked }) => {
      await qc.cancelQueries({ queryKey: ['activity_likes'] })
      const prev = qc.getQueriesData<ActivityLike[]>({ queryKey: ['activity_likes'] })
      const uid = user?.id
      if (uid) {
        // Nur Caches anfassen, die diese Aktivität enthalten (Schlüssel = ID-Liste).
        const filters = {
          queryKey: ['activity_likes'],
          predicate: (q: { queryKey: readonly unknown[] }) =>
            String(q.queryKey[1] ?? '').split(',').includes(activity_id),
        }
        qc.setQueriesData<ActivityLike[]>(filters, (old) => {
          if (!old) return old
          const without = old.filter((l) => !(l.activity_id === activity_id && l.user_id === uid))
          return liked ? without : [...without, { activity_id, user_id: uid }]
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) qc.setQueryData(key, data)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['activity_likes'] }),
  })
}
