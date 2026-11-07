// Erkenntnisse: kurze Karten aus Daten, die schon da sind (Uhr, Training, Gewicht, Essen).
// Jede Karte erscheint nur, wenn die Daten dafür reichen – sonst fehlt sie einfach.
// Reine Logik, getestet in insights.test.ts.

import { activityLoad, baseline, hoursText, readiness, type Readiness } from './health'
import { shiftDate } from './day'
import type { HealthActivity, HealthDaily, HealthSleep } from '../types'

export type InsightGroup = 'load' | 'heart' | 'sleep' | 'activity' | 'energy'

/** good = echte Bewertung „gut“ (grün), hint = Hinweis (gold), neutral = nur Information */
export type InsightTone = 'good' | 'hint' | 'neutral'

export type InsightIcon =
  | 'load'
  | 'heart'
  | 'hrv'
  | 'vo2'
  | 'age'
  | 'sleep'
  | 'clock'
  | 'calendar'
  | 'steps'
  | 'zap'
  | 'flame'
  | 'link'
  | 'mind'

export interface Insight {
  id: string
  group: InsightGroup
  icon: InsightIcon
  /** eine Zeile */
  title: string
  /** eine Zeile */
  value: string
  /** Erklärung hinter dem (i) */
  info: string
  tone: InsightTone
  /** höher = wichtiger (Reihenfolge in der Übersicht) */
  priority: number
  /** kleine Grafik unter dem Wert (optional) */
  viz?: InsightViz
}

/**
 * meter: Wert auf einer Skala 0–max, optional mit Ziel-/Idealbereich lo–hi.
 * compare: zwei Werte nebeneinander (z. B. „jetzt“ gegen „Schnitt“), gleiche Einheit.
 */
export type InsightViz =
  | { kind: 'meter'; value: number; max: number; lo?: number; hi?: number }
  | { kind: 'compare'; unit: string; a: { label: string; value: number }; b: { label: string; value: number } }

export const INSIGHT_GROUPS: { key: InsightGroup; label: string }[] = [
  { key: 'load', label: 'Belastung' },
  { key: 'heart', label: 'Herz' },
  { key: 'sleep', label: 'Schlaf' },
  { key: 'activity', label: 'Aktivität' },
  { key: 'energy', label: 'Energie' },
]

// ---------- Hilfen ----------

