// Schickt einen Push an alle Freunde des Nutzers (z. B. Cheat-Meal-Alarm).
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
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const title = String(body.title || 'Fitness').slice(0, 80)
  const text = String(body.body || '').slice(0, 160)

  let db
  try {
    db = admin()
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'server_config', error: e.message })
    return
  }

  const { data: friends } = await db.from('friendships').select('friend_id').eq('user_id', user.id)
  const friendIds = (friends || []).map((f) => f.friend_id)
  if (friendIds.length === 0) {
    res.status(200).json({ ok: true, sent: 0 })
    return
  }

  // Freunde, die Community-Pushes abgeschaltet haben, auslassen
  const { data: profs } = await db.from('profiles').select('id, prefs').in('id', friendIds)
  // … oder Community ganz ausgeblendet haben
  const muted = new Set(
    (profs || [])
      .filter((p) => p.prefs?.notify?.social?.on === false || p.prefs?.modules?.social === false)
      .map((p) => p.id),
  )
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('*')
    .in(
      'user_id',
      friendIds.filter((id) => !muted.has(id)),
    )

  const payload = { title, body: text, tag: 'fitness-cheat', url: '/social' }
  const { sent } = await deliver(db, subs, payload, cfg, { kind: 'social' })
  res.status(200).json({ ok: true, sent })
}
