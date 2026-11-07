import { useBodyWeights } from '../hooks/useBodyWeight'
import { useAiGate } from '../hooks/usePremium'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useHealthActivities, useHealthSync } from '../hooks/useHealth'
import { WEATHER_LOC_EVENT, cardioSnapshot, getWeatherLoc } from '../lib/outdoorWidget'
import { useToday } from '../hooks/useToday'
import { useSetWater } from '../hooks/useWater'
import { usePrefs } from '../lib/prefs'
import {
  cssVarHex,
  isNative,
  liveFastingEnabled,
  liveStart,
  liveStop,
  takePendingWater,
  updateWidgetBuddy,
  updateWidgets,
  syncReminders,
} from '../lib/native'
import { REMINDER_ID_MAX, REMINDER_ID_MIN, planReminders } from '../lib/localReminders'
import { useSleepPlan } from '../hooks/useRecovery'
import { hoursText } from '../lib/health'
import { useTrainingRhythm, useUserPrefs } from '../hooks/usePrefsSync'
import { useFoodEntries } from '../hooks/useNutrition'
import { useAllSets } from '../hooks/useWorkouts'
import { isPerformed } from '../lib/analytics'
import { daysBetween, plannedTrainingDates } from '../lib/schedule'
import { shiftDate } from '../lib/day'
import { useBuddy, useBuddyLevel } from './buddy/useBuddy'
import { MyBuddy } from './buddy/MyBuddy'
import { BUDDY_STAGE_LABELS } from './buddy/Buddy'
import { useQuests } from '../hooks/useQuests'
import { useSupplementLog, useSupplements } from '../hooks/useSupplements'
import { dosesFor } from '../lib/supplements'
import { mascotEmoji } from '../lib/cosmetics'
import { useDietStyle } from '../hooks/useNutrition'
import { fastingState, fastingWindow } from '../lib/dietStyle'
import { supabase } from '../lib/supabase'
import type { WaterIntake } from '../types'
import { handleBack } from '../lib/backStack'
import { claimDeepLink, deepLinkRoute, launchRoute, markDeepLinkHandled } from '../lib/deepLink'

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
  const sleepPlan = useSleepPlan()
  const { data: weights } = useBodyWeights()
  const aiAvailable = useAiGate().enabled
  const lastWeight = weights?.length ? Number(weights[weights.length - 1].weight_kg) : null
  const { showNutrition, hasWatch, showSocial } = usePrefs()
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

  // Erinnerungen für heute und morgen auf dem Gerät planen (nur, was noch fehlt)
  const { prefs } = useUserPrefs()
  const { data: todayFood } = useFoodEntries(t.day)
  const rhythm = useTrainingRhythm(t.trainingDay)
  const { data: allSetsR } = useAllSets()
  const { data: suppsR = [] } = useSupplements()
  const { data: suppLogR = [] } = useSupplementLog(t.day)
  useEffect(() => {
    if (t.loading) return
    const id = setTimeout(() => {
      const now = new Date()
      const tomorrow = shiftDate(t.day, 1)
      const meals = { breakfast: false, lunch: false, dinner: false }
      for (const e of todayFood ?? []) if (e.meal && e.meal in meals) meals[e.meal as keyof typeof meals] = true
      const lastTrain = (allSetsR ?? [])
        .filter((x) => isPerformed(x))
        .reduce<string | null>((m, x) => (m && m > x.date ? m : x.date), null)
      const win = showNutrition && fasting !== 'none' ? fastingWindow({ fasting, fastingStart }) : null
      const doses = (date: string, off: 0 | 1, log: typeof suppLogR) =>
        dosesFor(date, suppsR, log).map((d) => ({
          name: d.supplement.name,
          time: d.slot,
          taken: d.taken,
          dayOffset: off,
        }))
      const list = planReminders({
        now,
        notify: prefs.notify,
        showNutrition,
        meals,
        kcalLeft: t.kcalTarget - t.kcalEaten,
        waterMl: t.waterMl,
        waterTarget: t.waterTarget,
        proteinEaten: t.proteinEaten,
        proteinTarget: t.proteinTarget,
        trainedToday: t.trainedToday,
        trainingDays: [...plannedTrainingDates(rhythm.schedule, rhythm.history, t.trainingDay, [t.day, tomorrow])],
        daysSinceTraining: lastTrain ? daysBetween(lastTrain, t.trainingDay) : null,
        nextWorkout: t.nextWorkout,
        supplements: [...doses(t.day, 0, suppLogR), ...doses(tomorrow, 1, [])],
        fasting: win ? { open: win.start, close: win.end } : null,
        bedtime: hasWatch && sleepPlan ? { bedAt: sleepPlan.bedAt, need: hoursText(sleepPlan.needMin) } : null,
      })
      void syncReminders(list, REMINDER_ID_MIN, REMINDER_ID_MAX)
    }, 1500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    t,
    prefs.notify,
    todayFood,
    rhythm.schedule,
    rhythm.history,
    allSetsR,
    suppsR,
    suppLogR,
    showNutrition,
    sleepPlan?.bedAt,
    fasting,
    fastingStart,
  ])

  // Widgets aktualisieren, sobald sich die Zahlen ändern (inkl. App-Farbe und Buddy)
  const buddy = useBuddy()
  const level = useBuddyLevel()
  const quests = useQuests()
  const { data: supps = [] } = useSupplements()
  const { data: cardioActs } = useHealthActivities(30)
  const [weatherLoc, setLoc] = useState(getWeatherLoc)
  useEffect(() => {
    const on = () => setLoc(getWeatherLoc())
    window.addEventListener(WEATHER_LOC_EVENT, on)
    return () => window.removeEventListener(WEATHER_LOC_EVENT, on)
  }, [])
  const { data: suppLog = [] } = useSupplementLog(t.day)
  useEffect(() => {
    if (t.loading) return
    const qs = [...quests.training.daily, ...(quests.food?.daily ?? [])]
    const doses = dosesFor(t.day, supps, suppLog)
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const next = doses.find((d) => !d.taken && d.slot >= hhmm) ?? doses.find((d) => !d.taken)
    const win = showNutrition && fasting !== 'none' ? fastingWindow({ fasting, fastingStart }) : null
    const fst = win ? fastingState(now, win) : null
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
      stepsGoal: 8000,
      restingHr: t.restingHr,
      hrv: t.hrv,
      cardioWeekKm: t.cardioWeek ? Math.round(t.cardioWeek.distance_m / 100) / 10 : null,
      showNutrition,
      hasWatch,
      showSocial,
      accent: cssVarHex('--c-ruby'),
      accentLight: cssVarHex('--c-ruby-light'),
      onAccent: cssVarHex('--c-on-brand'),
      buddyLine: buddy.line,
      buddyMood: buddy.mood,
      buddyEmoji: mascotEmoji(buddy.sessions, buddy.skin),
      level: level.level,
      levelPct: Math.round(level.progress),
      stageLabel: BUDDY_STAGE_LABELS[buddy.stage] ?? '',
      questsDone: qs.filter((q) => q.done).length,
      questsTotal: qs.length,
      fasting: fst
        ? {
            phase: fst.phase,
            endsAt: Date.now() + fst.minutesLeft * 60_000,
            startsAt:
              Date.now() -
              ((fst.phase === 'eating' ? win!.hours * 60 : 1440 - win!.hours * 60) - fst.minutesLeft) * 60_000,
            label: fst.phase === 'eating' ? `Fenster schließt ${fst.nextChange}` : `Essen ab ${fst.nextChange}`,
          }
        : null,
      supplementNext: next ? { name: next.supplement.name, time: next.slot } : null,
      supplementsDone: doses.filter((d) => d.taken).length,
      supplementsTotal: doses.length,
      weightKg: lastWeight,
      aiAvailable,
      trainedToday: t.trainedToday,
      weather: weatherLoc,
      cardio:
        hasWatch || prefs.cardioPlan
          ? cardioSnapshot({
              acts: hasWatch ? (cardioActs ?? []) : [],
              today: t.day,
              plan: prefs.cardioPlan,
              cardioDone: prefs.cardioDone,
            })
          : null,
    })
  }, [
    t,
    showNutrition,
    hasWatch,
    showSocial,
    buddy,
    level,
    quests,
    supps,
    suppLog,
    fasting,
    fastingStart,
    lastWeight,
    aiAvailable,
    weatherLoc,
    cardioActs,
    prefs.cardioPlan,
    prefs.cardioDone,
  ])

  // Buddy als Bild für die Widgets (gleiches Aussehen wie in der App)
  const buddyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = setTimeout(() => {
      const svg = buddyRef.current?.querySelector('svg')
      if (svg)
        void renderBuddyPng(svg).then((png) => {
          if (png) void updateWidgetBuddy(png)
        })
    }, 800)
    return () => clearTimeout(id)
  }, [buddy.mood, buddy.stage, buddy.skin])

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

  return (
    <div ref={buddyRef} aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 opacity-0">
      <MyBuddy size={256} mood={buddy.mood} animate={false} />
    </div>
  )
}