const DAY_MS = 86400000
const dayNum = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}
const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a)
const mean = (v: readonly number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN)
const de = (v: number, d = 0) => v.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: 0 })
const signed = (v: number, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${de(Math.abs(v), d)}`
/** Wochentag 0 = Sonntag (unabhängig von der Zeitzone) */
const weekday = (date: string) => new Date(dayNum(date) * DAY_MS).getUTCDay()
const WEEKDAY = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const actDate = (a: Pick<HealthActivity, 'started_at'>) => a.started_at.slice(0, 10)
const inWindow = (date: string, from: string, to: string) => date >= from && date <= to

// ---------- Belastung (akut : chronisch) ----------

/** Belastungspunkte je Arbeitssatz Krafttraining: 20 Sätze ≈ 50 ≈ 50 min lockerer Lauf (activityLoad). */
export const STRENGTH_LOAD_PER_SET = 2.5

/** Belastung je Tag aus Ausdauer-Einheiten (Dauer × Puls) und Kraft-Arbeitssätzen. */
export function dailyLoad(
  activities: readonly Pick<HealthActivity, 'started_at' | 'duration_s' | 'avg_hr'>[],
  strengthSetDates: readonly string[],
  maxHr = 190,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const a of activities) out.set(actDate(a), (out.get(actDate(a)) ?? 0) + activityLoad(a, maxHr))
  for (const d of strengthSetDates) out.set(d, (out.get(d) ?? 0) + STRENGTH_LOAD_PER_SET)
  return out
}

export interface LoadRatio {
  /** Ø Belastung pro Tag, letzte 7 Tage */
  acute: number
  /** Ø Belastung pro Tag, letzte 28 Tage */
  chronic: number
  ratio: number
  status: 'high' | 'rising' | 'ok' | 'low'
}

/**
 * Akut-zu-chronisch-Verhältnis (ACWR): Ø der letzten 7 Tage geteilt durch Ø der letzten 28 Tage.
 * Braucht mind. 21 Tage Verlauf und 4 Trainingstage in 28 Tagen.
 * > 1,5 zu schneller Anstieg (Verletzungsrisiko), 0,8–1,3 „grüner Bereich“, < 0,8 Form baut ab.
 */
export function loadRatio(load: ReadonlyMap<string, number>, today: string): LoadRatio | null {
  const dates = [...load.keys()].filter((d) => d <= today && load.get(d)! > 0)
  if (!dates.length) return null
  const first = dates.reduce((a, b) => (a < b ? a : b))
  if (daysBetween(first, today) < 21) return null
  const from28 = shiftDate(today, -27)
  const from7 = shiftDate(today, -6)
  const in28 = dates.filter((d) => d >= from28)
  if (in28.length < 4) return null
  const sum = (from: string) => dates.filter((d) => d >= from).reduce((s, d) => s + load.get(d)!, 0)
  const acute = sum(from7) / 7
  const chronic = sum(from28) / 28
  if (chronic <= 0) return null
  const ratio = Math.round((acute / chronic) * 100) / 100
  const status = ratio > 1.5 ? 'high' : ratio > 1.3 ? 'rising' : ratio >= 0.8 ? 'ok' : 'low'
  return { acute, chronic, ratio, status }
}

function loadInsight(r: LoadRatio): Insight {
  return { ...loadInsightBase(r), viz: { kind: 'meter', value: r.ratio, max: 2, lo: 0.8, hi: 1.3 } }
}

function loadInsightBase(r: LoadRatio): Insight {
  const value = `${de(r.ratio, 1)}× dein 4-Wochen-Schnitt`
  const info =
    'Verglichen wird deine Belastung der letzten 7 Tage (Ausdauer: Dauer × Puls, Kraft: Arbeitssätze) mit deinem Schnitt der letzten 4 Wochen. 0,8–1,3 ist ideal. Über 1,5 steigt das Verletzungsrisiko, unter 0,8 baut die Form langsam ab.'
  if (r.status === 'high')
    return {
      id: 'load',
      group: 'load',
      icon: 'load',
      title: 'Belastung steigt zu schnell',
      value,
      info,
      tone: 'hint',
      priority: 90,
    }
  if (r.status === 'rising')
    return {
      id: 'load',
      group: 'load',
      icon: 'load',
      title: 'Belastung steigt',
      value,
      info,
      tone: 'neutral',
      priority: 50,
    }
  if (r.status === 'low')
    return { id: 'load', group: 'load', icon: 'load', title: 'Form baut ab', value, info, tone: 'hint', priority: 60 }
  return {
    id: 'load',
    group: 'load',
    icon: 'load',
    title: 'Belastung im grünen Bereich',
    value,
    info,
    tone: 'good',
    priority: 40,
  }
}

// ---------- VO₂max & Fitnessalter ----------

/**
 * Durchschnittliche VO₂max (ml/kg/min) gesunder Erwachsener nach Alter – gerundet nach der
 * HUNT-Fitness-Studie (Norwegen, Grundlage des NTNU-„Fitnessalters“, Nes et al.).
 * Stützpunkte: Alter (Mitte der Altersgruppe 20–29, 30–39 …) → Mittelwert.
 */
export const VO2_NORM: Record<'m' | 'f', [number, number][]> = {
  m: [
    [25, 54],
    [35, 49],
    [45, 47],
    [55, 43],
    [65, 39],
    [75, 35],
  ],
  f: [
    [25, 43],
    [35, 40],
    [45, 38],
    [55, 34],
    [65, 31],
    [75, 28],
  ],
}

/**
 * Fitnessalter: das Alter, in dem deine VO₂max dem Durchschnitt entspricht (lineare Interpolation
 * zwischen den Stützpunkten in VO2_NORM, begrenzt auf 20–80). null ohne Geschlecht/Alter.
 */
export function fitnessAge(vo2: number, sex: string | null | undefined, age: number | null | undefined): number | null {
  const key = sex === 'm' || sex === 'male' ? 'm' : sex === 'f' || sex === 'female' ? 'f' : null
  if (!key || !age || age < 16 || !(vo2 > 0)) return null
  const t = VO2_NORM[key]
  // Werte fallen mit dem Alter → über die Steigung der Nachbarpunkte (auch außerhalb) interpolieren
  let i = 0
  while (i < t.length - 2 && vo2 < t[i + 1][1]) i++
  const [a1, v1] = t[i]
  const [a2, v2] = t[i + 1]
  const ageAt = a1 + ((vo2 - v1) * (a2 - a1)) / (v2 - v1)
  return Math.round(Math.min(80, Math.max(20, ageAt)))
}

export interface Vo2Trend {
  latest: number
  latestDate: string
  /** Veränderung gegenüber ca. 90 Tagen vorher (null ohne Vergleichswert) */
  delta: number | null
}

/** Letzter VO₂max-Wert (max. 60 Tage alt) und Veränderung zu einem Wert 60–120 Tage davor. */
export function vo2Trend(daily: readonly Pick<HealthDaily, 'date' | 'vo2max'>[], today: string): Vo2Trend | null {
  const pts = daily
    .filter((d) => d.vo2max != null && d.vo2max > 0 && d.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  if (!pts.length) return null
  const last = pts[pts.length - 1]
  if (daysBetween(last.date, today) > 60) return null
  // Vergleichswert: der Wert, der 90 Tagen vorher am nächsten liegt (zwischen 60 und 120 Tagen)
  const cands = pts.filter((p) => {
    const gap = daysBetween(p.date, last.date)
    return gap >= 60 && gap <= 120
  })
  const ref = cands.length
    ? cands.reduce((b, p) =>
        Math.abs(daysBetween(p.date, last.date) - 90) < Math.abs(daysBetween(b.date, last.date) - 90) ? p : b,
      )
    : null
  return {
    latest: last.vo2max!,
    latestDate: last.date,
    delta: ref ? Math.round((last.vo2max! - ref.vo2max!) * 10) / 10 : null,
  }
}

// ---------- Ruhepuls & HRV: 30 Tage gegen 90-Tage-Basis ----------

export interface VitalTrend {
  recent: number
  base: number
  /** recent − base (absolut) */
  diff: number
  /** in % der Basis */
  pct: number
}

/**
 * Schnitt der letzten 30 Tage gegen die Basis der 60 Tage davor (zusammen 90 Tage).
 * Mind. 10 Werte in jedem Zeitraum.
 */
export function vitalTrend(
  daily: readonly HealthDaily[],
  key: 'resting_hr' | 'hrv_ms',
  today: string,
): VitalTrend | null {
  const from30 = shiftDate(today, -29)
  const from90 = shiftDate(today, -89)
  const vals = (from: string, to: string) =>
    daily.filter((d) => d[key] != null && inWindow(d.date, from, to)).map((d) => d[key] as number)
  const recent = vals(from30, today)
  const base = vals(from90, shiftDate(from30, -1))
  if (recent.length < 10 || base.length < 10) return null
  const r = mean(recent)
  const b = mean(base)
  if (!(b > 0)) return null
  return { recent: r, base: b, diff: r - b, pct: ((r - b) / b) * 100 }
}

function rhrInsight(t: VitalTrend): Insight {
  return { ...rhrInsightBase(t), viz: vitalViz(t, 'bpm') }
}

function hrvInsight(t: VitalTrend): Insight {
  return { ...hrvInsightBase(t), viz: vitalViz(t, 'ms') }
}

const vitalViz = (t: VitalTrend, unit: string): InsightViz => ({
  kind: 'compare',
  unit,
  a: { label: '30 Tage', value: Math.round(t.recent) },
  b: { label: 'Basis', value: Math.round(t.base) },
})

function rhrInsightBase(t: VitalTrend): Insight {
  const value = `Ø ${de(t.recent)} bpm · ${signed(Math.round(t.diff))} zur Basis`
  const info =
    'Dein Ruhepuls der letzten 30 Tage im Vergleich zu den 60 Tagen davor. Sinkt er, wird dein Herz fitter. Steigt er länger, können Stress, wenig Schlaf, Überlastung oder ein Infekt dahinterstecken.'
  if (t.diff <= -1.5)
    return {
      id: 'rhr',
      group: 'heart',
      icon: 'heart',
      title: 'Ruhepuls sinkt',
      value,
      info,
      tone: 'good',
      priority: 45,
    }
  if (t.diff >= 2)
    return {
      id: 'rhr',
      group: 'heart',
      icon: 'heart',
      title: 'Ruhepuls steigt',
      value,
      info,
      tone: 'hint',
      priority: 70,
    }
  return {
    id: 'rhr',
    group: 'heart',
    icon: 'heart',
    title: 'Ruhepuls stabil',
    value,
    info,
    tone: 'neutral',
    priority: 10,
  }
}

function hrvInsightBase(t: VitalTrend): Insight {
  const value = `Ø ${de(t.recent)} ms · ${signed(Math.round(t.pct))} % zur Basis`
  const info =
    'Deine Herzratenvariabilität (HRV) der letzten 30 Tage im Vergleich zu den 60 Tagen davor. Steigt sie, verkraftest du Training und Alltag besser. Sinkt sie über Wochen, fehlt meist Erholung. Vergleiche nur mit dir selbst.'
  if (t.pct >= 5)
    return {
      id: 'hrv',
      group: 'heart',
      icon: 'hrv',
      title: 'Erholung (HRV) wird besser',
      value,
      info,
      tone: 'good',
      priority: 45,
    }
  if (t.pct <= -7)
    return {
      id: 'hrv',
      group: 'heart',
      icon: 'hrv',
      title: 'Erholung (HRV) sinkt',
      value,
      info,
      tone: 'hint',
      priority: 70,
    }
  return {
    id: 'hrv',
    group: 'heart',
    icon: 'hrv',
    title: 'Erholung (HRV) stabil',
    value,
    info,
    tone: 'neutral',
    priority: 10,
  }
}

// ---------- Schlaf ----------

/**
 * Schlafschuld der letzten 7 Nächte: Summe aus (Bedarf − Schlaf); zu viel Schlaf gleicht aus.
 * Mind. 5 Nächte mit Daten. Positiv = Schuld in Minuten.
 */
export function sleepDebt(
  sleep: readonly Pick<HealthSleep, 'date' | 'asleep_min'>[],
  today: string,
  needMin = 480,
): { debtMin: number; nights: number; avgMin: number } | null {
  const from = shiftDate(today, -6)
  const nights = sleep.filter((n) => inWindow(n.date, from, today) && n.asleep_min > 0)
  if (nights.length < 5) return null
  const debtMin = Math.round(nights.reduce((s, n) => s + (needMin - n.asleep_min), 0))
  return { debtMin, nights: nights.length, avgMin: Math.round(mean(nights.map((n) => n.asleep_min))) }
}

/** Minuten seit 18 Uhr (lokal) – so liegen 23:30 und 0:30 nah beieinander. */
function bedMinutes(startAt: string): number {
  const d = new Date(startAt)
  return ((d.getHours() - 18 + 24) % 24) * 60 + d.getMinutes()
}

/** Schwankung der Einschlafzeit (Standardabweichung, min) über die letzten 14 Nächte; mind. 7 Nächte. */
export function bedtimeSpread(
  sleep: readonly Pick<HealthSleep, 'date' | 'start_at'>[],
  today: string,
): { spreadMin: number; avgBed: string; nights: number } | null {
  const from = shiftDate(today, -13)
  const bed = sleep.filter((n) => inWindow(n.date, from, today)).map((n) => bedMinutes(n.start_at))
  if (bed.length < 7) return null
  const m = mean(bed)
  const sd = Math.sqrt(mean(bed.map((b) => (b - m) ** 2)))
  const abs = Math.round(m + 18 * 60) % (24 * 60)
  const avgBed = `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
  return { spreadMin: Math.round(sd), avgBed, nights: bed.length }
}

