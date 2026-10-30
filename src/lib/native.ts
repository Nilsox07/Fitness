// Brücke zu den nativen Android-Teilen (Capacitor). Im Browser sind alle
// Funktionen harmlose No-ops, damit die Web-Version zum Testen weiterläuft.
//
// Eigene Kotlin-Plugins (android/app/src/main/java/.../):
//   HealthBridge  – Health Connect lesen (Aktivitäten, Schlaf, Tageswerte)
//   AppWidgets    – Daten für die Homescreen-Widgets, Wasser aus dem Widget
//   LiveActivity  – laufende Benachrichtigung mit Countdown (Sperrbildschirm)

import { Capacitor, registerPlugin } from '@capacitor/core'
import type { ActivityType } from '../types'

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
}

interface HealthBridgePlugin {
  availability(): Promise<{ status: 'available' | 'not_installed' | 'update_required' | 'unsupported' }>
  connect(): Promise<{ granted: boolean }>
  hasPermissions(): Promise<{ granted: boolean; history?: boolean; missing?: string[] }>
  read(opts: { since: string }): Promise<{ activities: NativeActivity[]; sleep: NativeSleep[]; daily: NativeDaily[] }>
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
}

interface AppWidgetsPlugin {
  update(opts: { snapshot: string }): Promise<void>
  /** Wasser, das im Widget getippt wurde, seit dem letzten Abholen (ml je Datum) */
  takePendingWater(): Promise<{ entries: { date: string; ml: number }[] }>
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

/** Einstellung: Fasten-Countdown dauerhaft auf dem Sperrbildschirm zeigen. */
export const LIVE_FASTING_KEY = 'live_fasting'
export function liveFastingEnabled(): boolean {
  try {
    return localStorage.getItem(LIVE_FASTING_KEY) === '1'
  } catch {
    return false
  }
}
