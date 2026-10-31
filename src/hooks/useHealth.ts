// Smartwatch-Daten (Health Connect → Supabase, Migration 0037). Gelesen wird nur,
// wenn das Modul „Smartwatch“ an ist – sonst gibt es keine Abfragen und keine UI.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'
import { healthHasPermissions, healthRead, isNative } from '../lib/native'
import { localDate, shiftDate } from '../lib/day'
import type { HealthActivity, HealthDaily, HealthSleep } from '../types'

// Version im Schlüssel: wenn die App neue Datenfelder liest, wird einmal komplett neu abgeglichen
const SYNC_KEY = 'health_synced_at_v2'

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
  const { hasWatch } = usePrefs()
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
        await supabase.from('health_daily').upsert(
          r.daily.map((d) => ({ ...d, user_id: uid })),
          { onConflict: 'user_id,date' },
        )
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
  }, [user, hasWatch, qc])

  // Beim Start und bei jeder Rückkehr in die App abgleichen
  useEffect(() => {
    void sync()
    const onVis = () => document.visibilityState === 'visible' && void sync()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [sync])

  return sync
}
