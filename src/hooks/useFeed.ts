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
  /** Nur Trainings: Übungen zum Nachmachen (Migration 0030) */
  meta?: { exercises?: SharedExercise[] } | null
}
export interface SharedExercise {
  name: string
  muscle_group?: string | null
  sets: number
  reps: number
  weight: number
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
  /** 💪 🔥 👏 (fehlt vor Migration 0030 → 👏) */
  emoji?: string | null
  created_at?: string
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
        .select('*')
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
    mutationFn: async (input: {
      kind: string
      title: string
      detail?: string
      author_name?: string
      meta?: Activity['meta']
    }) => {
      const { error } = await supabase.from('activities').insert({ user_id: user!.id, ...input })
      if (!error) return
      // Spalte meta fehlt noch (Migration 0030) → ohne Übungsliste posten.
      if (input.meta && (error.code === 'PGRST204' || error.code === '42703' || /meta/.test(error.message))) {
        const { meta: _m, ...rest } = input
        void _m
        const retry = await supabase.from('activities').insert({ user_id: user!.id, ...rest })
        if (retry.error) throw retry.error
        return
      }
      throw error
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

export const REACTIONS = ['💪', '🔥', '👏'] as const
export type Reaction = (typeof REACTIONS)[number]

/** Reaktion einer Person (alte Likes ohne Emoji zählen als 👏). */
export function reactionOf(l: ActivityLike): Reaction {
  return (REACTIONS as readonly string[]).includes(l.emoji ?? '') ? (l.emoji as Reaction) : '👏'
}

type LikesSnapshot = [readonly unknown[], ActivityLike[] | undefined][]

// Spalte emoji (Migration 0030) fehlt? Dann ohne Emoji speichern (zählt als 👏).
let emojiColumnMissing = false
const missingEmoji = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST204' || e.code === '42703' || /emoji/.test(e.message ?? ''))

/** Reaktion setzen, wechseln oder (emoji = null) entfernen — optimistisch, bei Fehler zurückgerollt. */
export function useReact() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation<void, Error, { activity_id: string; emoji: Reaction | null }, { prev: LikesSnapshot }>({
    mutationFn: async ({ activity_id, emoji }) => {
      if (!emoji) {
        const { error } = await supabase
          .from('activity_likes')
          .delete()
          .eq('activity_id', activity_id)
          .eq('user_id', user!.id)
        if (error) throw error
        return
      }
      if (!emojiColumnMissing) {
        const { error } = await supabase
          .from('activity_likes')
          .upsert({ activity_id, user_id: user!.id, emoji }, { onConflict: 'activity_id,user_id' })
        if (!error) return
        if (!missingEmoji(error)) throw error
        emojiColumnMissing = true
      }
      const { error } = await supabase
        .from('activity_likes')
        .upsert({ activity_id, user_id: user!.id }, { onConflict: 'activity_id,user_id' })
      if (error) throw error
    },
    onMutate: async ({ activity_id, emoji }) => {
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
          return emoji ? [...without, { activity_id, user_id: uid, emoji }] : without
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

/** Klassische App: einfacher Applaus an/aus (= 👏-Reaktion). */
export function useToggleLike() {
  const react = useReact()
  return {
    ...react,
    mutate: ({ activity_id, liked }: { activity_id: string; liked: boolean }) =>
      react.mutate({ activity_id, emoji: liked ? null : '👏' }),
  }
}
