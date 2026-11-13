// Server-Push in der Android-App (Firebase Cloud Messaging). Die App meldet ihr Gerät in
// push_subscriptions an (endpoint 'fcm:<token>') und sagt dazu, bis wann sie Erinnerungen selbst
// geplant hat (local_until) – so schickt der Server nichts doppelt (Logik in api/_fcm.js).
// Ohne google-services.json im Build passiert hier nichts.

import { supabase } from './supabase'
import { isNative, nativePushReady } from './native'

const TOKEN_KEY = 'fcm_token'
let lastSaved = ''
let tokenPromise: Promise<string | null> | null = null

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Token von Firebase holen (einmal je App-Start; Android erneuert ihn selbst bei Bedarf). */
function fetchToken(): Promise<string | null> {
  tokenPromise ??= (async () => {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const token = await new Promise<string | null>((resolve) => {
      const done = (t: string | null) => {
        void Promise.all(handles).then((hs) => hs.forEach((h) => void h.remove()))
        resolve(t)
      }
      const handles = [
        PushNotifications.addListener('registration', ({ value }) => done(value)),
        PushNotifications.addListener('registrationError', () => done(null)),
      ]
      setTimeout(() => done(null), 15000)
      void PushNotifications.register().catch(() => done(null))
    })
    if (!token) tokenPromise = null
    return token
  })().catch(() => {
    tokenPromise = null
    return null
  })
  return tokenPromise
}

/**
 * Gerät für Server-Push anmelden bzw. aktualisieren. Fragt NICHT nach der Erlaubnis – das passiert
 * in den Einstellungen bzw. beim ersten Countdown. `localUntil` = letzter Tag mit lokal geplanten
 * Erinnerungen (YYYY-MM-DD). Gibt true zurück, wenn das Gerät angemeldet ist.
 */
export async function registerFcm(userId: string, localUntil: string | null): Promise<boolean> {
  if (!isNative() || !(await nativePushReady())) return false
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    if ((await PushNotifications.checkPermissions()).receive !== 'granted') return false
    const token = await fetchToken()
    if (!token) return false
    const key = `${userId}|${token}|${localUntil}`
    if (key === lastSaved) return true
    const old = storedToken()
    if (old && old !== token) await supabase.from('push_subscriptions').delete().eq('endpoint', `fcm:${old}`)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: `fcm:${token}`,
          p256dh: null,
          auth: null,
          platform: 'android',
          local_until: localUntil,
        },
        { onConflict: 'endpoint' },
      )
    if (error) return false
    lastSaved = key
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* ignore */
    }
    return true
  } catch {
    return false
  }
}

/** Gerät abmelden (z. B. beim Logout). Best effort. */
export async function unregisterFcm(): Promise<void> {
  const token = storedToken()
  if (!token) return
  lastSaved = ''
  tokenPromise = null
  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', `fcm:${token}`)
    localStorage.removeItem(TOKEN_KEY)
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.unregister()
  } catch {
    /* ignore */
  }
}

/** Ist dieses Gerät für Server-Push angemeldet? */
export const fcmRegistered = (): boolean => isNative() && !!storedToken()
