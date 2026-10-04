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

/** Alle Wasser-Tage (für Auswertung/Gamification). */
export function useAllWater() {
  return useQuery({
    queryKey: ['water', 'all'],
    queryFn: async (): Promise<WaterIntake[]> => {
      const { data, error } = await supabase
        .from('water_intake')
        .select('*')
        .order('date', { ascending: true })
      if (error) throw error
      return data as WaterIntake[]
    },
  })
}

type WaterCtx = { prevDay: WaterIntake | null | undefined; prevAll: WaterIntake[] | undefined }

export function useSetWater() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation<WaterIntake, Error, { date: string; ml: number }, WaterCtx>({
    mutationKey: ['water', 'set'],
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('water_intake')
        .upsert({ user_id: user!.id, date: input.date, ml: Math.max(0, input.ml) }, { onConflict: 'user_id,date' })
        .select()
        .single()
      if (error) throw error
      return data as WaterIntake
    },
    // Optimistisch: schnelle Taps bauen auf dem neuen Wert auf statt auf dem alten.
    onMutate: async (input) => {
      const ml = Math.max(0, input.ml)
      await qc.cancelQueries({ queryKey: ['water', input.date] })
      await qc.cancelQueries({ queryKey: ['water', 'all'] })
      const prevDay = qc.getQueryData<WaterIntake | null>(['water', input.date])
      const prevAll = qc.getQueryData<WaterIntake[]>(['water', 'all'])
      const next = { ...(prevDay ?? { user_id: user?.id ?? '', date: input.date }), ml } as WaterIntake
      qc.setQueryData<WaterIntake | null>(['water', input.date], next)
      if (prevAll) {
        const exists = prevAll.some((w) => w.date === input.date)
        qc.setQueryData<WaterIntake[]>(
          ['water', 'all'],
          exists
            ? prevAll.map((w) => (w.date === input.date ? { ...w, ml } : w))
            : [...prevAll, next].sort((a, b) => a.date.localeCompare(b.date)),
        )
      }
      return { prevDay, prevAll }
    },
    onError: (_e, input, ctx) => {
      if (!ctx) return
      qc.setQueryData(['water', input.date], ctx.prevDay ?? null)
      if (ctx.prevAll) qc.setQueryData(['water', 'all'], ctx.prevAll)
    },
    onSettled: () => {
      // Erst neu laden, wenn kein weiterer Tap mehr unterwegs ist — sonst überschreibt
      // ein älterer Serverstand kurz den optimistischen Wert.
      if (qc.isMutating({ mutationKey: ['water', 'set'] }) <= 1) {
        qc.invalidateQueries({ queryKey: ['water'] })
      }
    },
  })
}
