import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useHealthSync } from '../hooks/useHealth'
import { useToday } from '../hooks/useToday'
import { useSetWater } from '../hooks/useWater'
import { usePrefs } from '../lib/prefs'
import { isNative, liveFastingEnabled, liveStart, liveStop, takePendingWater, updateWidgets } from '../lib/native'
import { useDietStyle } from '../hooks/useNutrition'
import { fastingState, fastingWindow } from '../lib/dietStyle'
import { supabase } from '../lib/supabase'
import type { WaterIntake } from '../types'

/**
 * Nur in der Android-App: Uhr-Daten abgleichen, Homescreen-Widgets mit
 * aktuellen Zahlen versorgen und im Widget getipptes Wasser übernehmen.
 */
export function NativeSync() {
  if (!isNative()) return null
  return <NativeSyncInner />
}

function NativeSyncInner() {
  useHealthSync()
  const t = useToday()
  const { showNutrition, hasWatch } = usePrefs()
  const setWater = useSetWater()
  const qc = useQueryClient()
  const { fasting, fastingStart } = useDietStyle()

  // Intervallfasten: Countdown bis zum nächsten Wechsel auf dem Sperrbildschirm (wenn eingeschaltet)
  useEffect(() => {
    const win = showNutrition && fasting !== 'none' ? fastingWindow({ fasting, fastingStart }) : null
    if (!win || !liveFastingEnabled()) {
      void liveStop('fasting')
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const show = () => {
      const st = fastingState(new Date(), win)
      const eating = st.phase === 'eating'
      void liveStart({
        kind: 'fasting',
        title: eating ? 'Essensfenster offen 🍳' : 'Fasten läuft ⏳',
        body: eating ? `Fenster schließt um ${st.nextChange}` : `Essen ab ${st.nextChange}`,
        endsAt: Date.now() + st.minutesLeft * 60_000,
        progress: st.progress,
      })
      // Beim Phasenwechsel neu anzeigen
      timer = setTimeout(show, st.minutesLeft * 60_000 + 5_000)
    }
    show()
    return () => clearTimeout(timer)
  }, [fasting, fastingStart, showNutrition])

  // Widgets aktualisieren, sobald sich die Zahlen ändern
  useEffect(() => {
    if (t.loading) return
    void updateWidgets({
      updatedAt: Date.now(),
      kcalEaten: t.kcalEaten,
      kcalTarget: t.kcalTarget,
      proteinEaten: t.proteinEaten,
      proteinTarget: t.proteinTarget,
      waterMl: t.waterMl,
      waterTarget: t.waterTarget,
      nextWorkout: t.trainedToday ? 'Erledigt ✓' : t.nextWorkout,
      restDay: t.restDay,
      streakWeeks: t.streakWeeks,
      weekDone: t.weekDone,
      weekGoal: t.weekGoal,
      readiness: t.readiness?.score ?? null,
      readinessLabel: t.readiness?.advice ?? null,
      sleepMin: t.sleep?.asleep_min ?? null,
      steps: t.steps,
      showNutrition,
      hasWatch,
    })
  }, [t, showNutrition, hasWatch])

  // Wasser aus dem Widget übernehmen (beim Start und bei Rückkehr in die App)
  useEffect(() => {
    let alive = true
    async function pull() {
      const list = await takePendingWater()
      for (const e of list) {
        if (!alive || e.ml <= 0) continue
        const cur =
          qc.getQueryData<WaterIntake | null>(['water', e.date]) ??
          ((await supabase.from('water_intake').select('*').eq('date', e.date).maybeSingle())
            .data as WaterIntake | null)
        await setWater.mutateAsync({ date: e.date, ml: (cur?.ml ?? 0) + e.ml })
      }
    }
    void pull()
    const onVis = () => document.visibilityState === 'visible' && void pull()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

/**
 * Android: Deep Links aus Widgets/Benachrichtigungen (fitnessbuddy://open/<pfad>)
 * und die Zurück-Taste (erst innerhalb der App zurück, dann App schließen).
 */
export function NativeNav() {
  if (!isNative()) return null
  return <NativeNavInner />
}

function NativeNavInner() {
  const navigate = useNavigate()
  useEffect(() => {
    let off: (() => void)[] = []
    let alive = true
    void import('@capacitor/app').then(({ App }) => {
      if (!alive) return
      void App.addListener('appUrlOpen', ({ url }) => {
        const m = /^fitnessbuddy:\/\/open(\/[^#]*)?/.exec(url)
        if (m) navigate(m[1] || '/today')
      }).then((h) => off.push(() => void h.remove()))
      void App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back()
        else void App.exitApp()
      }).then((h) => off.push(() => void h.remove()))
    })
    return () => {
      alive = false
      off.forEach((f) => f())
      off = []
    }
  }, [navigate])
  return null
}