/**
 * Längste und kürzeste Nacht nach Wochentag (Nacht „auf“ den Aufwach-Tag), letzte 8 Wochen.
 * Mind. 21 Nächte, je Wochentag mind. 2; nur wenn sich beide um ≥ 30 min unterscheiden.
 */
export function sleepByWeekday(
  sleep: readonly Pick<HealthSleep, 'date' | 'asleep_min'>[],
  today: string,
): { best: { day: string; avgMin: number }; worst: { day: string; avgMin: number } } | null {
  const from = shiftDate(today, -55)
  const nights = sleep.filter((n) => inWindow(n.date, from, today) && n.asleep_min > 0)
  if (nights.length < 21) return null
  const by = new Map<number, number[]>()
  for (const n of nights) by.set(weekday(n.date), [...(by.get(weekday(n.date)) ?? []), n.asleep_min])
  const avgs = [...by.entries()]
    .filter(([, v]) => v.length >= 2)
    .map(([d, v]) => ({ day: WEEKDAY[d], avgMin: Math.round(mean(v)) }))
  if (avgs.length < 4) return null
  const best = avgs.reduce((a, b) => (b.avgMin > a.avgMin ? b : a))
  const worst = avgs.reduce((a, b) => (b.avgMin < a.avgMin ? b : a))
  if (best.avgMin - worst.avgMin < 30) return null
  return { best, worst }
}

