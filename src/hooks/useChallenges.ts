import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAllSets } from './useWorkouts'
import { useAllFoodEntries, useNutritionSettings } from './useNutrition'
import { ownValue, weekEnd, weekStartOf, type Challenge, type ChallengeKind } from '../lib/stakes'
import { localDate, shiftDate } from '../lib/day'

/** Fehlt die Tabelle noch (Migration 0034)? */
const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /challenges/.test(e.message ?? ''))

/** Challenges dieser und der letzten Woche (für den Ausgang). */
export function useChallenges() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['challenges', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Challenge[]> => {
      const since = shiftDate(weekStartOf(localDate()), -7)
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .gte('week_start', since)
        .neq('status', 'declined')
        .order('created_at', { ascending: false })
      if (error) {
        if (missing(error)) return []
        throw error
      }
      return data as Challenge[]
    },
  })
}

export function useCreateChallenge() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { opponent: string; kind: ChallengeKind; target: number; stake: string }) => {
      const { error } = await supabase.from('challenges').insert({
        ...input,
        creator: user!.id,
        week_start: weekStartOf(localDate()),
      })
      if (error) throw missing(error) ? new Error('Challenges sind noch nicht eingerichtet (Migration 0034).') : error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  })
}

export function useAnswerChallenge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase
        .from('challenges')
        .update({ status: accept ? 'active' : 'declined' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  })
}

/**
 * Eigenen Stand in laufenden Challenges eintragen (läuft im Hintergrund, sobald sich
 * Trainings oder Essen ändern) – so stimmt der Endstand auch, wenn man die
 * Community nicht öffnet.
 */
export function useChallengeSync() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: list } = useChallenges()
  const { data: sets } = useAllSets()
  const { data: food } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()

  useEffect(() => {
    if (!user || !list || !sets) return
    const today = localDate()
    const updates = list
      .filter((c) => c.status === 'active' && today <= shiftDate(weekEnd(c.week_start), 1))
      .map((c) => {
        const mine = c.creator === user.id ? 'creator_value' : 'opponent_value'
        const v = ownValue(c.kind, c.week_start, {
          sets,
          food: food ?? [],
          proteinTarget: settings?.protein_target ?? 0,
        })
        return v !== c[mine] ? { id: c.id, col: mine, v } : null
      })
      .filter((x): x is { id: string; col: 'creator_value' | 'opponent_value'; v: number } => !!x)
    if (!updates.length) return
    void Promise.all(
      updates.map((u) =>
        supabase
          .from('challenges')
          .update({ [u.col]: u.v })
          .eq('id', u.id),
      ),
    ).then(() => qc.invalidateQueries({ queryKey: ['challenges'] }))
  }, [user, list, sets, food, settings, qc])
}
