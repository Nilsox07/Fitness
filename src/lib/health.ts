// Auswertungen der Smartwatch-Daten (Health Connect): Tagesform, Ausdauer, Schlaf.
// Reine Logik, ohne DB – getestet in health.test.ts.

import type { ActivityType, HealthActivity, HealthDaily, HealthSleep } from '../types'

// ---------- Aktivitäten ----------

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: 'Laufen',
  ride: 'Radfahren',
  walk: 'Gehen',
  hike: 'Wandern',
  swim: 'Schwimmen',
  row: 'Rudern',
  other: 'Ausdauer',
}

export const ACTIVITY_EMOJI: Record<ActivityType, string> = {
  run: '🏃',
  ride: '🚴',
  walk: '🚶',
  hike: '🥾',
  swim: '🏊',
  row: '🚣',
  other: '⚡',
}

/** Tempo als „5:12 /km“ (Laufen, Gehen, Wandern) bzw. Geschwindigkeit „24,3 km/h“ (Rad). */
export function paceText(a: Pick<HealthActivity, 'type' | 'duration_s' | 'distance_m'>): string | null {
  if (!a.distance_m || a.distance_m < 50 || a.duration_s <= 0) return null
  if (a.type === 'swim') {
    const per100 = a.duration_s / (a.distance_m / 100)
    return `${mmss(per100)} /100 m`
  }
  if (a.type === 'ride' || a.type === 'row' || a.type === 'other') {
    const kmh = a.distance_m / 1000 / (a.duration_s / 3600)
    return `${kmh.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km/h`
  }
  return `${mmss(a.duration_s / (a.distance_m / 1000))} /km`
}

/** Sekunden → „5:07“ */
export function mmss(sec: number): string {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Dauer → „1:05 h“ oder „42 min“ */
export function durationText(sec: number): string {
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`
}

export function kmText(m: number | null | undefined): string {
  if (!m) return '–'
  return `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: m >= 10000 ? 1 : 2 })} km`
}

/** Belastung einer Einheit: Minuten × Intensität (Puls relativ zum Maximalpuls). */
export function activityLoad(a: Pick<HealthActivity, 'duration_s' | 'avg_hr'>, maxHr = 190): number {
  const min = a.duration_s / 60
  const intensity = a.avg_hr ? Math.min(1.2, Math.max(0.4, a.avg_hr / maxHr)) : 0.65
  return Math.round(min * intensity * intensity * 1.5)
}

export interface CardioWeek {
  count: number
  distance_m: number
  duration_s: number
  load: number
  byType: { type: ActivityType; count: number; distance_m: number; duration_s: number }[]
}

/** Summen für einen Zeitraum [from, to] (ISO-Daten, inklusive). */
export function cardioSummary(list: readonly HealthActivity[], from: string, to: string): CardioWeek {
  const inRange = list.filter((a) => {
    const d = a.started_at.slice(0, 10)
    return d >= from && d <= to
  })
  const by = new Map<ActivityType, { type: ActivityType; count: number; distance_m: number; duration_s: number }>()
  for (const a of inRange) {
    const t = by.get(a.type) ?? { type: a.type, count: 0, distance_m: 0, duration_s: 0 }
    t.count++
    t.distance_m += a.distance_m ?? 0
    t.duration_s += a.duration_s
    by.set(a.type, t)
  }
  return {
    count: inRange.length,
    distance_m: inRange.reduce((s, a) => s + (a.distance_m ?? 0), 0),
    duration_s: inRange.reduce((s, a) => s + a.duration_s, 0),
    load: inRange.reduce((s, a) => s + activityLoad(a), 0),
    byType: [...by.values()].sort((a, b) => b.duration_s - a.duration_s),
  }
}

/** Bestleistungen je Sportart: längste Strecke, schnellstes Tempo (ab 3 km bzw. 10 km Rad). */
export function activityBests(list: readonly HealthActivity[], type: ActivityType) {
  const own = list.filter((a) => a.type === type && a.distance_m && a.duration_s > 0)
  if (!own.length) return null
  const longest = own.reduce((b, a) => ((a.distance_m ?? 0) > (b.distance_m ?? 0) ? a : b))
  const minDist = type === 'ride' ? 10000 : 3000
  const fast = own.filter((a) => (a.distance_m ?? 0) >= minDist)
  const fastest = fast.length
    ? fast.reduce((b, a) => (a.duration_s / a.distance_m! < b.duration_s / b.distance_m! ? a : b))
    : null
  return { longest, fastest }
}

/** Herzfrequenz-Zone 1–5 aus dem Durchschnittspuls. */
export function hrZone(avgHr: number | null | undefined, maxHr = 190): number | null {
  if (!avgHr) return null
  const p = avgHr / maxHr
  if (p < 0.6) return 1
  if (p < 0.7) return 2
  if (p < 0.8) return 3
  if (p < 0.9) return 4
  return 5
}

// ---------- Schlaf ----------

export function hoursText(min: number): string {
  return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')} h`
}

export interface SleepStats {
  avgMin: number
  /** Schwankung der Einschlafzeit in Minuten (kleiner = regelmäßiger) */
  bedtimeSpreadMin: number
  nights: number
}

/** Durchschnitt und Regelmäßigkeit der letzten Nächte. */
export function sleepStats(list: readonly HealthSleep[]): SleepStats | null {
  if (!list.length) return null
  const avgMin = Math.round(list.reduce((s, n) => s + n.asleep_min, 0) / list.length)
  // Einschlafzeit als Minuten relativ zu 18 Uhr (damit 23:30 und 0:30 nah beieinander liegen)
  const bed = list.map((n) => {
    const d = new Date(n.start_at)
    return (((d.getHours() - 18 + 24) % 24) * 60 + d.getMinutes()) as number
  })
  const mean = bed.reduce((a, b) => a + b, 0) / bed.length
  const sd = Math.sqrt(bed.reduce((a, b) => a + (b - mean) ** 2, 0) / bed.length)
  return { avgMin, bedtimeSpreadMin: Math.round(sd), nights: list.length }
}

