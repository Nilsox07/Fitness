// Smartwatch-Daten (Health Connect → Supabase, Migration 0037). Gelesen wird nur,
// wenn das Modul „Smartwatch“ an ist – sonst gibt es keine Abfragen und keine UI.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'
import { healthHasPermissions, healthRead, isNative, type NativeDaily } from '../lib/native'
import { DAILY_COLUMNS_0043, isMissingColumn, waterImports, weightImports, withoutKeys } from '../lib/healthImport'
import { localDate, shiftDate } from '../lib/day'
import { mergePeriods } from '../lib/cyclePeriods'
import type { HealthActivity, HealthDaily, HealthSleep } from '../types'

// Version im Schlüssel: wenn die App neue Datenfelder liest, wird einmal komplett neu abgeglichen
const SYNC_KEY = 'health_synced_at_v3'

/** Tabelle fehlt noch (Migration nicht ausgeführt) → leer statt Fehler. */
function missingTable(e: { code?: string } | null) {
  return !!e && (e.code === '42P01' || e.code === 'PGRST205')
}

export function useHealthActivities(days = 120) {
  const { hasWatch } = usePrefs()
  return useQuery({
    queryKey: ['health', 'activities', days],
    enabled: hasWatch,
    queryFn: async (): Promise<HealthActivity[]> => {
      const { data, error } = await supabase
        .from('health_activities')
        .select('*')
        .gte('started_at', shiftDate(localDate(), -days))
        .order('started_at', { ascending: false })
      if (missingTable(error)) return []
      if (error) throw error
      return (data ?? []) as HealthActivity[]
    },
  })
}

export function useHealthSleep(days = 30) {
  const { hasWatch } = usePrefs()
  return useQuery({
    queryKey: ['health', 'sleep', days],
    enabled: hasWatch,
    queryFn: async (): Promise<HealthSleep[]> => {
      const { data, error } = await supabase
        .from('health_sleep')
        .select('*')
        .gte('date', shiftDate(localDate(), -days))
        .order('date', { ascending: false })
      if (missingTable(error)) return []
      if (error) throw error
      return (data ?? []) as HealthSleep[]
    },
  })
}

export function useHealthDaily(days = 30) {
  const { hasWatch } = usePrefs()
  return useQuery({
    queryKey: ['health', 'daily', days],
    enabled: hasWatch,
    queryFn: async (): Promise<HealthDaily[]> => {
      const { data, error } = await supabase
        .from('health_daily')
        .select('*')
        .gte('date', shiftDate(localDate(), -days))
        .order('date', { ascending: false })
      if (missingTable(error)) return []
      if (error) throw error
      return (data ?? []) as HealthDaily[]
    },
  })
}

/**
 * Waagen-Gewicht → body_weights (nur Tage ohne eigenen Eintrag) und Getrunkenes aus anderen Apps →
 * water_intake (nur wenn Health Connect mehr kennt; nur mit Ernährungs-Bereich). Fehler still ignorieren.
 */
async function importFromHealth(uid: string, daily: readonly NativeDaily[], water: boolean) {
  const dates = daily.map((d) => d.date).sort()
  if (!dates.length) return
  const from = dates[0]
  try {
    const { data, error } = await supabase.from('body_weights').select('date').gte('date', from)
    if (!error) {
      const rows = weightImports(
        daily,
        (data ?? []).map((w: { date: string }) => w.date),
      )
      if (rows.length) {
        const opts = { onConflict: 'user_id,date', ignoreDuplicates: true }
        const withSource = rows.map((w) => ({ ...w, user_id: uid, source: 'health' }))
        const res = await supabase.from('body_weights').upsert(withSource, opts)
        // Spalte „source“ kommt mit Migration 0043 – vorher ohne speichern
        if (isMissingColumn(res.error))
          await supabase.from('body_weights').upsert(withoutKeys(withSource, ['source']), opts)
      }
    }
  } catch {
    /* ignore */
  }
  if (!water || !daily.some((d) => (d.hydration_ml ?? 0) > 0)) return
  try {
    const { data, error } = await supabase.from('water_intake').select('date, ml').gte('date', from)
    if (error) return
    const app = new Map((data ?? []).map((w: { date: string; ml: number }) => [w.date, w.ml]))
    for (const w of waterImports(daily, app)) {
      if (w.exists) {
        // nur erhöhen – auch wenn gerade parallel in der App getrunken wurde
        await supabase.from('water_intake').update({ ml: w.ml }).eq('user_id', uid).eq('date', w.date).lt('ml', w.ml)
      } else {
        await supabase
          .from('water_intake')
          .upsert({ user_id: uid, date: w.date, ml: w.ml }, { onConflict: 'user_id,date', ignoreDuplicates: true })
      }
    }
  } catch {
    /* ignore */
  }
}