// ---------- Aktivität ----------

/** Puls-Anteil vom Maximalpuls ab „moderat“ bzw. „intensiv“ (WHO/ACSM: 64 % bzw. 77 %). */
export const MODERATE_FROM = 0.64
export const VIGOROUS_FROM = 0.77
/** WHO: 150 min moderat pro Woche (intensive Minuten zählen doppelt) */
export const WHO_MINUTES = 150

/**
 * Intensitätsminuten einer Einheit: moderate + 2 × intensive Minuten.
 * Mit Puls-Verlauf sekundengenau, sonst über den Durchschnittspuls, ohne Puls nach Sportart.
 */
export function intensityMinutes(
  a: Pick<HealthActivity, 'type' | 'duration_s' | 'avg_hr'> & { hr_series?: [number, number][] | null },
  maxHr: number,
): { moderate: number; vigorous: number; total: number } {
  let mod = 0
  let vig = 0
  const s = a.hr_series
  if (s && s.length >= 2) {
    for (let i = 1; i < s.length; i++) {
      const dt = s[i][0] - s[i - 1][0]
      if (!(dt > 0 && dt < 600)) continue
      const p = (s[i][1] + s[i - 1][1]) / 2 / maxHr
      if (p >= VIGOROUS_FROM) vig += dt
      else if (p >= MODERATE_FROM) mod += dt
    }
  } else if (a.avg_hr) {
    const p = a.avg_hr / maxHr
    if (p >= VIGOROUS_FROM) vig = a.duration_s
    else if (p >= MODERATE_FROM) mod = a.duration_s
  } else if (a.type === 'run' || a.type === 'swim' || a.type === 'row') vig = a.duration_s
  else mod = a.duration_s
  const moderate = Math.round(mod / 60)
  const vigorous = Math.round(vig / 60)
  return { moderate, vigorous, total: moderate + 2 * vigorous }
}

/** Intensitätsminuten der letzten 7 Tage (inkl. heute). */
export function weeklyIntensity(
  activities: readonly HealthActivity[],
  today: string,
  maxHr: number,
): { total: number; moderate: number; vigorous: number } {
  const from = shiftDate(today, -6)
  return activities
    .filter((a) => inWindow(actDate(a), from, today))
    .map((a) => intensityMinutes(a, maxHr))
    .reduce(
      (s, m) => ({ total: s.total + m.total, moderate: s.moderate + m.moderate, vigorous: s.vigorous + m.vigorous }),
      { total: 0, moderate: 0, vigorous: 0 },
    )
}

/**
 * Schritte: Ø der letzten 7 Tage (bis gestern, heute ist noch nicht fertig) gegen Ø der 3 Wochen davor.
 * Jede Woche braucht mind. 4 Tage mit Schritten.
 */
export function stepsTrend(
  daily: readonly Pick<HealthDaily, 'date' | 'steps'>[],
  today: string,
): { recent: number; before: number; pct: number } | null {
  const end = shiftDate(today, -1)
  const weekAvg = (k: number) => {
    const to = shiftDate(end, -7 * k)
    const from = shiftDate(to, -6)
    const v = daily.filter((d) => d.steps != null && d.steps > 0 && inWindow(d.date, from, to)).map((d) => d.steps!)
    return v.length >= 4 ? mean(v) : null
  }
  const recent = weekAvg(0)
  const prev = [weekAvg(1), weekAvg(2), weekAvg(3)].filter((v): v is number => v != null)
  if (recent == null || prev.length < 2) return null
  const before = mean(prev)
  if (!(before > 0)) return null
  return { recent: Math.round(recent), before: Math.round(before), pct: Math.round(((recent - before) / before) * 100) }
}

// ---------- Energie: tatsächlicher Verbrauch ----------

/** kcal pro kg Körpergewicht (Fett- und Wassermix, übliche Faustregel) */
export const KCAL_PER_KG = 7700

export interface AdaptiveTdee {
  /** geschätzter Tagesverbrauch (kcal, auf 10 gerundet) */
  tdee: number
  /** Ø gegessen an erfassten Tagen */
  avgIntake: number
  /** Gewichtsänderung im Zeitraum laut Trendlinie (kg) */
  weightChangeKg: number
  /** Gewichtsänderung pro Woche (kg) */
  perWeekKg: number
  days: number
  loggedDays: number
  weighIns: number
  confidence: 'hoch' | 'mittel'
}

/**
 * Tatsächlicher Verbrauch wie bei MacroFactor: Ø Kalorienzufuhr minus Energie aus der
 * Gewichtsänderung (≈ 7700 kcal/kg) pro Tag.
 *   TDEE ≈ Ø gegessen − (Δ Gewicht × 7700) / Tage
 * Zeitraum: die letzten `days` Tage bis gestern (heute ist noch nicht fertig erfasst).
 * Gewichtsänderung über eine Ausgleichsgerade (robust gegen Tagesschwankungen).
 * Braucht: ≥ 14 Tage zwischen erster und letzter Wiegung, ≥ 4 Wiegungen, ≥ 10 erfasste Tage
 * (Tage unter 800 kcal gelten als unvollständig erfasst) und mind. 60 % erfasste Tage.
 *
 * Für ein späteres automatisches Kalorienziel gedacht (siehe Bericht) – ändert selbst nichts.
 */
