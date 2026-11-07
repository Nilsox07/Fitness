// Erinnerungen: reine Logik (ohne DB/Push), damit testbar. Wird vom Cron
// /api/cron/reminders alle 15 Minuten aufgerufen. Die Einstellungen liegen in
// profiles.prefs.notify (+ prefs.tz), gepflegt unter Profil → Benachrichtigungen.

import { reminderCopy } from './_reminderCopy.js'
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
  // nur in der App (lokal geplant): Zeit hängt von Schlaf & Belastung ab
  bedtime: { on: true },
}

export const NOTIFY_KINDS = Object.keys(NOTIFY_DEFAULTS)

/** Arten, die zum Ernährungs- bzw. Community-Modul gehören (abgeschaltet → keine Erinnerung). */
const NUTRITION_KINDS = [
  'breakfast',
  'lunch',
  'dinner',
  'water',
  'protein',
  'fasting',
  'fasting_open',
  'fasting_close',
  'supplements',
]
const SOCIAL_KINDS = ['social']

/** Ist die Art bei diesen Modulen (profiles.prefs.modules) erlaubt? Unbekannt = an. */
export function moduleAllows(kind, modules) {
  const m = modules && typeof modules === 'object' ? modules : {}
  const base = String(kind).startsWith('supp:') ? 'supplements' : kind
  if (m.nutrition === false && NUTRITION_KINDS.includes(base)) return false
  if (m.social === false && SOCIAL_KINDS.includes(base)) return false
  return true
}

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

/** Text je Art (Formulierungen in _reminderCopy.js, gemeinsam mit der App) + Ziel-Seite/Aktionen. */
export function message(kind, ctx = {}, seed = 0) {
  const copy = reminderCopy(kind, ctx, seed)
  if (!copy) return null
  const url =
    kind === 'workout' || kind === 'streak'
      ? '/'
      : kind === 'weigh' || kind === 'body'
        ? '/body'
        : kind === 'review'
          ? '/profile?s=review'
          : '/nutrition'
  const extra =
    kind === 'water'
      ? {
          actions: [
            { action: 'water250', title: '+250 ml', url: '/nutrition?addwater=250' },
            { action: 'water500', title: '+500 ml', url: '/nutrition?addwater=500' },
          ],
        }
      : kind === 'supplement'
        ? { actions: [{ action: 'taken', title: 'Genommen', url: `/nutrition?supp=${ctx.id}&slot=${ctx.slot}` }] }
        : {}
  return { ...copy, url, ...extra }
}
