// Auswertungen der Smartwatch-Daten (Health Connect): Tagesform, Ausdauer, Schlaf.
// Reine Logik, ohne DB – getestet in health.test.ts.

import type { ActivityType, HealthActivity, HealthDaily, HealthSleep, RoutePoint } from '../types'

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

export type FactorStatus = 'gut' | 'normal' | 'schwach'

export interface ReadinessFactor {
  key: 'sleep' | 'hrv' | 'rhr' | 'load' | 'energy' | 'protein'
  label: string
  /** gemessener Wert, z. B. „6:40 h“ oder „58 ms“ */
  value: string
  /** Vergleich, z. B. „dein Schnitt 62 ms“ */
  normal: string | null
  status: FactorStatus
  /** ein Satz in Alltagssprache, was das bedeutet */
  text: string
  /** Beitrag zur Tagesform (intern, wird nicht angezeigt) */
  effect: number
}

export interface Readiness {
  score: number
  level: 'hoch' | 'mittel' | 'niedrig'
  advice: string
  factors: ReadinessFactor[]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const statusOf = (effect: number, goodFrom = 2, badBelow = -3): FactorStatus =>
  effect >= goodFrom ? 'gut' : effect <= badBelow ? 'schwach' : 'normal'

/** Erklärungen zum Antippen – was misst die Uhr da eigentlich? */
export const FACTOR_INFO: Record<ReadinessFactor['key'], string> = {
  sleep: 'Wie lange du letzte Nacht wirklich geschlafen hast (ohne Wachphasen). 7–9 Stunden sind ideal.',
  hrv: 'Herzratenvariabilität: wie stark der Abstand zwischen zwei Herzschlägen schwankt. Liegt sie über deinem eigenen Schnitt, ist dein Körper erholt. Deutlich darunter heißt Stress, Krankheit, Alkohol oder zu wenig Erholung.',
  rhr: 'Dein Puls in völliger Ruhe (meist nachts gemessen). Liegt er mehrere Schläge über deinem Normalwert, arbeitet der Körper noch – z. B. an Erholung oder einem Infekt.',
  load: 'Wie anstrengend dein Training gestern war (Dauer × Intensität, Kraft und Ausdauer zusammen).',
  energy: 'Ein großes Kaloriendefizit gestern bremst die Erholung von Muskeln und Nervensystem.',
  protein: 'Eiweiß repariert die Muskeln nach dem Training – genug davon beschleunigt die Erholung.',
}

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
    const e = Math.round(clamp((i.sleepMin / need - 0.9) * 80, -25, 10))
    const st = statusOf(e, 0, -5)
    f.push({
      key: 'sleep',
      label: 'Schlaf',
      value: hoursText(i.sleepMin),
      normal: `Ziel ${hoursText(need)}`,
      status: st,
      text:
        st === 'gut'
          ? 'Ausgeschlafen'
          : st === 'normal'
            ? 'Etwas kurz, aber okay'
            : 'Zu wenig Schlaf – Körper ist noch müde',
      effect: e,
    })
  }
  if (i.hrv != null && i.hrvBaseline) {
    const delta = (i.hrv - i.hrvBaseline) / i.hrvBaseline
    const e = Math.round(clamp(delta * 60, -15, 10))
    const st: FactorStatus = delta >= 0.03 ? 'gut' : delta <= -0.1 ? 'schwach' : 'normal'
    f.push({
      key: 'hrv',
      label: 'Erholung (HRV)',
      value: `${Math.round(i.hrv)} ms`,
      normal: `dein Schnitt ${Math.round(i.hrvBaseline)} ms`,
      status: st,
      text:
        st === 'gut'
          ? 'Über deinem Schnitt – dein Körper ist gut erholt'
          : st === 'normal'
            ? 'Im normalen Bereich'
            : 'Deutlich unter deinem Schnitt – Körper ist im Stress',
      effect: e,
    })
  }
  if (i.restingHr != null && i.restingHrBaseline) {
    const diff = i.restingHr - i.restingHrBaseline
    const e = Math.round(clamp(-diff * 2, -12, 5))
    const st: FactorStatus = diff <= -1 ? 'gut' : diff >= 3 ? 'schwach' : 'normal'
    f.push({
      key: 'rhr',
      label: 'Ruhepuls',
      value: `${Math.round(i.restingHr)} bpm`,
      normal: `normal ${Math.round(i.restingHrBaseline)} bpm`,
      status: st,
      text:
        st === 'schwach'
          ? `${Math.round(diff)} Schläge über normal – noch nicht ganz erholt`
          : st === 'gut'
            ? 'Niedriger als sonst – sehr gut'
            : 'Im normalen Bereich',
      effect: e,
    })
  }
  if (i.loadYesterday != null && i.loadYesterday > 0) {
    const e = -Math.round(clamp((i.loadYesterday - 60) / 12, 0, 10))
    f.push({
      key: 'load',
      label: 'Belastung gestern',
      value: loadLabel(i.loadYesterday),
      normal: null,
      status: e <= -4 ? 'schwach' : 'normal',
      text: e <= -4 ? 'Hartes Training – Muskeln brauchen noch Zeit' : 'Gut verkraftbar',
      effect: e,
    })
  }
  if (i.kcalBalanceYesterday != null && i.kcalBalanceYesterday < -700) {
    f.push({
      key: 'energy',
      label: 'Energie gestern',
      value: `−${Math.round(-i.kcalBalanceYesterday)} kcal`,
      normal: 'unter deinem Ziel',
      status: 'schwach',
      text: 'Großes Defizit – bremst die Erholung',
      effect: -6,
    })
  }
  if (i.proteinRatioYesterday != null) {
    const pct = Math.round(i.proteinRatioYesterday * 100)
    const e = i.proteinRatioYesterday < 0.7 ? -4 : i.proteinRatioYesterday >= 0.95 ? 3 : 0
    f.push({
      key: 'protein',
      label: 'Eiweiß gestern',
      value: `${pct} %`,
      normal: 'vom Ziel',
      status: statusOf(e),
      text: e > 0 ? 'Ziel erreicht – gut für die Muskeln' : e < 0 ? 'Zu wenig für gute Erholung' : 'Fast geschafft',
      effect: e,
    })
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
export function routePath(route: readonly RoutePoint[] | null | undefined, w: number, h: number, pad = 6): string {
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
    .map((p, i) => {
      const [lat, lng] = p
      const x = ox + (lng - minLng) * k * s
      const y = oy + (maxLat - lat) * s
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

// ---------- Belastung & Pulszonen ----------

/** Belastung in Worten (Skala wie TRIMP: ~50 locker, ~100 mittel, ~200 hart). */
export function loadLabel(load: number): string {
  if (load < 40) return 'leicht'
  if (load < 90) return 'mittel'
  if (load < 160) return 'hoch'
  return 'sehr hoch'
}

/** Maximalpuls: höchster gemessener Wert oder Faustformel 208 − 0,7 × Alter. */
export function estimateMaxHr(age: number | null | undefined, list: readonly { max_hr: number | null }[] = []): number {
  const formula = age ? Math.round(208 - 0.7 * age) : 190
  const seen = Math.max(0, ...list.map((a) => a.max_hr ?? 0))
  return Math.max(formula, seen)
}

export const ZONES = [
  { zone: 1, label: 'Locker', from: 0.5, color: 'rgb(var(--c-ruby) / 0.25)', info: 'Aufwärmen, Regeneration' },
  {
    zone: 2,
    label: 'Grundlage',
    from: 0.6,
    color: 'rgb(var(--c-ruby) / 0.45)',
    info: 'Fettstoffwechsel, Ausdauerbasis',
  },
  { zone: 3, label: 'Tempo', from: 0.7, color: 'rgb(var(--c-ruby) / 0.65)', info: 'Aerobe Fitness' },
  { zone: 4, label: 'Schwelle', from: 0.8, color: 'rgb(var(--c-ruby) / 0.85)', info: 'Tempohärte, Laktatschwelle' },
  { zone: 5, label: 'Maximum', from: 0.9, color: 'rgb(var(--c-ruby) / 1)', info: 'Sprints, maximale Leistung' },
] as const

/** Sekunden je Pulszone (1–5) aus einer Puls-Zeitreihe [[sekunde, bpm]]. */
export function zoneTimes(series: readonly [number, number][] | null | undefined, maxHr: number): number[] {
  const out = [0, 0, 0, 0, 0]
  if (!series || series.length < 2) return out
  for (let i = 0; i < series.length; i++) {
    const dt = i + 1 < series.length ? series[i + 1][0] - series[i][0] : series[i][0] - series[i - 1][0]
    const z = hrZone(series[i][1], maxHr)
    if (z && dt > 0 && dt < 600) out[z - 1] += dt
  }
  return out
}

/**
 * Trainingsbelastung nach Banister (TRIMP): Minuten × Intensität, exponentiell gewichtet.
 * Ohne Puls-Verlauf aus dem Durchschnittspuls geschätzt.
 */
export function trimp(
  a: Pick<HealthActivity, 'duration_s' | 'avg_hr'> & { hr_series?: [number, number][] | null },
  maxHr: number,
  restHr = 60,
): number {
  const w = (hr: number) => {
    const r = clamp((hr - restHr) / Math.max(1, maxHr - restHr), 0, 1)
    return r * 0.64 * Math.exp(1.92 * r)
  }
  const s = a.hr_series
  if (s && s.length >= 2) {
    let sum = 0
    for (let i = 1; i < s.length; i++) {
      const dt = (s[i][0] - s[i - 1][0]) / 60
      if (dt > 0 && dt < 10) sum += dt * w((s[i][1] + s[i - 1][1]) / 2)
    }
    return Math.round(sum)
  }
  return a.avg_hr ? Math.round((a.duration_s / 60) * w(a.avg_hr)) : Math.round((a.duration_s / 60) * 0.5)
}

/** Empfohlene Erholung in Stunden nach einer Einheit. */
export function recoveryHours(load: number): number {
  return Math.round(clamp(6 + load * 0.25, 6, 72) / 6) * 6
}

// ---------- Strecke: Kilometer-Zeiten & Höhenprofil ----------

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface Split {
  km: number
  /** Sekunden für diesen Abschnitt */
  seconds: number
  /** Länge (letzter Abschnitt oft < 1 km) */
  meters: number
  hr: number | null
  elevation: number | null
}

/** Kilometer-Abschnitte aus Strecke (mit Zeitstempeln) und Puls-Verlauf. */
export function kmSplits(
  route: readonly RoutePoint[] | null | undefined,
  hr: readonly [number, number][] | null | undefined,
  unit = 1000,
): Split[] {
  if (!route || route.length < 2 || route[0].length < 4) return []
  const pts = route as [number, number, number | null, number][]
  const splits: Split[] = []
  let dist = 0
  let startT = pts[0][3]
  let startAlt = pts[0][2]
  let segStart = 0
  const hrAvg = (from: number, to: number) => {
    const v = (hr ?? []).filter(([t]) => t >= from && t <= to).map(([, b]) => b)
    return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : null
  }
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1], pts[i])
    if (dist + d >= unit) {
      // Punkt genau bei der Kilometergrenze interpolieren
      const f = (unit - dist) / d
      const t = pts[i - 1][3] + f * (pts[i][3] - pts[i - 1][3])
      const alt = pts[i][2] != null && pts[i - 1][2] != null ? pts[i - 1][2]! + f * (pts[i][2]! - pts[i - 1][2]!) : null
      splits.push({
        km: splits.length + 1,
        seconds: Math.round(t - startT),
        meters: unit,
        hr: hrAvg(startT, t),
        elevation: alt != null && startAlt != null ? Math.round(alt - startAlt) : null,
      })
      startT = t
      startAlt = alt
      dist = d - (unit - dist)
      segStart = i
    } else dist += d
  }
  const last = pts[pts.length - 1]
  if (dist > 100 && segStart >= 0) {
    splits.push({
      km: splits.length + 1,
      seconds: Math.round(last[3] - startT),
      meters: Math.round(dist),
      hr: hrAvg(startT, last[3]),
      elevation: last[2] != null && startAlt != null ? Math.round(last[2] - startAlt) : null,
    })
  }
  return splits
}

/** Höhenprofil: [[km, höhe], …] – leer, wenn die Uhr keine Höhe liefert. */
export function elevationProfile(route: readonly RoutePoint[] | null | undefined): [number, number][] {
  if (!route || route.length < 2) return []
  const out: [number, number][] = []
  let dist = 0
  for (let i = 0; i < route.length; i++) {
    if (i) dist += haversine(route[i - 1], route[i])
    const alt = route[i][2]
    if (alt != null) out.push([Math.round(dist) / 1000, alt])
  }
  return out.length >= 2 ? out : []
}

// ---------- Schlaf im Detail ----------

export const STAGE = {
  1: { label: 'Wach', color: 'rgb(var(--c-gold))', normal: [0, 10] },
  2: { label: 'Leicht', color: 'rgb(var(--c-ruby) / 0.3)', normal: [45, 60] },
  3: { label: 'Tief', color: 'rgb(var(--c-ruby))', normal: [13, 23] },
  4: { label: 'REM', color: 'rgb(var(--c-ruby) / 0.6)', normal: [20, 25] },
  5: { label: 'Schlaf', color: 'rgb(var(--c-ruby) / 0.45)', normal: [0, 100] },
} as const

export interface SleepScore {
  score: number
  label: string
  /** Anteile an der Schlafzeit in % */
  pct: { light: number | null; deep: number | null; rem: number | null }
  efficiency: number | null
  /** false: Uhr liefert keine Schlafphasen → kein aussagekräftiger Score, nur die Dauer */
  detailed: boolean
  parts: { label: string; value: string; status: FactorStatus; hint: string }[]
}

/** Schlaf-Score 0–100: Dauer, Tief- & REM-Anteil, Effizienz, Unterbrechungen. */
export function sleepScore(n: HealthSleep, needMin = 480): SleepScore {
  const asleep = n.asleep_min
  const pct = (m: number | null | undefined) => (m != null && asleep > 0 ? Math.round((m / asleep) * 100) : null)
  const p = { light: pct(n.light_min), deep: pct(n.deep_min), rem: pct(n.rem_min) }
  const inBed = n.in_bed_min ?? Math.round((new Date(n.end_at).getTime() - new Date(n.start_at).getTime()) / 60000)
  // Ohne Phasen weiß die Uhr nicht, wann du wach lagst → keine Effizienz (wäre immer 100 %)
  const detailed = n.deep_min != null || n.rem_min != null || (n.stages?.length ?? 0) > 0
  const efficiency = detailed && inBed > 0 ? Math.round((asleep / inBed) * 100) : null

  let score = 0
  const parts: SleepScore['parts'] = []
  const dur = clamp(asleep / needMin, 0, 1.1)
  score += Math.min(50, dur * 50)
  parts.push({
    label: 'Dauer',
    value: hoursText(asleep),
    status: asleep >= needMin * 0.9 ? 'gut' : asleep >= needMin * 0.75 ? 'normal' : 'schwach',
    hint: '7–9 h sind ideal',
  })
  if (p.deep != null) {
    score += clamp(p.deep / 18, 0, 1) * 15
    parts.push({
      label: 'Tiefschlaf',
      value: `${p.deep} %`,
      status: p.deep >= 13 ? 'gut' : p.deep >= 9 ? 'normal' : 'schwach',
      hint: 'körperliche Erholung · normal 13–23 %',
    })
  } else score += 10
  if (p.rem != null) {
    score += clamp(p.rem / 21, 0, 1) * 15
    parts.push({
      label: 'REM',
      value: `${p.rem} %`,
      status: p.rem >= 18 ? 'gut' : p.rem >= 13 ? 'normal' : 'schwach',
      hint: 'Kopf & Gedächtnis · normal 20–25 %',
    })
  } else score += 10
  if (efficiency != null) {
    score += clamp((efficiency - 70) / 25, 0, 1) * 10
    parts.push({
      label: 'Effizienz',
      value: `${efficiency} %`,
      status: efficiency >= 88 ? 'gut' : efficiency >= 80 ? 'normal' : 'schwach',
      hint: 'Anteil der Bettzeit im Schlaf',
    })
  }
  const aw = n.awakenings ?? null
  score += aw == null ? 7 : clamp(1 - aw / 8, 0, 1) * 10
  if (aw != null)
    parts.push({
      label: 'Aufgewacht',
      value: `${aw}×`,
      status: aw <= 2 ? 'gut' : aw <= 5 ? 'normal' : 'schwach',
      hint: 'kurzes Aufwachen ist normal',
    })
  if (n.latency_min != null)
    parts.push({
      label: 'Eingeschlafen nach',
      value: `${n.latency_min} min`,
      status: n.latency_min <= 20 ? 'gut' : n.latency_min <= 40 ? 'normal' : 'schwach',
      hint: 'unter 20 min ist gut',
    })

  const s = Math.round(clamp(score, 0, 100))
  return {
    score: s,
    label: s >= 85 ? 'Ausgezeichnet' : s >= 70 ? 'Gut' : s >= 55 ? 'Okay' : 'Schlecht',
    pct: p,
    efficiency,
    detailed,
    parts,
  }
}

// ---------- Vitalwerte ----------

export interface Normal {
  mean: number
  lo: number
  hi: number
}

/** Persönlicher Normalbereich (Mittel ± 1 Standardabweichung) aus mind. 5 Werten. */
export function personalNormal(values: readonly (number | null | undefined)[]): Normal | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x))
  if (v.length < 5) return null
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)
  return { mean, lo: mean - sd, hi: mean + sd }
}

