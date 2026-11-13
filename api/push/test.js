// Schickt eine Test-Benachrichtigung an alle Geräte des angemeldeten Nutzers.
import { admin, userFromAuth } from '../_fitbit.js'
import { cors } from '../_cors.js'
import { deliver, pushConfig } from '../_push.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method' })
    return
  }
  const cfg = pushConfig()
  if (!cfg) {
    res.status(200).json({ ok: false, reason: 'push_not_configured' })
    return
  }
  const user = await userFromAuth(req)
  if (!user) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  let db
  try {
    db = admin()
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'server_config', error: e.message })
    return
  }
  const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', user.id)
  if (!subs || subs.length === 0) {
    res.status(200).json({ ok: false, reason: 'no_subscription' })
    return
  }

  const payload = {
    title: 'Buddy hier 👋',
    body: 'Benachrichtigungen funktionieren. Ich melde mich, wenn es Zeit fürs Gym ist.',
    tag: 'fitness-test',
    url: '/',
  }
  const { sent, errors } = await deliver(db, subs, payload, cfg, { kind: 'test' })
  res.status(200).json({ ok: sent > 0, sent, errors })
}
