import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { BodyWeight } from '../types'

export function useBodyWeights() {
  return useQuery({
    queryKey: ['body_weights'],
    queryFn: async (): Promise<BodyWeight[]> => {
      const { data, error } = await supabase
        .from('body_weights')
        .select('*')
        .order('date', { ascending: true })
      if (error) throw error
      return data as BodyWeight[]
    },
  })
}

export function useUpsertBodyWeight() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { date: string; weight_kg: number }) => {
      const { data, error } = await supabase
        .from('body_weights')
        .upsert({ ...input, user_id: user!.id }, { onConflict: 'user_id,date' })
        .select()
        .single()
      if (error) throw error
      return data as BodyWeight
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['body_weights'] }),
  })
}
