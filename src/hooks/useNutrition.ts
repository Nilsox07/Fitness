import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { judgeCheatMeal } from '../lib/ai'
import { notifyFriendsCheat, shareCheatEnabled } from '../lib/push'
import {
  dietToColumns,
  resolveDiet,
  rowHasDietColumns,
  setActiveDiet,
  writeDietFallback,
  type DietStyle,
} from '../lib/dietStyle'
import type { FoodEntry, NutritionSettings } from '../types'

/** Prüft ein geloggtes Lebensmittel und postet bei echten „Cheats" einen
 *  Freunde-Alarm (Feed + Push). Läuft im Hintergrund, Fehler werden ignoriert. */
async function maybePostCheat(entry: FoodEntry, userId: string, authorName: string | undefined, qc: QueryClient) {
  try {
    if (!shareCheatEnabled() || (entry.kcal ?? 0) < 400) return
    const res = await judgeCheatMeal({
      name: entry.name,
      kcal: entry.kcal,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
    })
    if (!res.indulgent) return
    const title = `🍕 ${entry.name}`
    const detail = `${Math.round(entry.kcal)} kcal${res.quip ? ` · ${res.quip}` : ''}`
    await supabase
      .from('activities')
      .insert({ user_id: userId, author_name: authorName ?? null, kind: 'cheat', title, detail })
    qc.invalidateQueries({ queryKey: ['activities'] })
    notifyFriendsCheat(`${authorName ?? 'Jemand'} hat gesündigt 🍕`, `${entry.name} · ${detail}`)
  } catch {
    /* egal */
  }
}

export function useNutritionSettings() {
  return useQuery({
    queryKey: ['nutrition_settings'],
    queryFn: async (): Promise<NutritionSettings | null> => {
      const { data, error } = await supabase.from('nutrition_settings').select('*').maybeSingle()
      if (error) throw error
      const row = (data as NutritionSettings | null) ?? null
      // Feature-Erkennung: hat die Zeile die Spalten aus Migration 0027?
      if (row) dietColumnsKnown = rowHasDietColumns(row)
      setActiveDiet(resolveDiet(row))
      return row
    },
  })
}

/** Aktive Ernährungsweise (DB oder localStorage-Fallback vor Migration 0027). */
export function useDietStyle(): DietStyle {
  const { data, dataUpdatedAt } = useNutritionSettings()
  // dataUpdatedAt: auch nach einem Fallback-Speichern (gleiche Zeile) neu auflösen
  return useMemo(() => resolveDiet(data), [data, dataUpdatedAt])
}

// null = unbekannt (noch keine Zeile gelesen) → beim Speichern ausprobieren.
let dietColumnsKnown: boolean | null = null

/** Fehler „Spalte existiert nicht" (Migration 0027 noch nicht ausgeführt)? */
function isMissingDietColumn(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  const msg = e.message ?? ''
  return e.code === 'PGRST204' || e.code === '42703' || /diet_macro|diet_restrictions|fasting/.test(msg)
}

export type NutritionSettingsInput = Omit<NutritionSettings, 'user_id' | 'updated_at'>

/** Eingabe plus optionale Ernährungsweise (wird je nach DB-Stand gespeichert). */
export type NutritionSettingsSave = NutritionSettingsInput & { diet?: DietStyle }

export function useUpsertNutritionSettings() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ diet, ...input }: NutritionSettingsSave) => {
      // Diät-Spalten aus der Basiseingabe entfernen; sie werden unten gezielt gesetzt.
      const { diet_macro: _m, diet_restrictions: _r, fasting: _f, fasting_start: _s, ...base } = input
      const row = { ...base, user_id: user!.id, updated_at: new Date().toISOString() }
      const save = (payload: object) =>
        supabase.from('nutrition_settings').upsert(payload).select().single()

      if (diet && dietColumnsKnown !== false) {
        const res = await save({ ...row, ...dietToColumns(diet) })
        if (!res.error) {
          dietColumnsKnown = true
          writeDietFallback(null)
          setActiveDiet(diet)
          return res.data as NutritionSettings
        }
        if (!isMissingDietColumn(res.error)) throw res.error
        dietColumnsKnown = false
      }
      const { data, error } = await save(row)
      if (error) throw error
      if (diet) {
        // Migration 0027 fehlt noch → lokal merken
        writeDietFallback(diet)
        setActiveDiet(diet)
      }
      return data as NutritionSettings
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition_settings'] }),
  })
}

export function useFoodEntries(date: string) {
  return useQuery({
    queryKey: ['food_entries', date],
    queryFn: async (): Promise<FoodEntry[]> => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('date', date)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as FoodEntry[]
    },
  })
}

/** Alle Essens-Einträge (für die Auswertung / Tagesverlauf). */
export function useAllFoodEntries() {
  return useQuery({
    queryKey: ['food_entries', 'all'],
    queryFn: async (): Promise<FoodEntry[]> => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as FoodEntry[]
    },
  })
}

export type FoodEntryInput = Pick<
  FoodEntry,
  | 'date'
  | 'name'
  | 'amount_g'
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'sugar'
  | 'sat_fat'
  | 'salt'
  | 'barcode'
  | 'meal'
>

export function useAddFoodEntry() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: FoodEntryInput) => {
      const { data, error } = await supabase
        .from('food_entries')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as FoodEntry
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['food_entries'] })
      void maybePostCheat(s, user!.id, user?.email?.split('@')[0], qc)
    },
  })
}

/** Mehrere Einträge in EINEM Insert (KI-Schätzung, Tagesplan) — alles oder nichts,
 *  keine halb geloggten Listen bei Netzfehlern; Cache nur einmal invalidieren. */
export function useAddFoodEntries() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (inputs: FoodEntryInput[]) => {
      if (inputs.length === 0) return [] as FoodEntry[]
      const { data, error } = await supabase
        .from('food_entries')
        .insert(inputs.map((i) => ({ ...i, user_id: user!.id })))
        .select()
      if (error) throw error
      return data as FoodEntry[]
    },
    onSuccess: (rows) => {
      qc.invalidateQueries({ queryKey: ['food_entries'] })
      for (const r of rows) void maybePostCheat(r, user!.id, user?.email?.split('@')[0], qc)
    },
  })
}

export function useDeleteFoodEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: FoodEntry) => {
      const { error } = await supabase.from('food_entries').delete().eq('id', entry.id)
      if (error) throw error
      return entry
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food_entries'] }),
  })
}

export function useUpdateFoodEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<FoodEntry> & { id: string }) => {
      const { error } = await supabase.from('food_entries').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food_entries'] }),
  })
}