/** Buddy-SVG → PNG (Base64). CSS-Variablen der App-Farbe werden vorher eingesetzt. */
async function renderBuddyPng(svg: SVGSVGElement): Promise<string | null> {
  try {
    const root = getComputedStyle(document.documentElement)
    let xml = new XMLSerializer().serializeToString(svg)
    for (const v of ['--c-ruby-dark', '--c-ruby-light', '--c-ruby', '--c-text-muted', '--c-text', '--c-bg']) {
      xml = xml.split(`var(${v})`).join(root.getPropertyValue(v).trim())
    }
    if (!xml.includes('xmlns=')) xml = xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
    const img = new Image()
    await new Promise<void>((ok, err) => {
      img.onload = () => ok()
      img.onerror = () => err(new Error('svg'))
      img.src = url
    })
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    c.getContext('2d')!.drawImage(img, 0, 0, 256, 256)
    return c.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
  } catch {
    return null
  }
}

/**
 * Android: Deep Links aus Widgets/Benachrichtigungen (fitnessbuddy://open/<pfad>)
 * und die Zurück-Taste (erst innerhalb der App zurück, dann App schließen).
 */
export function NativeNav() {
  if (!isNative()) return null
  return <NativeNavInner />
}

/** Start-Link nur einmal je App-Start öffnen (auch wenn NativeNav neu eingehängt wird). */
let launchOpened = false

function NativeNavInner() {
  const navigate = useNavigate()
  // Kaltstart über Widget/Benachrichtigung/Teilen: Start-Link einmal öffnen
  useEffect(() => {
    void launchRoute().then((route) => {
      if (!route || launchOpened) return
      launchOpened = true
      if (claimDeepLink(route)) navigate(route)
    })
  }, [navigate])
  useEffect(() => {
    let off: (() => void)[] = []
    let alive = true
    void import('@capacitor/app').then(({ App }) => {
      if (!alive) return
      void App.addListener('appUrlOpen', ({ url }) => {
        const route = deepLinkRoute(url)
        if (route && claimDeepLink(route)) navigate(route)
      }).then((h) => off.push(() => void h.remove()))
      // Erinnerung angetippt → passende Seite öffnen
      void import('@capacitor/local-notifications').then(({ LocalNotifications }) =>
        LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
          const route = (notification.extra as { route?: string } | undefined)?.route
          if (!route || !route.startsWith('/')) return
          markDeepLinkHandled()
          navigate(route)
        }).then((h) => off.push(() => void h.remove())),
      )
      void App.addListener('backButton', ({ canGoBack }) => {
        // Offenes Sheet/Overlay zuerst schließen
        if (handleBack()) return
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
