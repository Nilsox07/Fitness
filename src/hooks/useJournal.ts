// Journal-Einträge (Tabelle journal_entries, Migration 0046). Fehlt die Tabelle noch → leer.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { localDate, shiftDate } from '../lib/day'
import type { JournalEntry } from '../lib/journal'

const KEY = ['journal'] as const

/** Einträge der letzten 120 Tage (aufsteigend). */
export function useJournal() {
  const { user } = useAuth()
  return useQuery({
    queryKey: KEY,
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<JournalEntry[]> => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('date, tags, feel')
        .gte('date', shiftDate(localDate(), -120))
        .order('date')
      if (error) return []
      return (data ?? []).map((r) => ({
        date: r.date as string,
        tags: (r.tags as string[] | null) ?? [],
        feel: (r.feel as number | null) ?? null,
      }))
    },
  })
}

/** Eintrag eines Tages ändern (Gewohnheiten und/oder Gefühl) – sofort sichtbar, dann gespeichert. */
export function useSaveJournal() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (e: JournalEntry) => {
      const { error } = await supabase
        .from('journal_entries')
        .upsert(
          { user_id: user!.id, date: e.date, tags: e.tags, feel: e.feel, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,date' },
        )
      if (error) throw error
    },
    onMutate: (e) => {
      qc.setQueryData<JournalEntry[]>(KEY, (old = []) =>
        [...old.filter((x) => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date)),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