// ---------- Tagesform ----------

export interface ReadinessInput {
  /** Schlaf letzte Nacht (min) */
  sleepMin?: number | null
  /** Schlafbedarf (min), Standard 8 h */
  sleepNeedMin?: number
  hrv?: number | null
  /** Durchschnitt der letzten 2 Wochen */
  hrvBaseline?: number | null
  restingHr?: number | null
  restingHrBaseline?: number | null
  /** Belastung gestern (Ausdauer-Load + Krafttraining) */
  loadYesterday?: number | null
  /** gegessen − Ziel gestern (kcal), negativ = Defizit */
  kcalBalanceYesterday?: number | null
  /** gegessenes / Ziel-Eiweiß gestern (0–1+) */
  proteinRatioYesterday?: number | null
}

export interface ReadinessFactor {
  label: string
  effect: number
  text: string
}

export interface Readiness {
  score: number
  level: 'hoch' | 'mittel' | 'niedrig'
  advice: string
  factors: ReadinessFactor[]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Tagesform 0–100 aus Schlaf, HRV, Ruhepuls, Belastung – und (das kann sonst
 * keine Uhr) der Ernährung von gestern. Fehlende Werte zählen neutral.
 * Gibt null zurück, wenn gar keine Uhr-Daten da sind.
 */
export function readiness(i: ReadinessInput): Readiness | null {
  if (i.sleepMin == null && i.hrv == null && i.restingHr == null) return null
  const f: ReadinessFactor[] = []

  if (i.sleepMin != null) {
    const need = i.sleepNeedMin ?? 480
    const ratio = i.sleepMin / need
    const e = Math.round(clamp((ratio - 0.9) * 80, -25, 10))
    f.push({
      label: 'Schlaf',
      effect: e,
      text: e >= 0 ? `${hoursText(i.sleepMin)} – gut erholt` : `nur ${hoursText(i.sleepMin)}`,
    })
  }
  if (i.hrv != null && i.hrvBaseline) {
    const delta = (i.hrv - i.hrvBaseline) / i.hrvBaseline
    const e = Math.round(clamp(delta * 60, -15, 10))
    f.push({
      label: 'HRV',
      effect: e,
      text: e >= 0 ? 'Nervensystem entspannt' : 'unter deinem Schnitt – Körper ist gestresst',
    })
  }
  if (i.restingHr != null && i.restingHrBaseline) {
    const diff = i.restingHr - i.restingHrBaseline
    const e = Math.round(clamp(-diff * 2, -12, 5))
    f.push({
      label: 'Ruhepuls',
      effect: e,
      text: diff > 2 ? `${Math.round(diff)} Schläge über normal` : 'im normalen Bereich',
    })
  }
  if (i.loadYesterday != null && i.loadYesterday > 60) {
    const e = -Math.round(clamp((i.loadYesterday - 60) / 12, 0, 10))
    if (e < 0) f.push({ label: 'Belastung', effect: e, text: 'gestern hart trainiert' })
  }
  if (i.kcalBalanceYesterday != null && i.kcalBalanceYesterday < -700) {
    f.push({ label: 'Energie', effect: -6, text: `gestern ${Math.round(-i.kcalBalanceYesterday)} kcal im Defizit` })
  }
  if (i.proteinRatioYesterday != null) {
    if (i.proteinRatioYesterday < 0.7) f.push({ label: 'Eiweiß', effect: -4, text: 'gestern zu wenig Eiweiß' })
    else if (i.proteinRatioYesterday >= 0.95)
      f.push({ label: 'Eiweiß', effect: 3, text: 'Eiweißziel gestern erreicht' })
  }

  const score = Math.round(clamp(72 + f.reduce((s, x) => s + x.effect, 0), 5, 99))
  const level = score >= 75 ? 'hoch' : score >= 50 ? 'mittel' : 'niedrig'
  const advice =
    level === 'hoch'
      ? 'Guter Tag für schweres Training oder eine neue Bestleistung.'
      : level === 'mittel'
        ? 'Normal trainieren – aber auf dein Gefühl hören.'
        : 'Heute lieber locker: Technik, Mobility oder Pause.'
  return { score, level, advice, factors: f.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)) }
}

/** Durchschnitt eines Tageswerts über die Tage vor `date` (für HRV/Ruhepuls-Basis). */
export function baseline(
  days: readonly HealthDaily[],
  key: 'hrv_ms' | 'resting_hr',
  date: string,
  span = 14,
): number | null {
  const vals = days
    .filter((d) => d.date < date && d[key] != null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, span)
    .map((d) => d[key] as number)
  return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

// ---------- Strecke ----------

/** Strecke als SVG-Pfad (ohne Karte) – projiziert auf eine Box w × h mit Rand. */
export function routePath(
  route: readonly [number, number][] | null | undefined,
  w: number,
  h: number,
  pad = 6,
): string {
  if (!route || route.length < 2) return ''
  const lats = route.map((p) => p[0])
  const lngs = route.map((p) => p[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  // Längengrade schrumpfen mit dem Breitengrad
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const spanX = (maxLng - minLng) * k || 1e-9
  const spanY = maxLat - minLat || 1e-9
  const s = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY)
  const ox = (w - spanX * s) / 2
  const oy = (h - spanY * s) / 2
  return route
    .map(([lat, lng], i) => {
      const x = ox + (lng - minLng) * k * s
      const y = oy + (maxLat - lat) * s
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}
