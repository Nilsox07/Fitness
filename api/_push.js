// Ein Weg für alle Pushes: Browser (Web-Push, VAPID) und Android-App (FCM).
// Genutzt von cron/reminders, push/test und push/cheat.

import webpush from 'web-push'
import { fcmToken, isFcmSub, readServiceAccount, sendFcm, serverSends } from './_fcm.js'

/** Was ist auf dem Server eingerichtet? null = gar nichts (weder VAPID noch FCM). */
export function pushConfig(env = process.env) {
  const web = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
  if (web)
    webpush.setVapidDetails(
      env.VAPID_SUBJECT || 'mailto:admin@example.com',
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    )
  const fcm = readServiceAccount(env.FCM_SERVICE_ACCOUNT)
  return web || fcm ? { web, fcm } : null
}

/**
 * Push an alle Abos senden. `kind` entscheidet bei Android-Geräten, ob der Server überhaupt schickt
 * (die App plant Erinnerungen selbst). Tote Abos werden gelöscht. Liefert Anzahl + Fehlercodes.
 */
export async function deliver(db, subs, payload, cfg, { kind = 'test', today = '' } = {}) {
  let sent = 0
  const errors = []
  for (const sub of subs || []) {
    if (!serverSends(sub, kind, today)) continue
    let gone = false
    try {
      if (isFcmSub(sub)) {
        if (!cfg.fcm) continue
        const r = await sendFcm(cfg.fcm, fcmToken(sub), payload)
        if (r.ok) sent++
        else {
          errors.push(r.status)
          gone = r.gone
        }
      } else {
        if (!cfg.web) continue
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        )
        sent++
      }
    } catch (err) {
      errors.push(err?.statusCode ?? 0)
      gone = err?.statusCode === 404 || err?.statusCode === 410
    }
    if (gone) await db.from('push_subscriptions').delete().eq('id', sub.id)
  }
  return { sent, errors }
}
