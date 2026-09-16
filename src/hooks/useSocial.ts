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
  weekly_sessions: number
  gym_status: string | null
  season_id: string | null
  season_xp: number
  monthly_prs: number
  protein_today: number
  kcal_today: number
  protein_week: number
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
    mutationFn: async (stats: Omit<UserStat, 'user_id' | 'gym_status'>) => {
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

export function useSetGymStatus() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from('user_stats')
        .upsert({ user_id: user!.id, gym_status: status, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaderboard'] }),
  })
}

/** Eingehende Anstupser (an mich). */
export function usePokes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pokes', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pokes')
        .select('id, from_user, text, created_at')
        .eq('to_user', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as { id: string; from_user: string; text: string | null; created_at: string }[]
    },
  })
}

export function useSendPoke() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { toUser: string; text?: string }) => {
      const { error } = await supabase
        .from('pokes')
        .insert({ from_user: user!.id, to_user: input.toUser, text: input.text ?? null })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pokes'] }),
  })
}

export function useDismissPoke() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pokes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pokes'] }),
  })
}