/** Zeitpunkt des letzten erfolgreichen Abgleichs (ISO) oder null. */
export function lastHealthSync(): string | null {
  try {
    return localStorage.getItem(SYNC_KEY)
  } catch {
    return null
  }
}

/** Health Connect lesen und in Supabase schreiben (seit dem letzten Abgleich, max. 30 Tage). */
export function useHealthSync() {
  const { user } = useAuth()
  const { hasWatch, hasCycle, showNutrition } = usePrefs()
  const qc = useQueryClient()
  const busy = useRef(false)

  const sync = useCallback(async () => {
    if (!user || !hasWatch || !isNative() || busy.current) return
    if (!(await healthHasPermissions())) return
    busy.current = true
    try {
      // Erster Abgleich: 90 Tage (Health Connect liefert älteres nur mit der Verlaufs-Freigabe)
      const fallback = new Date(Date.now() - 90 * 86400_000).toISOString()
      let since = fallback
      try {
        since = localStorage.getItem(SYNC_KEY) || fallback
      } catch {
        /* ignore */
      }
      // Einen Tag überlappen: Schlaf/Tageswerte werden nachträglich vervollständigt
      const from = new Date(new Date(since).getTime() - 86400_000).toISOString()
      const startedAt = new Date().toISOString()
      const r = await healthRead(from)
      const uid = user.id
      if (r.activities.length) {
        await supabase.from('health_activities').upsert(
          r.activities.map((a) => ({ ...a, user_id: uid })),
          { onConflict: 'user_id,source_id' },
        )
      }
      if (r.sleep.length) {
        await supabase.from('health_sleep').upsert(
          r.sleep.map((s) => ({ ...s, user_id: uid })),
          { onConflict: 'user_id,date' },
        )
      }
      if (r.daily.length) {
        const rows = r.daily.map((d) => ({ ...d, user_id: uid }))
        const { error } = await supabase.from('health_daily').upsert(rows, { onConflict: 'user_id,date' })
        // Migration 0043 noch nicht ausgeführt → ohne die neuen Spalten speichern (nie alles verlieren)
        if (isMissingColumn(error)) {
          await supabase
            .from('health_daily')
            .upsert(withoutKeys(rows, DAILY_COLUMNS_0043), { onConflict: 'user_id,date' })
        }
        await importFromHealth(uid, r.daily, showNutrition)
        await qc.invalidateQueries({ queryKey: ['body_weights'] })
        if (showNutrition) await qc.invalidateQueries({ queryKey: ['water'] })
      }
      // Zyklus (nur wenn der Bereich an ist): Perioden + Blutungstage → cycle_periods.
      // Fehler (z. B. Migration 0039 noch nicht ausgeführt) still ignorieren.
      if (hasCycle) {
        try {
          const periods = mergePeriods(r.periods, r.flowDays)
          if (periods.length) {
            const { error } = await supabase.from('cycle_periods').upsert(
              periods.map((p) => ({ ...p, user_id: uid, source: 'health' })),
              { onConflict: 'user_id,start_date', ignoreDuplicates: false },
            )
            if (!error) await qc.invalidateQueries({ queryKey: ['cycle_periods'] })
          }
        } catch {
          /* ignore */
        }
      }
      try {
        localStorage.setItem(SYNC_KEY, startedAt)
      } catch {
        /* ignore */
      }
      await qc.invalidateQueries({ queryKey: ['health'] })
    } catch (e) {
      console.warn('Health-Sync fehlgeschlagen', e)
    } finally {
      busy.current = false
    }
  }, [user, hasWatch, hasCycle, showNutrition, qc])

  // Beim Start und bei jeder Rückkehr in die App abgleichen
  useEffect(() => {
    void sync()
    const onVis = () => document.visibilityState === 'visible' && void sync()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [sync])

  return sync
}