export function adaptiveTdee(
  intakeByDay: ReadonlyMap<string, number>,
  weights: readonly { date: string; kg: number }[],
  today: string,
  days = 28,
): AdaptiveTdee | null {
  const to = shiftDate(today, -1)
  const from = shiftDate(today, -days)
  const w = weights
    .filter((p) => p.kg > 0 && Number.isFinite(p.kg) && inWindow(p.date, from, to))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  if (w.length < 4) return null
  const span = daysBetween(w[0].date, w[w.length - 1].date)
  if (span < 14) return null
  // Zeitraum = von der ersten bis zur letzten Wiegung
  const logged = [...intakeByDay.entries()].filter(
    ([d, kcal]) => inWindow(d, w[0].date, w[w.length - 1].date) && kcal >= 800,
  )
  if (logged.length < 10 || logged.length < (span + 1) * 0.6) return null
  // Ausgleichsgerade kg = a + b × Tag
  const xs = w.map((p) => daysBetween(w[0].date, p.date))
  const ys = w.map((p) => p.kg)
  const mx = mean(xs)
  const my = mean(ys)
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  if (sxx <= 0) return null
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx
  const avgIntake = mean(logged.map(([, k]) => k))
  const tdee = avgIntake - slope * KCAL_PER_KG
  if (!(tdee >= 1200 && tdee <= 5500)) return null
  return {
    tdee: Math.round(tdee / 10) * 10,
    avgIntake: Math.round(avgIntake),
    weightChangeKg: Math.round(slope * span * 100) / 100,
    perWeekKg: Math.round(slope * 7 * 100) / 100,
    days: span + 1,
    loggedDays: logged.length,
    weighIns: w.length,
    confidence: logged.length >= 21 && w.length >= 10 ? 'hoch' : 'mittel',
  }
}

/**
 * kcal je Tag: App-Tagebuch hat Vorrang; nur an Tagen ohne App-Einträge zählen Werte
 * aus anderen Apps (Health Connect). So wird nie doppelt gezählt.
 */
export function mergeIntake(
  appEntries: readonly { date: string; kcal: number }[],
  healthDays: readonly Pick<HealthDaily, 'date' | 'nutrition_kcal'>[] = [],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of appEntries) out.set(e.date, (out.get(e.date) ?? 0) + (e.kcal || 0))
  for (const d of healthDays)
    if (!out.has(d.date) && d.nutrition_kcal != null && d.nutrition_kcal > 0) out.set(d.date, d.nutrition_kcal)
  return out
}

/** Ø Gesamtverbrauch laut Uhr (abgeschlossene Tage der letzten 14 Tage, mind. 7). */
export function watchTdee(daily: readonly Pick<HealthDaily, 'date' | 'total_kcal'>[], today: string): number | null {
  const from = shiftDate(today, -14)
  const to = shiftDate(today, -1)
  const v = daily
    .filter((d) => d.total_kcal != null && d.total_kcal > 800 && inWindow(d.date, from, to))
    .map((d) => d.total_kcal!)
  return v.length >= 7 ? Math.round(mean(v) / 10) * 10 : null
}

// ---------- Zusammenhänge ----------

/**
 * Tagesform für vergangene Tage nachrechnen (wie auf „Heute“, ohne Ernährung/Zyklus):
 * Schlaf, Tiefschlaf, HRV, Ruhepuls und Belastung der beiden Vortage.
 */
export function readinessHistory(
  daily: readonly HealthDaily[],
  sleep: readonly HealthSleep[],
  load: ReadonlyMap<string, { cardio: number; sets: number }>,
  dates: readonly string[],
  needMin = 480,
): Map<string, number> {
  const out = new Map<string, number>()
  const sleepBy = new Map(sleep.map((s) => [s.date, s]))
  for (const date of dates) {
    const r = readinessOn(date, daily, sleepBy.get(date) ?? null, load, needMin)
    if (r) out.set(date, r.score)
  }
  return out
}

/** Tagesform eines (vergangenen) Tages nur aus Uhr- und Trainingsdaten – null ohne Uhr-Werte. */
export function readinessOn(
  date: string,
  daily: readonly HealthDaily[],
  night: HealthSleep | null,
  load: ReadonlyMap<string, { cardio: number; sets: number }>,
  needMin = 480,
): Readiness | null {
  const d = daily.find((x) => x.date === date)
  const y = load.get(shiftDate(date, -1))
  const b = load.get(shiftDate(date, -2))
  return readiness({
    sleepMin: night?.asleep_min ?? null,
    sleepNeedMin: needMin,
    deepMin: night?.deep_min ?? null,
    hrv: d?.hrv_ms ?? null,
    hrvBaseline: baseline(daily, 'hrv_ms', date),
    restingHr: d?.resting_hr ?? null,
    restingHrBaseline: baseline(daily, 'resting_hr', date),
    cardioLoad: (y?.cardio ?? 0) + (b?.cardio ?? 0) / 2,
    strengthSets: (y?.sets ?? 0) + (b?.sets ?? 0) / 2,
  })
}

