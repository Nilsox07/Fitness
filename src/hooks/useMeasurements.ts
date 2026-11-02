import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { MeasureKey, MeasurementRow } from '../lib/measurements'

/** Fehlt die Tabelle noch (Migration 0041 nicht ausgeführt)? */
export function isMissingMeasurementsTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /body_measurements/.test(err.message ?? ''))
}

/** Alle Körpermaße, nach Datum aufsteigend. Ohne Tabelle: leere Liste. */
export function useMeasurements() {
  return useQuery({
    queryKey: ['body_measurements'],
    queryFn: async (): Promise<MeasurementRow[]> => {
      const { data, error } = await supabase
        .from('body_measurements')
        .select('id,date,waist,chest,arm,hip,thigh')
        .order('date', { ascending: true })
      if (error) {
        if (isMissingMeasurementsTable(error)) return []
        throw error
      }
      // numeric kommt je nach Client als Text → in Zahlen umwandeln
      return (data ?? []).map((r) => {
        const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))
        return {
          id: r.id as string,
          date: r.date as string,
          waist: n(r.waist),
          chest: n(r.chest),
          arm: n(r.arm),
          hip: n(r.hip),
          thigh: n(r.thigh),
        }
      })
    },
  })
}

/**
 * Maße eines Tages speichern. Nur die übergebenen Maße werden gesetzt –
 * bereits eingetragene Werte desselben Tages bleiben erhalten.
 */
export function useSaveMeasurements() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { date: string; values: Partial<Record<MeasureKey, number>> }) => {
      const { error } = await supabase
        .from('body_measurements')
        .upsert({ user_id: user!.id, date: input.date, ...input.values }, { onConflict: 'user_id,date' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['body_measurements'] }),
  })
}