/** VO₂max-Einordnung nach Alter und Geschlecht (vereinfachte Cooper-Tabellen). */
export function vo2Category(vo2: number, age: number | null | undefined, sex: string | null | undefined): string {
  const a = age ?? 35
  const base = sex === 'f' || sex === 'female' ? 35 : 42
  const ref = base - Math.max(0, a - 30) * 0.3
  const d = vo2 - ref
  if (d >= 10) return 'Ausgezeichnet'
  if (d >= 5) return 'Sehr gut'
  if (d >= 0) return 'Gut'
  if (d >= -5) return 'Durchschnitt'
  return 'Ausbaufähig'
}

/** Blutdruck-Einordnung (ESC/ESH). */
export function bpCategory(sys: number, dia: number): { label: string; status: FactorStatus } {
  if (sys >= 140 || dia >= 90) return { label: 'Erhöht – ärztlich abklären', status: 'schwach' }
  if (sys >= 130 || dia >= 85) return { label: 'Hoch-normal', status: 'normal' }
  if (sys < 90 || dia < 60) return { label: 'Niedrig', status: 'normal' }
  return { label: 'Optimal', status: 'gut' }
}

// ---------- Was liefert die Uhr überhaupt? ----------

export type Capability = 'sleep' | 'stages' | 'hrv' | 'restingHr' | 'steps' | 'spo2' | 'activities' | 'hrSeries'

