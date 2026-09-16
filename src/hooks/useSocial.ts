import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface UserStat {
  user_id: string
  display_name: string | null
  total_sessions: number
  week_streak: number
  tonnage: number
  weekly_volume: number
  last_workout: string | null
  rank_title: string | null
  level: number
  xp: number
}

export function useMyProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, friend_code')
        .eq('id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data as { id: string; display_name: string | null; friend_code: string | null } | null
    },
  })
}

/** Leaderboard = eigene + befreundete user_stats (per RLS sichtbar). */
export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async (): Promise<UserStat[]> => {
      const { data, error } = await supabase.from('user_stats').select('*')
      if (error) throw error
      return data as UserStat[]
    },
  })
}

export function useAddFriend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc('add_friend', { code: code.trim() })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaderboard'] }),
  })
}

/** Eigene Aggregat-Statistik teilen (upsert). */
export function useSyncMyStats() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (stats: Omit<UserStat, 'user_id'>) => {
      const { error } = await supabase
        .from('user_stats')
        .upsert({ user_id: user!.id, ...stats, updated_at: new Date().toISOString() })
      if (error) throw error
    },
  })
}

export function useKudos() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['kudos', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from('kudos').select('from_user, to_user')
      if (error) throw error
      return data as { from_user: string; to_user: string }[]
    },
  })
}

export function useGiveKudos() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (toUser: string) => {
      const { error } = await supabase.from('kudos').insert({ from_user: user!.id, to_user: toUser })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kudos'] }),
  })
}
