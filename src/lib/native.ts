// Brücke zu den nativen Android-Teilen (Capacitor). Im Browser sind alle
// Funktionen harmlose No-ops, damit die Web-Version zum Testen weiterläuft.
//
// Eigene Kotlin-Plugins (android/app/src/main/java/.../):
//   HealthBridge  – Health Connect lesen (Aktivitäten, Schlaf, Tageswerte)
//   AppWidgets    – Daten für die Homescreen-Widgets, Wasser aus dem Widget
//   LiveActivity  – laufende Benachrichtigung mit Countdown (Sperrbildschirm)

import { Capacitor, registerPlugin } from '@capacitor/core'
import type { ActivityType } from '../types'
import type { CardioSnap } from './outdoorWidget'

export const isNative = (): boolean => Capacitor.isNativePlatform()

/** Basis-URL für /api-Aufrufe: in der App absolut (WebView läuft unter https://localhost). */
export const API_BASE: string = isNative()
  ? (import.meta.env.VITE_API_BASE as string | undefined) || 'https://fitness-three-psi.vercel.app'
  : ''

export const apiUrl = (path: string): string => API_BASE + path

// ---------- Health Connect ----------

export interface NativeActivity {
  source_id: string
  source: string | null
  type: ActivityType
  title: string | null
  started_at: string
  duration_s: number
  distance_m: number | null
  kcal: number | null
  avg_hr: number | null
  max_hr: number | null
  elevation_m: number | null
  route: [number, number][] | null
}

export interface NativeSleep {
  date: string
  start_at: string
  end_at: string
  asleep_min: number
  deep_min: number | null
  rem_min: number | null
  light_min: number | null
  awake_min: number | null
  source: string | null
}

export interface NativeDaily {
  date: string
  steps: number | null
  active_kcal: number | null
  resting_hr: number | null
  hrv_ms: number | null
  vo2max: number | null
  weight_kg?: number | null
  /** aus anderen Apps (ältere App-Versionen liefern sie nicht) */
  hydration_ml?: number | null
  nutrition_kcal?: number | null
  nutrition_protein_g?: number | null
  mindful_min?: number | null
  strength_sessions?: number | null
  strength_min?: number | null
}

/** Periode aus Health Connect (lokale Daten; end null = läuft noch) */
export interface NativePeriod {
  start: string
  end: string | null
}

interface HealthBridgePlugin {
  availability(): Promise<{ status: 'available' | 'not_installed' | 'update_required' | 'unsupported' }>
  connect(): Promise<{ granted: boolean }>
  hasPermissions(): Promise<{ granted: boolean; history?: boolean; missing?: string[] }>
  read(opts: { since: string }): Promise<{
    activities: NativeActivity[]
    sleep: NativeSleep[]
    daily: NativeDaily[]
    /** Zyklus (optional – ältere App-Versionen bzw. ohne Freigabe fehlt es) */
    periods?: NativePeriod[]
    flowDays?: string[]
  }>
  openSettings(): Promise<void>
}

const HealthBridge = registerPlugin<HealthBridgePlugin>('HealthBridge')

export async function healthAvailability(): Promise<'available' | 'not_installed' | 'update_required' | 'unsupported'> {
  if (!isNative()) return 'unsupported'
  try {
    return (await HealthBridge.availability()).status
  } catch {
    return 'unsupported'
  }
}

export async function healthConnect(): Promise<boolean> {
  if (!isNative()) return false
  return (await HealthBridge.connect()).granted
}

/** Welche Datentypen fehlen noch (z. B. nach einem App-Update mit neuen Werten)? */
export async function healthMissing(): Promise<string[]> {
  if (!isNative()) return []
  try {
    return (await HealthBridge.hasPermissions()).missing ?? []
  } catch {
    return []
  }
}

export async function healthHasPermissions(): Promise<boolean> {
  if (!isNative()) return false
  try {
    return (await HealthBridge.hasPermissions()).granted
  } catch {
    return false
  }
}

export async function healthRead(since: string) {
  return HealthBridge.read({ since })
}

export async function healthOpenSettings() {
  if (isNative()) await HealthBridge.openSettings()
}

// ---------- Homescreen-Widgets ----------

