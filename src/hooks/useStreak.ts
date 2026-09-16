import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export interface StreakState {
  user_id: string
  freezes: number
  frozen_weeks: string[]
  last_award_week: string | null
}

export function useStreakState() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['streak_state', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<StreakState | null> => {
      const { data, error } = await supabase
        .from('streak_state')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return (data as StreakState | null) ?? null
    },
  })
}

export function useUpdateStreakState() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<StreakState, 'user_id'>>) => {
      const { error } = await supabase
        .from('streak_state')
        .upsert({ user_id: user!.id, ...patch, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['streak_state'] }),
  })
}
