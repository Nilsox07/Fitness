// Manuell eingetragene Aktivitäten (Tabelle manual_activities, Migration 0047). Fehlt die Tabelle → leer.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { localDate, shiftDate } from '../lib/day'
import type { ManualActivity } from '../lib/sports'

const KEY = ['manual_activities'] as const

export function useManualActivities() {
  const { user } = useAuth()
  return useQuery({
    queryKey: KEY,
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<ManualActivity[]> => {
      const { data, error } = await supabase
        .from('manual_activities')
        .select('id, date, sport, minutes, intensity, distance_km, kcal, note, created_at')
        .gte('date', shiftDate(localDate(), -180))
        .order('date', { ascending: false })
      if (error) return []
      return (data ?? []).map((r) => ({
        ...r,
        distance_km: r.distance_km == null ? null : Number(r.distance_km),
      })) as ManualActivity[]
    },
  })
}

export type NewActivity = Omit<ManualActivity, 'id' | 'created_at'>

export function useAddManualActivity() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (a: NewActivity) => {
      const { error } = await supabase.from('manual_activities').insert({ ...a, user_id: user!.id })
      if (error) throw error
    },
    onMutate: (a) => {
      const tmp: ManualActivity = { ...a, id: `tmp-${Date.now()}`, created_at: new Date().toISOString() }
      qc.setQueryData<ManualActivity[]>(KEY, (old = []) => [tmp, ...old])
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteManualActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('manual_activities').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) => qc.setQueryData<ManualActivity[]>(KEY, (old = []) => old.filter((a) => a.id !== id)),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
