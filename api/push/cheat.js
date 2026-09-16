// Schickt einen Push an alle Freunde des Nutzers (z. B. Cheat-Meal-Alarm).
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
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const title = String(body.title || 'Fitness').slice(0, 80)
  const text = String(body.body || '').slice(0, 160)

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const db = admin()

  const { data: friends } = await db
    .from('friendships')
    .select('friend_id')
    .eq('user_id', user.id)
  const friendIds = (friends || []).map((f) => f.friend_id)
  if (friendIds.length === 0) {
    res.status(200).json({ ok: true, sent: 0 })
    return
  }

  const { data: subs } = await db
    .from('push_subscriptions')
    .select('*')
    .in('user_id', friendIds)

  const payload = JSON.stringify({ title, body: text })
  let sent = 0
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  res.status(200).json({ ok: true, sent })
}
