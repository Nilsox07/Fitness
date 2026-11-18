// Wann stehst du morgen auf? Nicht jeder Tag ist gleich: am Wochenende und an Feiertagen schlafen die
// meisten länger, manche haben einen festen anderen Tag (z. B. freitags frei), und im Urlaub verschiebt
// sich alles. Daraus ergibt sich die Schlafenszeit-Erinnerung am Abend davor.
// Reine Logik – getestet in wakeRhythm.test.ts.

import { localDate, shiftDate } from './day'

/** Ostersonntag (Gauß/Meeus) als YYYY-MM-DD. */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Bundesweite Feiertage in Deutschland (+ Heiligabend/Silvester, an denen die meisten frei haben). */
export function germanHolidays(year: number): Map<string, string> {
  const e = easterSunday(year)
  const fixed = (md: string) => `${year}-${md}`
  return new Map([
    [fixed('01-01'), 'Neujahr'],
    [shiftDate(e, -2), 'Karfreitag'],
    [shiftDate(e, 1), 'Ostermontag'],
    [fixed('05-01'), 'Tag der Arbeit'],
    [shiftDate(e, 39), 'Christi Himmelfahrt'],
    [shiftDate(e, 50), 'Pfingstmontag'],
    [fixed('10-03'), 'Tag der Deutschen Einheit'],
    [fixed('12-24'), 'Heiligabend'],
    [fixed('12-25'), '1. Weihnachtstag'],
    [fixed('12-26'), '2. Weihnachtstag'],
    [fixed('12-31'), 'Silvester'],
  ])
}

export const weekdayOf = (date: string) => (new Date(date + 'T12:00:00').getDay() + 6) % 7 // 0 = Mo

/** Freier Tag (Wochenende/Feiertag) – mit Namen des Feiertags. */
export function dayKind(date: string): { free: boolean; holiday: string | null } {
  const holiday = germanHolidays(Number(date.slice(0, 4))).get(date) ?? null
  return { free: holiday != null || weekdayOf(date) >= 5, holiday }
}

const WEEKDAY = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const round5 = (m: number) => Math.round(m / 5) * 5
const fmt = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export interface WakeGuess {
  /** „H:MM“ */
  wake: string
  free: boolean
  /** Kurz, für die Anzeige: „Samstag – du schläfst meist länger“ */
  reason: string
}

/**
 * Aufstehzeit für `date` (der Morgen nach der Nacht). Aus den Nächten der letzten 6 Wochen:
 *  1. die letzten 3 gleicher Art sind sich einig und anders als vorher → neuer Rhythmus (Urlaub, Schicht)
 *  2. gleicher Wochentag weicht klar ab (z. B. freitags frei) → der
 *  3. sonst gleiche Art Tag (Werktag/frei), die letzten 6 davon
 * `manual` = feste Aufstehzeit aus den Einstellungen; gilt für Werktage, freie Tage lernen weiter.
 */
export function predictWake(
  nights: readonly { end_at: string }[],
  date: string,
  manual: string | null = null,
): WakeGuess | null {
  const kind = dayKind(date)
  const wd = weekdayOf(date)
  const label = kind.holiday ?? WEEKDAY[wd]
  const from = shiftDate(date, -42)
  const samples = nights
    .filter((n) => n.end_at)
    .map((n) => {
      const d = new Date(n.end_at)
      return { date: localDate(d), min: d.getHours() * 60 + d.getMinutes() }
    })
    // Mittagsschlaf o. ä. (Ende nach 14 Uhr) zählt nicht als Aufstehen
    .filter((s) => s.date >= from && s.date < date && s.min < 14 * 60)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const sameKind = samples.filter((s) => dayKind(s.date).free === kind.free)
  const sameDay = samples.filter((s) => weekdayOf(s.date) === wd && !dayKind(s.date).holiday)

  if (manual && !kind.free) return { wake: manual, free: false, reason: `${label} – deine feste Aufstehzeit` }

  const kindMin = sameKind.length >= 3 ? median(sameKind.slice(0, 6).map((s) => s.min)) : null
  // neuer Rhythmus (geht vor, Urlaub schlägt den üblichen Wochentag):
  // die letzten 3 einig und alle mind. 45 min anders als die davor
  if (kindMin != null) {
    const recent = sameKind.slice(0, 3).map((s) => s.min)
    const before = sameKind.slice(3, 9).map((s) => s.min)
    if (before.length >= 2) {
      const r = median(recent)
      const b = median(before)
      const tight = Math.max(...recent) - Math.min(...recent) <= 90
      if (tight && recent.every((m) => Math.abs(m - b) >= 45) && Math.abs(r - b) >= 45)
        return {
          wake: fmt(round5(r)),
          free: kind.free,
          reason: `${label} – zuletzt ${r > b ? 'später' : 'früher'} auf`,
        }
    }
  }
  // fester anderer Wochentag (nicht an Feiertagen)
  if (!kind.holiday && sameDay.length >= 3) {
    const dayMin = median(sameDay.slice(0, 4).map((s) => s.min))
    if (kindMin == null || Math.abs(dayMin - kindMin) >= 45)
      return { wake: fmt(round5(dayMin)), free: kind.free, reason: `${label} – wie meist an dem Tag` }
  }
  if (kindMin != null) {
    const reason = kind.holiday
      ? `${label} – frei, du schläfst meist länger`
      : kind.free
        ? `${label} – du schläfst meist länger`
        : `${label} – wie an Werktagen`
    return { wake: fmt(round5(kindMin)), free: kind.free, reason }
  }
  // Freier Tag ohne eigene Daten: feste Zeit + 1 h bzw. Werktags-Rhythmus + 1 h
  if (kind.free) {
    const work = manual ? toMin(manual) : samples.length >= 3 ? median(samples.slice(0, 6).map((s) => s.min)) : null
    if (work != null)
      return { wake: fmt(round5(work + 60)), free: true, reason: `${label} – frei, etwas länger schlafen` }
  }
  if (manual) return { wake: manual, free: kind.free, reason: `${label} – deine feste Aufstehzeit` }
  if (samples.length >= 4)
    return { wake: fmt(round5(median(samples.slice(0, 14).map((s) => s.min)))), free: kind.free, reason: label }
  return null
}

/** Morgen, für den heute Abend geplant wird (nach Mitternacht bis 4 Uhr: noch „diese“ Nacht). */
export function wakeDateFor(now = new Date()): string {
  const today = localDate(now)
  return now.getHours() < 4 ? today : shiftDate(today, 1)
}
