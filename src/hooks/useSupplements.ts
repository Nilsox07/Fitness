import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { shiftDate } from '../lib/day'
import type { Supplement, SupplementLog } from '../lib/supplements'

const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /supplement/.test(e.message ?? ''))

const NOT_READY = 'Supplemente sind noch nicht eingerichtet (Migration 0035).'

export function useSupplements() {
  return useQuery({
    queryKey: ['supplements'],
    queryFn: async (): Promise<Supplement[]> => {
      const { data, error } = await supabase.from('supplements').select('*').order('position').order('created_at')
      if (error) {
        if (missing(error)) return []
        throw error
      }
      return data as Supplement[]
    },
  })
}

/** Abgehakte Einnahmen der letzten 7 Tage (bis `date`). */
export function useSupplementLog(date: string) {
  return useQuery({
    queryKey: ['supplement_log', date],
    queryFn: async (): Promise<SupplementLog[]> => {
      const { data, error } = await supabase
        .from('supplement_log')
        .select('supplement_id, date, slot')
        .gte('date', shiftDate(date, -6))
        .lte('date', date)
      if (error) {
        if (missing(error)) return []
        throw error
      }
      return data as SupplementLog[]
    },
  })
}

export function useSaveSupplement() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (s: Partial<Supplement> & Pick<Supplement, 'name' | 'dose' | 'times' | 'days' | 'remind'>) => {
      const row = { ...s, user_id: user!.id }
      const { error } = s.id
        ? await supabase.from('supplements').update(row).eq('id', s.id)
        : await supabase.from('supplements').insert(row)
      if (error) throw missing(error) ? new Error(NOT_READY) : error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })
}

export function useDeleteSupplement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('supplements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })
}

/** Einnahme abhaken bzw. wieder entfernen (optimistisch). */
export function useToggleDose() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({
      supplementId,
      date,
      slot,
      taken,
    }: {
      supplementId: string
      date: string
      slot: string
      taken: boolean
    }) => {
      const { error } = taken
        ? await supabase
            .from('supplement_log')
            .upsert(
              { user_id: user!.id, supplement_id: supplementId, date, slot },
              { onConflict: 'supplement_id,date,slot' },
            )
        : await supabase.from('supplement_log').delete().match({ supplement_id: supplementId, date, slot })
      if (error) throw error
    },
    onMutate: async ({ supplementId, date, slot, taken }) => {
      const key = ['supplement_log', date]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<SupplementLog[]>(key)
      const rest = (prev ?? []).filter((l) => !(l.supplement_id === supplementId && l.date === date && l.slot === slot))
      qc.setQueryData<SupplementLog[]>(key, taken ? [...rest, { supplement_id: supplementId, date, slot }] : rest)
      return { prev, key }
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(ctx.key, ctx.prev),
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ['supplement_log', v.date] }),
  })
}