/** Belastung je Tag: Ausdauer-Load (Dauer × Puls) und Anzahl Kraft-Arbeitssätze. */
export function loadByDay(
  acts: readonly HealthActivity[],
  setDates: readonly string[],
  maxHr = 190,
): Map<string, { cardio: number; sets: number }> {
  const out = new Map<string, { cardio: number; sets: number }>()
  for (const a of acts) {
    const e = out.get(actDate(a)) ?? { cardio: 0, sets: 0 }
    e.cardio += activityLoad(a, maxHr)
    out.set(actDate(a), e)
  }
  for (const d of setDates) {
    const e = out.get(d) ?? { cardio: 0, sets: 0 }
    e.sets += 1
    out.set(d, e)
  }
  return out
}

/**
 * Vergleich zweier Gruppen von Tagen: Ø Wert an „Ja“-Tagen gegen Ø an „Nein“-Tagen.
 * Mind. `minPairs` Tage insgesamt und je Gruppe 3.
 */
export function pairedDiff(
  pairs: readonly { flag: boolean | null; value: number }[],
  minPairs = 10,
): { yes: number; no: number; diff: number; n: number } | null {
  const ok = pairs.filter((p) => p.flag != null && Number.isFinite(p.value))
  if (ok.length < minPairs) return null
  const yes = ok.filter((p) => p.flag).map((p) => p.value)
  const no = ok.filter((p) => !p.flag).map((p) => p.value)
  if (yes.length < 3 || no.length < 3) return null
  return { yes: mean(yes), no: mean(no), diff: mean(yes) - mean(no), n: ok.length }
}

// ---------- Alles zusammen ----------

export interface InsightInput {
  today: string
  hasWatch: boolean
  activities?: readonly HealthActivity[]
  daily?: readonly HealthDaily[]
  sleep?: readonly HealthSleep[]
  /** Datum je Kraft-Arbeitssatz (ohne Aufwärmsätze) */
  strengthSetDates?: readonly string[]
  weights?: readonly { date: string; kg: number }[]
  /** Essen aus dem App-Tagebuch (nur mit Ernährungs-Bereich) */
  food?: readonly { date: string; kcal: number }[]
  sex?: string | null
  age?: number | null
  sleepNeedMin?: number
  maxHr?: number
}

