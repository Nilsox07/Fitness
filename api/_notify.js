// Erinnerungen: reine Logik (ohne DB/Push), damit testbar. Wird vom Cron
// /api/cron/reminders alle 15 Minuten aufgerufen. Die Einstellungen liegen in
// profiles.prefs.notify (+ prefs.tz), gepflegt unter Profil → Benachrichtigungen.

/** Standard je Art. time = lokale Uhrzeit „HH:MM“, days = Wochentage (0 = Mo … 6 = So). */
export const NOTIFY_DEFAULTS = {
  breakfast: { on: false, time: '09:30' },
  lunch: { on: true, time: '13:30' },
  dinner: { on: true, time: '19:30' },
  water: { on: true, time: '16:00' },
  protein: { on: true, time: '20:00' },
  fasting: { on: false },
  supplements: { on: true },
  workout: { on: true, time: '17:30' },
  streak: { on: true, time: '19:00' },
  weigh: { on: false, time: '08:00', days: [0] },
  review: { on: true, time: '09:00' },
  body: { on: true, time: '10:00' },
  social: { on: true },
}

export const NOTIFY_KINDS = Object.keys(NOTIFY_DEFAULTS)

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Gespeicherte Einstellungen mit Standardwerten zusammenführen (robust gegen Müll). */
export function normalizeNotify(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const k of NOTIFY_KINDS) {
    const d = NOTIFY_DEFAULTS[k]
    const v = r[k] && typeof r[k] === 'object' ? r[k] : {}
    const item = { on: typeof v.on === 'boolean' ? v.on : d.on }
    if (d.time) item.time = typeof v.time === 'string' && TIME_RE.test(v.time) ? v.time : d.time
    if (d.days) {
      const days = Array.isArray(v.days)
        ? [...new Set(v.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))]
        : null
      item.days = days && days.length ? days.sort() : d.days
    }
    out[k] = item
  }
  return out
}

export const toMin = (hhmm) => {
  const m = TIME_RE.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Lokale Zeit in einer Zeitzone: Datum (YYYY-MM-DD), Minuten seit Mitternacht, Wochentag (0 = Mo). */
export function localNow(tz, now = new Date()) {
  let zone = 'Europe/Berlin'
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz })
      zone = tz
    }
  } catch {
    /* ungültige Zone → Berlin */
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday)
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    min: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: wd < 0 ? 0 : wd,
  }
}

/** Fenster, in dem eine Erinnerung fällig ist (Cron alle 15 min → 30 min Puffer). */
export const WINDOW_MIN = 30

export function inWindow(nowMin, targetMin) {
  if (targetMin == null) return false
  const d = (((nowMin - targetMin) % 1440) + 1440) % 1440
  return d < WINDOW_MIN
}

/**
 * Welche Arten sind zur aktuellen lokalen Zeit grundsätzlich fällig (nur Uhrzeit/Wochentag)?
 * Ob wirklich etwas fehlt (z. B. Mittagessen schon eingetragen), prüft der Cron danach.
 */
export function dueKinds(notify, local) {
  const out = []
  for (const k of NOTIFY_KINDS) {
    const n = notify[k]
    if (!n?.on || !n.time) continue
    if (n.days && !n.days.includes(local.weekday)) continue
    if (k === 'review' && local.weekday !== 0) continue // Wochenfazit: montags
    if (k === 'body' && local.weekday !== 6) continue // Körperfoto: höchstens sonntags erinnern
    if (inWindow(local.min, toMin(n.time))) out.push(k)
  }
  return out
}

/** Essensfenster beim Intervallfasten: Öffnen und 30 min vor dem Schließen. */
export function fastingDue(fasting, fastingStart, local) {
  const hours = { '16:8': 8, '18:6': 6, '20:4': 4 }[fasting]
  const start = toMin(fastingStart)
  if (!hours || start == null) return null
  if (inWindow(local.min, start)) return 'open'
  if (inWindow(local.min, (start + hours * 60 - 30) % 1440)) return 'close'
  return null
}

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length]

