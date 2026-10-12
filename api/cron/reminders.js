// Cron: Push-Erinnerungen (Mahlzeiten, Trinken, Eiweiß, Training, Serie, Wiegen,
// Wochenfazit, Körperfoto, Fastenfenster). Wird alle 15 Minuten aufgerufen
// (Supabase pg_cron → diese URL, siehe Migration 0032) und zusätzlich einmal
// täglich von Vercel. Was wann kommt, stellt jeder unter Profil →
// Benachrichtigungen ein (profiles.prefs.notify). Jede Art höchstens einmal pro
// Tag (Tabelle notification_log), und nur, wenn wirklich etwas fehlt.
//
// Nötige Env-Variablen (Vercel):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (z. B. mailto:du@mail.de)
//   SUPABASE_SERVICE_ROLE_KEY
//   CRON_SECRET (empfohlen, schützt den Endpoint)

import webpush from 'web-push'
import { SUPABASE_URL } from '../_supabase.js'
import { createClient } from '@supabase/supabase-js'
import { fastingDue, localNow, message, normalizeNotify, dueKinds } from '../_notify.js'

const DAYS_THRESHOLD = 3

function daysBetween(a, b) {
  return Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86400000)
}
function ymd(s) {
  const [y, m, d] = s.split('-').map(Number)
  return [y, m - 1, d]
}
function shift(date, days) {
  const t = new Date(Date.UTC(...ymd(date)) + days * 86400000)
  return t.toISOString().slice(0, 10)
}
/** Montag der Woche (ISO) eines Datums. */
function weekStart(date) {
  const wd = (new Date(Date.UTC(...ymd(date))).getUTCDay() + 6) % 7
  return shift(date, -wd)
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_SERVICE_ROLE_KEY } = process.env
  // Nur die NAMEN fehlender Variablen melden (nie Werte), damit man sie in Vercel nachtragen kann
  const missing = Object.entries({ VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length) {
    res.status(503).json({ error: 'Push nicht konfiguriert', missing })
    return
  }

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: subs, error } = await db.from('push_subscriptions').select('*')
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  const byUser = new Map()
  for (const s of subs || []) byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s])
  if (byUser.size === 0) {
    res.status(200).json({ ok: true, sent: 0 })
    return
  }

  const { data: profiles } = await db
    .from('profiles')
    .select('id, prefs')
    .in('id', [...byUser.keys()])
  const prefsOf = new Map((profiles || []).map((p) => [p.id, p.prefs || {}]))

  let sent = 0
  const now = new Date()
  for (const [userId, userSubs] of byUser) {
    try {
      sent += await remindUser(db, userId, userSubs, prefsOf.get(userId) || {}, now)
    } catch (e) {
      console.error('reminder', userId, e?.message)
    }
  }
  res.status(200).json({ ok: true, sent })
}

async function remindUser(db, userId, subs, prefs, now) {
  const notify = normalizeNotify(prefs.notify)
  const local = localNow(prefs.tz, now)
  const today = local.date
  const kinds = dueKinds(notify, local)

  // Daten nur laden, wenn sie gebraucht werden (einmal pro Nutzer)
  const cache = {}
  const once = (key, fn) => (cache[key] ??= fn())
  const settings = () =>
    once(
      'settings',
      async () => (await db.from('nutrition_settings').select('*').eq('user_id', userId).maybeSingle()).data,
    )
  const food = () =>
    once(
      'food',
      async () =>
        (await db.from('food_entries').select('meal, kcal, protein, fluid_ml').eq('user_id', userId).eq('date', today))
          .data || [],
    )
  const workouts = () =>
    once(
      'workouts',
      async () =>
        (await db.from('workouts').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(20))
          .data || [],
    )

  if (notify.fasting.on) {
    const s = await settings()
    const phase = s ? fastingDue(s.fasting, s.fasting_start, local) : null
    if (phase) kinds.push(`fasting_${phase}`)
  }

  let count = 0
  for (const kind of kinds) {
    const ctx = await check(kind, { db, userId, today, local, prefs, settings, food, workouts })
    if (!ctx) continue
    // Pro Art und Tag nur einmal: zuerst „reservieren“, dann senden
    const { error } = await db.from('notification_log').insert({ user_id: userId, kind, day: today })
    if (error) continue
    const msg = message(kind, ctx, now.getUTCDate() + userId.length)
    if (!msg) continue
    count += await send(db, subs, { ...msg, tag: `fitness-${kind}` })
  }
  return count
}