/** Alle Erkenntnisse, die die Daten hergeben – wichtigste zuerst. */
export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = []
  const today = i.today
  const acts = i.activities ?? []
  const daily = i.daily ?? []
  const sleep = i.sleep ?? []
  const sets = i.strengthSetDates ?? []
  const need = i.sleepNeedMin ?? 480
  const maxHr = i.maxHr ?? 190

  // Belastung: klappt auch ohne Uhr (nur aus den Kraftsätzen), mit Uhr zusätzlich Ausdauer
  const lr = loadRatio(dailyLoad(i.hasWatch ? acts : [], sets, maxHr), today)
  if (lr) out.push(loadInsight(lr))

  if (i.hasWatch) {
    // Herz
    const vo2 = vo2Trend(daily, today)
    if (vo2) {
      const d = vo2.delta
      out.push({
        id: 'vo2',
        group: 'heart',
        icon: 'vo2',
        title: d == null || Math.abs(d) < 1 ? 'VO₂max stabil' : d > 0 ? 'VO₂max steigt' : 'VO₂max sinkt',
        value: `${de(vo2.latest, 1)} ml/kg/min${d != null ? ` · ${signed(d, 1)} in 90 Tagen` : ''}`,
        info: 'VO₂max ist die Menge Sauerstoff, die dein Körper bei voller Belastung nutzen kann – der beste Einzelwert für Ausdauer-Fitness. Sie steigt mit regelmäßigem Ausdauertraining, besonders mit intensiven Intervallen.',
        tone: d != null && d >= 1 ? 'good' : d != null && d <= -1 ? 'hint' : 'neutral',
        priority: d != null && Math.abs(d) >= 1 ? 50 : 15,
      })
      const fa = fitnessAge(vo2.latest, i.sex, i.age)
      if (fa != null && i.age) {
        const diff = fa - i.age
        out.push({
          id: 'fitness-age',
          group: 'heart',
          icon: 'age',
          title: fa <= 20 ? 'Fitnessalter unter 20' : `Fitnessalter ca. ${fa}`,
          value:
            fa <= 20
              ? 'Top-Wert für dein Alter'
              : diff <= -1
                ? `${-diff} Jahre jünger als du`
                : diff >= 1
                  ? `${diff} Jahre älter als du`
                  : 'genau dein Alter',
          info: 'Geschätzt aus deiner VO₂max: das Alter, in dem dein Wert dem Durchschnitt entspricht (Durchschnittswerte der norwegischen HUNT-Fitness-Studie). Nur eine grobe Einordnung, keine Diagnose.',
          tone: diff <= -3 ? 'good' : diff >= 3 ? 'hint' : 'neutral',
          priority: 35,
        })
      }
    }
    const rhr = vitalTrend(daily, 'resting_hr', today)
    if (rhr) out.push(rhrInsight(rhr))
    const hrv = vitalTrend(daily, 'hrv_ms', today)
    if (hrv) out.push(hrvInsight(hrv))

    // Schlaf
    const debt = sleepDebt(sleep, today, need)
    if (debt) {
      out.push(
        debt.debtMin > 60
          ? {
              id: 'sleep-debt',
              group: 'sleep',
              icon: 'sleep',
              title: `Schlafschuld ${hoursText(debt.debtMin)}`,
              value: `Ø ${hoursText(debt.avgMin)} pro Nacht · Ziel ${hoursText(need)}`,
              info: 'Summe aus dem, was dir in den letzten 7 Nächten zu deinem Schlafbedarf gefehlt hat. Lange Nächte gleichen kurze aus. Abbauen geht am besten mit etwas früher ins Bett über mehrere Tage.',
              tone: 'hint',
              priority: debt.debtMin > 180 ? 85 : 65,
              viz: { kind: 'meter', value: debt.avgMin / 60, max: Math.max(10, need / 60 + 1), lo: need / 60 },
            }
          : {
              id: 'sleep-debt',
              group: 'sleep',
              icon: 'sleep',
              title: 'Keine Schlafschuld',
              value: `Ø ${hoursText(debt.avgMin)} pro Nacht · letzte 7 Nächte`,
              info: 'Du hast in den letzten 7 Nächten im Schnitt so viel geschlafen, wie du brauchst. Genau dann erholen sich Muskeln und Kopf am besten.',
              tone: 'good',
              priority: 30,
              viz: { kind: 'meter', value: debt.avgMin / 60, max: Math.max(10, need / 60 + 1), lo: need / 60 },
            },
      )
    }
    const spread = bedtimeSpread(sleep, today)
    if (spread) {
      out.push({
        id: 'bedtime',
        group: 'sleep',
        icon: 'clock',
        title:
          spread.spreadMin <= 30
            ? 'Regelmäßige Schlafenszeit'
            : spread.spreadMin >= 60
              ? 'Schlafenszeit schwankt stark'
              : 'Schlafenszeit schwankt etwas',
        value: `meist gegen ${spread.avgBed} Uhr · ± ${spread.spreadMin} min`,
        info: 'Wie stark deine Einschlafzeit in den letzten 14 Nächten schwankt. Feste Zeiten (± 30 min) stabilisieren die innere Uhr – du schläfst schneller ein und wachst erholter auf.',
        tone: spread.spreadMin <= 30 ? 'good' : spread.spreadMin >= 60 ? 'hint' : 'neutral',
        priority: spread.spreadMin >= 60 ? 55 : spread.spreadMin <= 30 ? 25 : 15,
      })
    }
    const wd = sleepByWeekday(sleep, today)
    if (wd) {
      out.push({
        id: 'sleep-weekday',
        group: 'sleep',
        icon: 'calendar',
        title: `Kürzeste Nacht: auf ${wd.worst.day}`,
        value: `Ø ${hoursText(wd.worst.avgMin)} · längste auf ${wd.best.day} ${hoursText(wd.best.avgMin)}`,
        info: 'Durchschnittlicher Schlaf je Nacht der letzten 8 Wochen, sortiert nach dem Tag, an dem du aufwachst. Große Unterschiede (z. B. am Wochenende nachholen) sind ein Zeichen für Schlafmangel unter der Woche.',
        tone: 'neutral',
        priority: 20,
      })
    }
    // Achtsamkeit (nur wenn eine App Minuten liefert)
    const mindful = daily
      .filter((d) => inWindow(d.date, shiftDate(today, -6), today))
      .reduce((s, d) => s + (d.mindful_min ?? 0), 0)
    if (mindful > 0) {
      out.push({
        id: 'mindful',
        group: 'sleep',
        icon: 'mind',
        title: `${mindful} min Achtsamkeit`,
        value: 'letzte 7 Tage',
        info: 'Meditation und Atemübungen aus anderen Apps (über Health Connect). Schon 10 Minuten am Tag senken Stress und können HRV und Schlaf verbessern.',
        tone: 'neutral',
        priority: 5,
      })
    }

    // Aktivität
    const recentActs = acts.some((a) => inWindow(actDate(a), shiftDate(today, -27), today))
    if (recentActs) {
      const im = weeklyIntensity(acts, today, maxHr)
      const done = im.total >= WHO_MINUTES
      out.push({
        id: 'intensity',
        group: 'activity',
        icon: 'zap',
        title: done ? 'WHO-Ziel erreicht' : `Noch ${WHO_MINUTES - im.total} min bis zum WHO-Ziel`,
        value: `${im.total} von ${WHO_MINUTES} Intensitätsminuten (7 Tage)`,
        info: `Die WHO empfiehlt pro Woche mind. 150 Minuten moderate oder 75 Minuten intensive Bewegung. Gezählt wird ab ${Math.round(MODERATE_FROM * 100)} % deines Maximalpulses, ab ${Math.round(VIGOROUS_FROM * 100)} % doppelt. Krafttraining kommt zusätzlich dazu (2× pro Woche).`,
        tone: done ? 'good' : 'neutral',
        priority: done ? 30 : 35,
        viz: { kind: 'meter', value: im.total, max: Math.max(WHO_MINUTES * 1.5, im.total), lo: WHO_MINUTES },
      })
    }
    const st = stepsTrend(daily, today)
    if (st) {
      out.push({
        id: 'steps',
        group: 'activity',
        icon: 'steps',
        title:
          st.pct >= 10 ? 'Mehr Schritte als sonst' : st.pct <= -10 ? 'Weniger Schritte als sonst' : 'Schritte stabil',
        value: `Ø ${de(st.recent)}/Tag · ${signed(st.pct)} % zum Schnitt`,
        info: 'Deine Schritte der letzten 7 Tage im Vergleich zum Schnitt der 3 Wochen davor. Alltagsbewegung verbraucht oft mehr Energie als das Training – sinkt sie, sinkt auch dein Verbrauch.',
        tone: st.pct >= 10 ? 'good' : st.pct <= -10 ? 'hint' : 'neutral',
        priority: st.pct <= -10 ? 50 : st.pct >= 10 ? 30 : 10,
        viz: {
          kind: 'compare',
          unit: 'Schritte',
          a: { label: '7 Tage', value: st.recent },
          b: { label: 'davor', value: st.before },
        },
      })
    }

    // Zusammenhang: kurze Nächte → Tagesform am Morgen danach
    const loadMap = loadByDay(acts, sets, maxHr)
    const sleepDates = sleep.filter((s) => inWindow(s.date, shiftDate(today, -59), today)).map((s) => s.date)
    const scores = readinessHistory(daily, sleep, loadMap, sleepDates, need)
    const pairs = sleep
      .filter((s) => scores.has(s.date))
      .map((s) => ({
        flag: s.asleep_min < 360 ? true : s.asleep_min >= 420 ? false : null,
        value: scores.get(s.date)!,
      }))
    const pd = pairedDiff(pairs)
    if (pd && pd.diff <= -5) {
      out.push({
        id: 'sleep-readiness',
        group: 'sleep',
        icon: 'link',
        title: 'Kurze Nächte kosten Tagesform',
        value: `Nach < 6 h Schlaf Ø ${Math.round(-pd.diff)} Punkte weniger`,
        info: `Verglichen werden deine Tagesform-Werte nach Nächten unter 6 Stunden (Ø ${Math.round(pd.yes)}) mit denen nach mindestens 7 Stunden (Ø ${Math.round(pd.no)}), ${pd.n} Tage aus den letzten 60 Tagen. Schlaf ist der größte Hebel für deine Erholung.`,
        tone: 'hint',
        priority: 45,
        viz: {
          kind: 'compare',
          unit: 'Punkte',
          a: { label: '< 6 h', value: Math.round(pd.yes) },
          b: { label: '≥ 7 h', value: Math.round(pd.no) },
        },
      })
    }
    // Zusammenhang: kurze Nächte → HRV am Morgen danach (unabhängig von der Tagesform-Formel)
    const hrvBy = new Map(daily.filter((d) => d.hrv_ms != null).map((d) => [d.date, d.hrv_ms!]))
    const hp = pairedDiff(
      sleep
        .filter((s) => hrvBy.has(s.date) && inWindow(s.date, shiftDate(today, -59), today))
        .map((s) => ({
          flag: s.asleep_min < 360 ? true : s.asleep_min >= 420 ? false : null,
          value: hrvBy.get(s.date)!,
        })),
    )
    if (hp && hp.no > 0 && (hp.diff / hp.no) * 100 <= -5) {
      const pct = Math.round((-hp.diff / hp.no) * 100)
      out.push({
        id: 'sleep-hrv',
        group: 'heart',
        icon: 'link',
        title: 'Kurze Nächte senken deine HRV',
        value: `Nach < 6 h Schlaf Ø ${pct} % niedriger`,
        info: `Deine HRV am Morgen nach Nächten unter 6 Stunden (Ø ${Math.round(hp.yes)} ms) im Vergleich zu Nächten ab 7 Stunden (Ø ${Math.round(hp.no)} ms), ${hp.n} Tage aus den letzten 60 Tagen. Eine niedrigere HRV zeigt: Der Körper ist weniger erholt.`,
        tone: 'hint',
        priority: 40,
        viz: {
          kind: 'compare',
          unit: 'ms',
          a: { label: '< 6 h', value: Math.round(hp.yes) },
          b: { label: '≥ 7 h', value: Math.round(hp.no) },
        },
      })
    }
  }

  // Energie: klappt auch ohne Uhr (Gewicht + Essen); Werte aus anderen Apps nur mit Uhr-Bereich
  const intake = mergeIntake(i.food ?? [], i.hasWatch ? daily : [])
  const tdee = adaptiveTdee(intake, i.weights ?? [], today)
  const watch = i.hasWatch ? watchTdee(daily, today) : null
  if (tdee) {
    const perWeek = tdee.perWeekKg
    out.push({
      id: 'tdee',
      group: 'energy',
      icon: 'flame',
      title: `Dein Verbrauch: ca. ${de(tdee.tdee)} kcal`,
      value: `Ø ${de(tdee.avgIntake)} gegessen · ${signed(perWeek, 1)} kg/Woche`,
      info: `Berechnet aus deinem Essen und deinem Gewichtsverlauf der letzten ${tdee.days} Tage (${tdee.loggedDays} erfasste Tage, ${tdee.weighIns} Wiegungen): Ø gegessen minus Gewichtsänderung × 7700 kcal/kg.${watch ? ` Deine Uhr schätzt ${de(watch)} kcal – Uhren liegen oft daneben.` : ''} Je vollständiger du erfasst, desto genauer.`,
      tone: 'neutral',
      priority: 55,
      viz: {
        kind: 'compare',
        unit: 'kcal',
        a: { label: 'gegessen', value: Math.round(tdee.avgIntake) },
        b: { label: 'Verbrauch', value: Math.round(tdee.tdee) },
      },
    })
  } else if (watch) {
    out.push({
      id: 'tdee-watch',
      group: 'energy',
      icon: 'flame',
      title: `Verbrauch laut Uhr: ca. ${de(watch)} kcal`,
      value: 'Ø pro Tag · letzte 14 Tage',
      info: 'Grundumsatz plus Bewegung, wie deine Uhr ihn schätzt. Uhren liegen oft 10–20 % daneben. Erfasst du Essen und Gewicht, rechnet die App deinen echten Verbrauch aus.',
      tone: 'neutral',
      priority: 15,
    })
  }

  return out.sort((a, b) => b.priority - a.priority)
}

/** Die wichtigsten Karten für die Übersicht (Hinweise zuerst, dann Bewertungen). */
export function topInsights(list: readonly Insight[], n = 3): Insight[] {
  return [...list].sort((a, b) => b.priority - a.priority).slice(0, n)
}