/** Was die Widgets anzeigen (kompakt, ohne personenbezogene Details). */
export interface WidgetSnapshot {
  updatedAt: number
  kcalEaten?: number
  kcalTarget?: number
  proteinEaten?: number
  proteinTarget?: number
  waterMl?: number
  waterTarget?: number
  nextWorkout?: string | null
  restDay?: boolean
  streakWeeks?: number
  weekDone?: number
  weekGoal?: number
  readiness?: number | null
  readinessLabel?: string | null
  sleepMin?: number | null
  steps?: number | null
  showNutrition: boolean
  hasWatch: boolean
  showSocial?: boolean
  /** App-Farbe als #RRGGBB (Widgets färben sich mit) */
  accent?: string
  accentLight?: string
  onAccent?: string
  buddyLine?: string
  buddyMood?: string
  buddyEmoji?: string
  level?: number
  levelPct?: number
  stageLabel?: string
  questsDone?: number
  questsTotal?: number
  fasting?: { phase: 'eating' | 'fasting'; startsAt: number; endsAt: number; label: string } | null
  supplementNext?: { name: string; time: string } | null
  supplementsDone?: number
  supplementsTotal?: number
  stepsGoal?: number
  restingHr?: number | null
  hrv?: number | null
  cardioWeekKm?: number | null
  /** letztes Gewicht (Widget „Gewicht eintragen“) */
  weightKg?: number | null
  /** KI verfügbar? false blendet Foto/Sagen im Essen-Widget aus */
  aiAvailable?: boolean
  trainedToday?: boolean
  /** Ort fürs Wetter-Widget (≈ 1 km gerundet, nur auf dem Gerät) */
  weather?: { lat: number; lon: number } | null
  /** Ausdauer-Woche + Sportart (Widgets „Laufwetter“ und „Ausdauer-Woche“) */
  cardio?: CardioSnap | null
  /** Hybrid-Bereich an? Aus → Laufwetter/Ausdauer-Woche zeigen einen Hinweis */
  showHybrid?: boolean
}

interface AppWidgetsPlugin {
  update(opts: { snapshot: string }): Promise<void>
  /** Wasser, das im Widget getippt wurde, seit dem letzten Abholen (ml je Datum) */
  takePendingWater(): Promise<{ entries: { date: string; ml: number }[] }>
  /** Buddy als PNG (Base64 ohne data:-Präfix) für die Widgets */
  setBuddyImage(opts: { png: string }): Promise<void>
  /** Bild in die Galerie (Bilder/Fitness), ab Android 10 */
  saveImage(opts: { png: string; name: string }): Promise<void>
}

const AppWidgets = registerPlugin<AppWidgetsPlugin>('AppWidgets')

let lastSnapshot = ''
export async function updateWidgets(s: WidgetSnapshot) {
  if (!isNative()) return
  const { updatedAt: _u, ...rest } = s
  const key = JSON.stringify(rest)
  if (key === lastSnapshot) return
  lastSnapshot = key
  try {
    await AppWidgets.update({ snapshot: JSON.stringify(s) })
  } catch {
    /* Widget-Plugin fehlt (ältere App-Version) – egal */
  }
}

let lastBuddy = ''
/** Gerenderten Buddy an die Widgets geben (nur wenn er sich geändert hat). */
export async function updateWidgetBuddy(png: string) {
  if (!isNative() || !png || png === lastBuddy) return
  lastBuddy = png
  try {
    await AppWidgets.setBuddyImage({ png })
  } catch {
    /* ältere App-Version ohne Buddy-Bild – egal */
  }
}

/** PNG (Base64 ohne Präfix) in die Galerie speichern. false = ging nicht (Browser, altes Android). */
export async function saveImageToGallery(png: string, name: string): Promise<boolean> {
  if (!isNative()) return false
  try {
    await AppWidgets.saveImage({ png, name })
    return true
  } catch {
    return false
  }
}

/** CSS-Farbe „r g b“ bzw. rgb(...) → #RRGGBB */
export function cssVarHex(name: string): string | undefined {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    const p = v.split(/[\s,]+/).map(Number)
    if (p.length < 3 || p.some((x) => !Number.isFinite(x))) return undefined
    return (
      '#' +
      p
        .slice(0, 3)
        .map((x) => Math.round(x).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    )
  } catch {
    return undefined
  }
}

export async function takePendingWater(): Promise<{ date: string; ml: number }[]> {
  if (!isNative()) return []
  try {
    return (await AppWidgets.takePendingWater()).entries
  } catch {
    return []
  }
}

// ---------- Laufende Benachrichtigung (Sperrbildschirm) ----------

export type LiveKind = 'rest' | 'fasting' | 'workout'

export interface LiveOptions {
  kind: LiveKind
  title: string
  body: string
  /** Countdown bis (ms seit 1970) – oder */
  endsAt?: number
  /** Stoppuhr seit (ms seit 1970) */
  startedAt?: number
  /** Fortschritt 0–1 für den Balken */
  progress?: number
}

interface LiveActivityPlugin {
  start(opts: LiveOptions): Promise<void>
  stop(opts: { kind: LiveKind }): Promise<void>
}

const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity')

let notifyAsked = false

/** Android 13+: Benachrichtigungen einmalig erlauben lassen (beim ersten Countdown). */
async function ensureNotifyPermission() {
  if (notifyAsked) return
  notifyAsked = true
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const p = await LocalNotifications.checkPermissions()
    if (p.display !== 'granted') await LocalNotifications.requestPermissions()
  } catch {
    /* ignore */
  }
}

