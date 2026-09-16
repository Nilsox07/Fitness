import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

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

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
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

export function useToggleLike() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity_likes'] }),
  })
}
