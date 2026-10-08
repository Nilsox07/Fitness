// Vercel Cron: schickt Push-Erinnerungen an Nutzer, die einige Tage nicht
// trainiert haben. Läuft serverseitig mit Service-Role-Key + VAPID.
//
// Nötige Env-Variablen (Vercel):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (z. B. mailto:du@mail.de)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   CRON_SECRET (optional, schützt den Endpoint)

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const DAYS_THRESHOLD = 3

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

/** ISO-Wochennummer (grob, für Streak-Vergleich). */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return `${t.getUTCFullYear()}-${Math.ceil(((t - yearStart) / 86400000 + 1) / 7)}`
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_SERVICE_ROLE_KEY } = process.env
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({ error: 'Push nicht konfiguriert' })
    return
  }

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: subs, error } = await supabase.from('push_subscriptions').select('*')
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  let sent = 0

  for (const sub of subs || []) {
    // Letztes Training des Nutzers
    const { data: last } = await supabase
      .from('workouts')
      .select('date')
      .eq('user_id', sub.user_id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastDate = last?.date ? new Date(last.date) : null
    const daysSince = lastDate ? daysBetween(today, lastDate) : 999

    // Streak in Gefahr: letztes Training in der Vorwoche, diese Woche noch nichts,
    // und es ist schon Do–So.
    const dow = today.getUTCDay() // So=0
    const lateWeek = dow === 0 || dow >= 4
    const streakDanger =
      lastDate && isoWeek(lastDate) !== isoWeek(today) && daysSince <= 9 && lateWeek

    if (daysSince < DAYS_THRESHOLD && !streakDanger) continue

    // Nicht öfter als alle 2 Tage erinnern
    if (sub.last_reminded && daysBetween(today, new Date(sub.last_reminded)) < 2) continue

    // Buddy spricht: ein paar Varianten, damit es nicht immer gleich klingt
    const pick = (arr) => arr[(today.getUTCDate() + sub.endpoint.length) % arr.length]
    const payload = JSON.stringify(
      streakDanger
        ? {
            title: 'Buddy: Unsere Serie wackelt! 🔥',
            body: pick([
              'Nur noch ein Training diese Woche und die Serie hält. Heute?',
              'Ich will die Serie nicht verlieren … kurzes Training reicht schon!',
              'Keine Zeit? 10-Minuten-Schnell-Workout zählt auch.',
            ]),
            tag: 'fitness-reminder',
            url: '/',
          }
        : {
            title: daysSince > 900 ? 'Buddy wartet auf dich 👋' : 'Buddy vermisst das Gym 😴',
            body:
              daysSince > 900
                ? 'Lass uns heute dein erstes Training machen!'
                : pick([
                    `${daysSince} Tage ohne Training – ich werd schon ganz müde. Gehen wir heute?`,
                    `Schon ${daysSince} Tage Pause. Komm, nur eine kurze Einheit!`,
                    `Ich langweile mich … ${daysSince} Tage kein Gym. Heute wieder?`,
                  ]),
            tag: 'fitness-reminder',
            url: '/',
          },
    )

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      await supabase.from('push_subscriptions').update({ last_reminded: todayStr }).eq('id', sub.id)
      sent++
    } catch (err) {
      // Abgelaufene Abos entfernen
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  res.status(200).json({ ok: true, sent })
}
