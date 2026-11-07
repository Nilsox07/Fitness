// Daten für die Homescreen-Widgets „Laufwetter“ und „Ausdauer-Woche“ (Android).
// Der Wetter-Ort bleibt nur auf dem Gerät (grob gerundet ≈ 1 km). Reine Logik – getestet in outdoorWidget.test.ts.

import type { HealthActivity } from '../types'
import { ACTIVITY_LABEL, kmText, paceText } from './health'
import { dayLabel, shiftDate } from './day'
import { cardioTitle, type CardioKind, type CardioPlan } from './onboarding'

export interface WeatherLoc {
  lat: number
  lon: number
}

export interface CardioSnap {
  kind: CardioKind
  weekKm: number
  weekCount: number
  weekMin: number
  /** km je Tag Mo–So */
  days: number[]
  last: { label: string; when: string; dist: string; pace: string } | null
  plan: string | null
}

const KEY = 'weather_loc'
export const WEATHER_LOC_EVENT = 'weather-loc'

/** Auf 2 Nachkommastellen (≈ 1 km) – genauer braucht das Wetter nicht. */
export function roundLoc(lat: number, lon: number): WeatherLoc | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 }
}

export function getWeatherLoc(): WeatherLoc | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v ? roundLoc(Number(v.lat), Number(v.lon)) : null
  } catch {
    return null
  }
}

export function setWeatherLoc(loc: WeatherLoc | null) {
  try {
    if (loc) localStorage.setItem(KEY, JSON.stringify(loc))
    else localStorage.removeItem(KEY)
  } catch {
    /* privat/gesperrt – egal */
  }
  try {
    window.dispatchEvent(new Event(WEATHER_LOC_EVENT))
  } catch {
    /* kein Fenster (Tests) */
  }
}

const weekday = (date: string) => (new Date(date + 'T12:00:00').getDay() + 6) % 7
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Hauptsportart: aus dem Plan, sonst die häufigste der letzten Einheiten. */
export function mainKind(plan: CardioPlan | null, acts: readonly HealthActivity[]): CardioKind {
  if (plan && plan.kind !== 'any') return plan.kind
  const count = { run: 0, bike: 0, walk: 0 }
  for (const a of acts.slice(0, 20)) {
    if (a.type === 'run') count.run++
    else if (a.type === 'ride') count.bike++
    else if (a.type === 'walk' || a.type === 'hike') count.walk++
  }
  const best = (Object.entries(count) as [keyof typeof count, number][]).sort((a, b) => b[1] - a[1])[0]
  return best[1] > 0 ? best[0] : 'run'
}

/** Was laut Ausdauer-Plan heute bzw. als Nächstes ansteht. */
export function planLine(plan: CardioPlan | null, today: string, doneToday: boolean): string | null {
  if (!plan?.sessions.length) return null
  const wd = weekday(today)
  const todays = plan.sessions.find((s) => s.day === wd)
  if (todays && !doneToday) return `Heute: ${cardioTitle(todays)}`
  const next = plan.sessions.find((s) => s.day > wd) ?? plan.sessions[0]
  if (todays && doneToday && next === todays) return 'Heute erledigt'
  return `${todays && doneToday ? 'Erledigt · ' : ''}${WD[next.day]}: ${cardioTitle(next)}`
}

export function cardioSnapshot(i: {
  acts: readonly HealthActivity[]
  today: string
  plan: CardioPlan | null
  cardioDone: readonly string[]
}): CardioSnap {
  const monday = shiftDate(i.today, -weekday(i.today))
  const week = i.acts.filter((a) => {
    const d = a.started_at.slice(0, 10)
    return d >= monday && d <= i.today
  })
  const days = [0, 0, 0, 0, 0, 0, 0]
  for (const a of week) days[weekday(a.started_at.slice(0, 10))] += (a.distance_m ?? 0) / 1000
  const latest = [...i.acts].sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
  const doneToday = i.cardioDone.includes(i.today) || i.acts.some((a) => a.started_at.slice(0, 10) === i.today)
  const r1 = (n: number) => Math.round(n * 10) / 10
  return {
    kind: mainKind(i.plan, i.acts),
    weekKm: r1(week.reduce((s, a) => s + (a.distance_m ?? 0), 0) / 1000),
    weekCount: week.length,
    weekMin: Math.round(week.reduce((s, a) => s + a.duration_s, 0) / 60),
    days: days.map(r1),
    last: latest
      ? {
          label: ACTIVITY_LABEL[latest.type],
          when: dayLabel(latest.started_at.slice(0, 10), i.today),
          dist: latest.distance_m ? kmText(latest.distance_m) : '',
          pace: paceText(latest) ?? '',
        }
      : null,
    plan: planLine(i.plan, i.today, doneToday),
  }
}