export async function liveStart(o: LiveOptions) {
  if (!isNative()) return
  await ensureNotifyPermission()
  try {
    await LiveActivity.start(o)
  } catch {
    /* ignore */
  }
}

export async function liveStop(kind: LiveKind) {
  if (!isNative()) return
  try {
    await LiveActivity.stop({ kind })
  } catch {
    /* ignore */
  }
}

// ---------- Lokale Benachrichtigung (z. B. Pause vorbei) ----------

const REST_DONE_ID = 7001

export async function scheduleRestDone(at: number) {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: REST_DONE_ID }] })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_DONE_ID,
          title: 'Pause vorbei 💪',
          body: 'Nächster Satz – du schaffst das!',
          schedule: { at: new Date(at), allowWhileIdle: true },
          channelId: 'workout',
          smallIcon: 'ic_stat_buddy',
        },
      ],
    })
  } catch {
    /* ignore */
  }
}

export async function cancelRestDone() {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: REST_DONE_ID }] })
  } catch {
    /* ignore */
  }
}

// ---------- Koch-Timer (Nachkochen) ----------

const COOK_TIMER_ID = 7002

/** Benachrichtigung, wenn der Koch-Timer abläuft (auch bei gesperrtem Handy). */
export async function scheduleCookTimer(at: number, step: string) {
  if (!isNative()) return
  await ensureNotifyPermission()
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: COOK_TIMER_ID }] })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: COOK_TIMER_ID,
          title: 'Timer abgelaufen ⏰',
          body: step.length > 80 ? step.slice(0, 79) + '…' : step,
          schedule: { at: new Date(at), allowWhileIdle: true },
          channelId: 'workout',
          smallIcon: 'ic_stat_buddy',
        },
      ],
    })
  } catch {
    /* ignore */
  }
}

export async function cancelCookTimer() {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: COOK_TIMER_ID }] })
  } catch {
    /* ignore */
  }
}

// ---------- Erinnerungen (geplant auf dem Gerät) ----------

/** Darf die App Benachrichtigungen zeigen? null = im Browser / unbekannt */
export async function notifyPermission(): Promise<boolean | null> {
  if (!isNative()) return null
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    return (await LocalNotifications.checkPermissions()).display === 'granted'
  } catch {
    return null
  }
}

/** Erlaubnis anfragen (nur auf ausdrücklichen Wunsch, z. B. in den Einstellungen). */
export async function requestNotifyPermission(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    return (await LocalNotifications.requestPermissions()).display === 'granted'
  } catch {
    return false
  }
}

let channelReady = false
async function remindersChannel() {
  if (channelReady) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.createChannel({
    id: 'reminders',
    name: 'Erinnerungen',
    description: 'Essen, Trinken, Training & Co.',
    importance: 4,
  })
  channelReady = true
}

/** Alle geplanten Erinnerungen ersetzen (IDs im reservierten Bereich). */
export async function syncReminders(
  list: { id: number; at: Date; title: string; body: string; route: string }[],
  idMin: number,
  idMax: number,
): Promise<void> {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
    await remindersChannel()
    const pending = await LocalNotifications.getPending()
    const old = pending.notifications.filter((n) => n.id >= idMin && n.id <= idMax).map((n) => ({ id: n.id }))
    if (old.length) await LocalNotifications.cancel({ notifications: old })
    if (!list.length) return
    await LocalNotifications.schedule({
      notifications: list.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        schedule: { at: r.at, allowWhileIdle: true },
        channelId: 'reminders',
        smallIcon: 'ic_stat_buddy',
        extra: { route: r.route },
      })),
    })
  } catch {
    /* ignore */
  }
}

/** Test-Benachrichtigung in 5 Sekunden. */
export async function sendTestReminder(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await remindersChannel()
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 8499,
          title: 'Hallo von Buddy 👋',
          body: 'So sehen deine Erinnerungen aus.',
          schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
          channelId: 'reminders',
          smallIcon: 'ic_stat_buddy',
          extra: { route: '/today' },
        },
      ],
    })
    return true
  } catch {
    return false
  }
}

/** Einstellung: Fasten-Countdown dauerhaft auf dem Sperrbildschirm zeigen. */
export const LIVE_FASTING_KEY = 'live_fasting'
export function liveFastingEnabled(): boolean {
  try {
    return localStorage.getItem(LIVE_FASTING_KEY) === '1'
  } catch {
    return false
  }
}

// ---------- Haptik (leichtes Feedback beim Tippen) ----------

/** Kurzes, leichtes Vibrieren – nur in der App, still im Browser. */
export async function haptic(kind: 'light' | 'medium' | 'success' = 'light'): Promise<void> {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')
    if (kind === 'success') await Haptics.notification({ type: NotificationType.Success })
    else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
  } catch {
    /* ignore */
  }
}
