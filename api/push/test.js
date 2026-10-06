// Schickt eine Test-Benachrichtigung an alle Geräte des angemeldeten Nutzers.
import webpush from 'web-push'
import { admin, userFromAuth } from '../_fitbit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method' })
    return
  }
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.status(200).json({ ok: false, reason: 'push_not_configured' })
    return
  }
  const user = await userFromAuth(req)
  if (!user) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const db = admin()
  const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', user.id)
  if (!subs || subs.length === 0) {
    res.status(200).json({ ok: false, reason: 'no_subscription' })
    return
  }

  const payload = JSON.stringify({
    title: 'Buddy hier 👋',
    body: 'Benachrichtigungen funktionieren. Ich melde mich, wenn es Zeit fürs Gym ist.',
    tag: 'fitness-test',
    url: '/',
  })
  let sent = 0
  const errors = []
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      sent++
    } catch (err) {
      errors.push(err?.statusCode ?? 0)
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  res.status(200).json({ ok: sent > 0, sent, errors })
}
