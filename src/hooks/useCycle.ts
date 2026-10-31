import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'
import { localDate } from '../lib/day'
import { cycleState, type Period } from '../lib/cycle'

export interface CyclePeriodRow extends Period {
  id: string
  source: 'manual' | 'health'
}

const KEY = ['cycle_periods'] as const

/** Eingetragene Perioden (nur mit Zyklus-Bereich; fehlt die Tabelle noch → leer). */
export function useCyclePeriods() {
  const { user } = useAuth()
  const { hasCycle } = usePrefs()
  return useQuery({
    queryKey: KEY,
    enabled: !!user && hasCycle,
    queryFn: async (): Promise<CyclePeriodRow[]> => {
      const { data, error } = await supabase
        .from('cycle_periods')
        .select('id, start_date, end_date, source')
        .order('start_date', { ascending: false })
        .limit(40)
      if (error) return []
      return (data ?? []) as CyclePeriodRow[]
    },
  })
}

/** Aktueller Zyklus-Stand (null ohne Bereich oder ohne Daten). */
export function useCycleState(today = localDate()) {
  const { hasCycle } = usePrefs()
  const { data } = useCyclePeriods()
  return useMemo(() => (hasCycle && data ? cycleState(data, today) : null), [hasCycle, data, today])
}

/** Periode beginnt (heute oder an einem Datum) bzw. endet. */
export function useCycleActions() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const done = () => qc.invalidateQueries({ queryKey: KEY })

  const start = useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase
        .from('cycle_periods')
        .upsert(
          { user_id: user!.id, start_date: date, end_date: null, source: 'manual' },
          { onConflict: 'user_id,start_date' },
        )
      if (error) throw error
    },
    onSuccess: done,
  })
  const end = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const { error } = await supabase.from('cycle_periods').update({ end_date: date }).eq('id', id)
      if (error) throw error
    },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cycle_periods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: done,
  })
  /** Alle Zyklusdaten löschen (Perioden + Symptome). */
  const wipe = useMutation({
    mutationFn: async () => {
      await supabase.from('cycle_periods').delete().eq('user_id', user!.id)
      await supabase.from('cycle_logs').delete().eq('user_id', user!.id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      void qc.invalidateQueries({ queryKey: ['cycle_logs'] })
    },
  })
  return { start, end, remove, wipe }
}

/** Symptome eines Tages. */
export function useCycleLog(date: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { hasCycle } = usePrefs()
  const query = useQuery({
    queryKey: ['cycle_logs', date],
    enabled: !!user && hasCycle,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('cycle_logs').select('symptoms').eq('date', date).maybeSingle()
      if (error) return []
      return (data?.symptoms as string[] | undefined) ?? []
    },
  })
  const set = useMutation({
    mutationFn: async (symptoms: string[]) => {
      const { error } = await supabase
        .from('cycle_logs')
        .upsert({ user_id: user!.id, date, symptoms }, { onConflict: 'user_id,date' })
      if (error) throw error
    },
    onMutate: (symptoms) => qc.setQueryData(['cycle_logs', date], symptoms),
    onSettled: () => qc.invalidateQueries({ queryKey: ['cycle_logs', date] }),
  })
  return { symptoms: query.data ?? [], set }
}
