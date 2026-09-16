import { supabase } from './supabase'

export const pushSupported =
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window &&
  'Notification' in window

export function shareCheatEnabled(): boolean {
  try {
    return localStorage.getItem('share_cheat') !== '0'
  } catch {
    return true
  }
}
export function setShareCheatEnabled(on: boolean) {
  try {
    localStorage.setItem('share_cheat', on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Freunde per Push über ein Cheat-Meal informieren (best effort). */
export async function notifyFriendsCheat(title: string, body: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch('/api/push/cheat', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title, body }),
    })
  } catch {
    /* Push optional – ignorieren */
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** Push-Benachrichtigungen aktivieren: Erlaubnis holen, abonnieren, speichern. */
export async function enablePush(userId: string): Promise<void> {
  if (!pushSupported) throw new Error('Push wird auf diesem Gerät nicht unterstützt.')
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!vapid) throw new Error('Push ist nicht konfiguriert (VAPID-Key fehlt).')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt.')

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
  })
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Abo konnte nicht erstellt werden.')
  }
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'endpoint' },
    )
  if (error) throw error
}
