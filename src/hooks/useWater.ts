import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { WaterIntake } from '../types'

export function useWater(date: string) {
  return useQuery({
    queryKey: ['water', date],
    queryFn: async (): Promise<WaterIntake | null> => {
      const { data, error } = await supabase
        .from('water_intake')
        .select('*')
        .eq('date', date)
        .maybeSingle()
      if (error) throw error
      return (data as WaterIntake | null) ?? null
    },
  })
}

export function useSetWater() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { date: string; ml: number }) => {
      const { data, error } = await supabase
        .from('water_intake')
        .upsert({ user_id: user!.id, date: input.date, ml: Math.max(0, input.ml) }, { onConflict: 'user_id,date' })
        .select()
        .single()
      if (error) throw error
      return data as WaterIntake
    },
    onSuccess: (w) => qc.invalidateQueries({ queryKey: ['water', w.date] }),
  })
}