/** Text je Art. ctx enthält die nötigen Zahlen (nur was die Art braucht). */
export function message(kind, ctx = {}, seed = 0) {
  switch (kind) {
    case 'breakfast':
      return {
        title: 'Buddy: Frühstück schon drin? 🥣',
        body: 'Kurz eintragen – dann passt der Rest vom Tag.',
        url: '/nutrition',
      }
    case 'lunch':
      return {
        title: 'Buddy: Mittagspause? 🍽️',
        body: pick(
          [
            'Trag dein Mittagessen ein, solange du noch weißt, was es war.',
            'Foto vom Teller reicht – den Rest mache ich.',
          ],
          seed,
        ),
        url: '/nutrition',
      }
    case 'dinner':
      return {
        title: 'Buddy: Was gab’s zum Abendessen? 🍝',
        body:
          ctx.kcalLeft > 0
            ? `Noch ${ctx.kcalLeft} kcal übrig heute – trag dein Abendessen ein.`
            : 'Trag dein Abendessen ein, dann ist der Tag komplett.',
        url: '/nutrition',
      }
    case 'water':
      return {
        title: 'Buddy: Trinkpause! 💧',
        body: `Erst ${ctx.drankL} von ${ctx.targetL} l – ein großes Glas jetzt?`,
        url: '/nutrition',
        actions: [
          { action: 'water250', title: '+250 ml', url: '/nutrition?addwater=250' },
          { action: 'water500', title: '+500 ml', url: '/nutrition?addwater=500' },
        ],
      }
    case 'protein':
      return {
        title: 'Buddy: Eiweiß fehlt noch 💪',
        body: `Noch ${ctx.missing} g bis zu deinem Ziel – Skyr, Quark oder ein Shake?`,
        url: '/recipes',
      }
    case 'fasting_open':
      return {
        title: 'Essensfenster ist offen 🍳',
        body: `Bis ${ctx.end} darfst du essen. Guten Appetit!`,
        url: '/nutrition',
      }
    case 'fasting_close':
      return {
        title: 'Noch 30 Minuten Essensfenster ⏳',
        body: 'Letzte Gelegenheit für eine eiweißreiche Mahlzeit.',
        url: '/nutrition',
      }
    case 'workout':
      return {
        title: 'Buddy: Heute ist Trainingstag 🏋️',
        body: ctx.plan
          ? `${ctx.plan} steht an. Ich hab schon die Schuhe an!`
          : 'Laut deinem Rhythmus ist heute Gym angesagt. Los geht’s!',
        url: '/',
      }
    case 'streak':
      return ctx.danger
        ? {
            title: 'Buddy: Unsere Serie wackelt! 🔥',
            body: pick(
              [
                'Nur noch ein Training diese Woche und die Serie hält. Heute?',
                'Keine Zeit? Ein 10-Minuten-Home-Workout zählt auch.',
              ],
              seed,
            ),
            url: '/',
          }
        : {
            title: 'Buddy vermisst das Gym 😴',
            body: pick(
              [
                `${ctx.days} Tage ohne Training – gehen wir heute?`,
                `Schon ${ctx.days} Tage Pause. Komm, nur eine kurze Einheit!`,
              ],
              seed,
            ),
            url: '/',
          }
    case 'supplement':
      return {
        title: `💊 Zeit für ${ctx.name}`,
        body: ctx.dose ? `${ctx.dose} – kurz abhaken, wenn erledigt.` : 'Kurz abhaken, wenn erledigt.',
        url: '/nutrition',
        actions: [{ action: 'taken', title: '✓ Genommen', url: `/nutrition?supp=${ctx.id}&slot=${ctx.slot}` }],
      }
    case 'weigh':
      return {
        title: 'Kurz auf die Waage ⚖️',
        body: 'Morgens nüchtern wiegen – dann wird die Trendkurve genau.',
        url: '/nutrition?weigh=1',
      }
    case 'review':
      return { title: 'Dein Wochenfazit ist da ✨', body: 'Buddy hat deine Woche ausgewertet – schau rein.', url: '/' }
    case 'body':
      return {
        title: 'Zeit für ein Vergleichsfoto 📸',
        body: 'Dein letztes Körperfoto ist über 8 Wochen alt – jetzt sieht man Unterschiede.',
        url: '/body',
      }
    default:
      return null
  }
}