export interface Capabilities {
  /** Gibt es überhaupt schon Daten? Vorher ist „nicht unterstützt“ nicht entscheidbar. */
  known: boolean
  has: Record<Capability, boolean>
}

/**
 * Welche Werte die verbundene Uhr tatsächlich liefert (aus den letzten Wochen).
 * Nicht jede Uhr misst HRV, Schlafphasen oder Sauerstoff – was fehlt, blenden wir aus,
 * statt dauerhaft „keine Daten“ zu zeigen.
 */
export function capabilities(
  daily: readonly HealthDaily[] = [],
  sleep: readonly HealthSleep[] = [],
  activities: readonly HealthActivity[] = [],
): Capabilities {
  const anyDaily = (k: keyof HealthDaily) => daily.some((d) => d[k] != null)
  return {
    known: daily.length + sleep.length + activities.length > 0,
    has: {
      sleep: sleep.length > 0,
      stages: sleep.some((n) => n.deep_min != null || (n.stages?.length ?? 0) > 0),
      hrv: anyDaily('hrv_ms') || sleep.some((n) => n.hrv_avg != null),
      restingHr: anyDaily('resting_hr'),
      steps: anyDaily('steps'),
      spo2: anyDaily('spo2') || sleep.some((n) => n.spo2_avg != null),
      activities: activities.length > 0,
      hrSeries: activities.some((a) => (a.hr_series?.length ?? 0) > 1),
    },
  }
}

/** Welche Tagesform-Eingänge fehlen, weil die Uhr sie nicht misst? (für einen kurzen Hinweis) */
export function missingReadinessInputs(c: Capabilities): string[] {
  if (!c.known) return []
  const out: string[] = []
  if (!c.has.sleep) out.push('Schlaf')
  if (!c.has.hrv) out.push('HRV')
  if (!c.has.restingHr) out.push('Ruhepuls')
  return out
}