/** Prüft, ob die Erinnerung wirklich nötig ist; liefert den Text-Kontext oder null. */
async function check(kind, { db, userId, today, local, prefs, settings, food, workouts }) {
  switch (kind) {
    case 'breakfast':
    case 'lunch':
    case 'dinner': {
      const entries = await food()
      if (entries.some((e) => e.meal === kind)) return null
      if (kind === 'dinner') {
        const s = await settings()
        const eaten = entries.reduce((a, e) => a + (Number(e.kcal) || 0), 0)
        return { kcalLeft: s?.kcal_target ? Math.round(s.kcal_target - eaten) : 0 }
      }
      return {}
    }
    case 'water': {
      const s = await settings()
      const target = s?.water_target_ml || 0
      if (!target) return null
      const { data: w } = await db
        .from('water_intake')
        .select('ml')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()
      const drank = (w?.ml || 0) + (await food()).reduce((a, e) => a + (Number(e.fluid_ml) || 0), 0)
      if (drank >= target * 0.5) return null
      const l = (ml) => (Math.round(ml / 100) / 10).toLocaleString('de-DE')
      return { drankL: l(drank), targetL: l(target) }
    }
    case 'protein': {
      const s = await settings()
      const entries = await food()
      if (!s?.protein_target || entries.length === 0) return null // wer heute nichts trackt, wird nicht gedrängelt
      const eaten = entries.reduce((a, e) => a + (Number(e.protein) || 0), 0)
      if (eaten >= s.protein_target * 0.75) return null
      return { missing: Math.round(s.protein_target - eaten) }
    }
    case 'fasting_open':
    case 'fasting_close': {
      const s = await settings()
      const hours = { '16:8': 8, '18:6': 6, '20:4': 4 }[s?.fasting]
      const [h, m] = String(s?.fasting_start || '12:00')
        .split(':')
        .map(Number)
      const endMin = (h * 60 + m + (hours || 0) * 60) % 1440
      return { end: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}` }
    }
    case 'workout': {
      const sched = prefs.schedule
      if (sched?.type !== 'weekdays' || !Array.isArray(sched.days)) return null
      const planId = sched.days[local.weekday]
      if (!planId) return null
      if ((await workouts()).some((w) => w.date === today)) return null
      const { data: plan } = await db.from('plans').select('name').eq('id', planId).maybeSingle()
      return { plan: plan?.name || null }
    }
    case 'streak': {
      const ws = await workouts()
      if (ws.some((w) => w.date === today)) return null
      const last = ws[0]?.date
      if (!last) return null // noch nie trainiert → keine Serie
      const days = daysBetween(last, today)
      const lateWeek = local.weekday >= 3 // Do–So
      const danger = weekStart(last) !== weekStart(today) && days <= 9 && lateWeek
      if (days < DAYS_THRESHOLD && !danger) return null
      // höchstens alle 2 Tage
      const { data: recent } = await db
        .from('notification_log')
        .select('day')
        .eq('user_id', userId)
        .eq('kind', 'streak')
        .gte('day', shift(today, -1))
        .limit(1)
      if (recent?.length) return null
      return { danger, days }
    }
    case 'weigh': {
      const { data } = await db.from('body_weights').select('id').eq('user_id', userId).eq('date', today).limit(1)
      return data?.length ? null : {}
    }
    case 'review':
      return {}
    case 'body': {
      const { data } = await db
        .from('body_scans')
        .select('date')
        .eq('user_id', userId)
        .not('photo_path', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
      const last = data?.[0]?.date
      return last && daysBetween(last, today) >= 56 ? {} : null
    }
    default:
      return null
  }
}

async function send(db, subs, payload) {
  let n = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
      n++
    } catch (err) {
      // Abgelaufene Abos entfernen
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  return n
}
