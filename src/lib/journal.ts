// Journal: Gewohnheiten des Tages abhaken (Alkohol, spätes Essen, Stress …) und sehen, wie sie den Schlaf
// und die Erholung in der Nacht danach verändern. Ohne Uhr zählt das eigene Gefühl am Morgen („Wie
// ausgeruht?“). Ein Eintrag für Tag D = was du an D gemacht hast + wie du dich am Morgen von D gefühlt hast.
// Reine Logik – getestet in journal.test.ts.

import { shiftDate } from './day'

export interface JournalEntry {
  date: string
  tags: string[]
  /** Wie ausgeruht am Morgen (1–5), null = nicht angegeben */
  feel: number | null
}

export interface JournalHabit {
  id: string
  label: string
  /** Kurzer Hinweis, was genau gemeint ist */
  hint: string
  /** automatisch aus der App (nicht zum Abhaken) */
  auto?: boolean
}

export const JOURNAL_HABITS: JournalHabit[] = [
  { id: 'alcohol', label: 'Alkohol', hint: 'Mindestens ein Glas' },
  { id: 'caffeine_late', label: 'Koffein nach 14 Uhr', hint: 'Kaffee, Energy, Cola, schwarzer Tee' },
  { id: 'late_meal', label: 'Spät gegessen', hint: 'Weniger als 2 Stunden vor dem Schlafen' },
  { id: 'screen_bed', label: 'Handy im Bett', hint: 'Bildschirm in der letzten halben Stunde' },
  { id: 'stress', label: 'Viel Stress', hint: 'Anstrengender Tag im Kopf' },
  { id: 'outside', label: 'Draußen gewesen', hint: 'Mindestens 30 min Tageslicht' },
  { id: 'late_workout', label: 'Spät trainiert', hint: 'Training nach 20 Uhr' },
  { id: 'nap', label: 'Mittagsschlaf', hint: 'Tagsüber geschlafen' },
  { id: 'reading', label: 'Gelesen vorm Schlafen', hint: 'Buch statt Bildschirm' },
  { id: 'relax', label: 'Entspannung', hint: 'Meditation, Atemübung, Yoga' },
  { id: 'sauna', label: 'Sauna', hint: 'Sauna oder heißes Bad' },
  { id: 'sick', label: 'Krank', hint: 'Erkältet oder angeschlagen' },
  { id: 'trained', label: 'Krafttraining', hint: 'Automatisch aus deinen Trainings', auto: true },
]

export const DEFAULT_JOURNAL_HABITS = ['alcohol', 'caffeine_late', 'late_meal', 'screen_bed', 'stress', 'outside']

const BY_ID = new Map(JOURNAL_HABITS.map((h) => [h.id, h]))
export const habitLabel = (id: string) => BY_ID.get(id)?.label ?? id

/** Abgefragte Gewohnheiten (nur bekannte, ohne automatische). */
export function trackedHabits(saved: readonly string[] | null | undefined): string[] {
  const list = saved ?? DEFAULT_JOURNAL_HABITS
  return list.filter((id) => BY_ID.has(id) && !BY_ID.get(id)!.auto)
}

export const FEEL_LABEL = ['', 'Erschöpft', 'Müde', 'Okay', 'Gut', 'Topfit'] as const

/** Welcher Tag wird abgefragt? Vormittags meist „gestern“ (der Abend zählt mit), ab 14 Uhr „heute“. */
export function defaultJournalDay(today: string, hour: number): string {
  return hour < 14 ? shiftDate(today, -1) : today
}

// ---------- Wirkung ----------

export type Outcome = 'sleep' | 'deep' | 'hrv' | 'rhr' | 'readiness' | 'feel'

/** Werte am Morgen eines Tages (Nacht endet an diesem Tag). */
export type OutcomeDay = Partial<Record<Outcome, number>>

export const OUTCOME_LABEL: Record<Outcome, string> = {
  sleep: 'Schlaf',
  deep: 'Tiefschlaf',
  hrv: 'HRV',
  rhr: 'Ruhepuls',
  readiness: 'Tagesform',
  feel: 'Gefühl am Morgen',
}

/** Ab welchem Unterschied ist es der Rede wert? (HRV in % vom „ohne“-Wert) */
const NOTABLE: Record<Outcome, number> = { sleep: 15, deep: 8, hrv: 5, rhr: 2, readiness: 4, feel: 0.4 }
/** Mehr ist besser – außer beim Ruhepuls */
const HIGHER_BETTER: Record<Outcome, boolean> = {
  sleep: true,
  deep: true,
  hrv: true,
  rhr: false,
  readiness: true,
  feel: true,
}

export interface Effect {
  outcome: Outcome
  /** Ø mit bzw. ohne Gewohnheit */
  yes: number
  no: number
  diff: number
  better: boolean
  /** Stärke: Unterschied geteilt durch die Schwelle (≥ 1 = spürbar) */
  score: number
}

export type HabitImpact =
  | { habit: string; status: 'learning'; yesDays: number; noDays: number; needYes: number; needNo: number }
  | { habit: string; status: 'ready'; effects: Effect[]; main: Effect | null; yesDays: number; noDays: number }

export const MIN_EACH = 3
export const MIN_TOTAL = 8

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length

/** Wert eines Effekts für die Anzeige: „38 min“, „6 %“, „3 bpm“ … */
export function effectText(e: Effect): string {
  const d = Math.abs(e.diff)
  switch (e.outcome) {
    case 'sleep':
    case 'deep':
      return `${Math.round(d)} min ${e.diff < 0 ? 'weniger' : 'mehr'} ${OUTCOME_LABEL[e.outcome]}`
    case 'hrv':
      return `HRV ${Math.round((d / e.no) * 100)} % ${e.diff < 0 ? 'niedriger' : 'höher'}`
    case 'rhr':
      return `Ruhepuls ${Math.round(d)} bpm ${e.diff < 0 ? 'niedriger' : 'höher'}`
    case 'readiness':
      return `Tagesform ${Math.round(d)} Punkte ${e.diff < 0 ? 'niedriger' : 'höher'}`
    case 'feel':
      return e.diff < 0 ? 'Morgens weniger ausgeruht' : 'Morgens ausgeruhter'
  }
}

/**
 * Wirkung je Gewohnheit: Werte am Morgen nach Tagen mit gegen Tagen ohne.
 * Manuelle Gewohnheiten zählen nur an Tagen mit Journal-Eintrag; automatische (`auto`) an allen Tagen.
 */
export function habitImpacts(
  entries: readonly JournalEntry[],
  outcomes: ReadonlyMap<string, OutcomeDay>,
  habits: readonly string[],
  today: string,
  auto: ReadonlyMap<string, readonly string[]> = new Map(),
  windowDays = 90,
): HabitImpact[] {
  const from = shiftDate(today, -windowDays)
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const out: HabitImpact[] = []
  for (const habit of habits) {
    const isAuto = BY_ID.get(habit)?.auto === true
    const days = isAuto
      ? [...outcomes.keys()].map((d) => shiftDate(d, -1)).filter((d) => d >= from && d < today)
      : entries.filter((e) => e.date >= from && e.date < today).map((e) => e.date)
    const rows: { flag: boolean; o: OutcomeDay }[] = []
    for (const d of days) {
      const o = outcomes.get(shiftDate(d, 1))
      if (!o || !Object.keys(o).length) continue
      const flag = isAuto ? (auto.get(d) ?? []).includes(habit) : byDate.get(d)!.tags.includes(habit)
      rows.push({ flag, o })
    }
    const yesDays = rows.filter((r) => r.flag).length
    const noDays = rows.length - yesDays
    if (yesDays < MIN_EACH || noDays < MIN_EACH || rows.length < MIN_TOTAL) {
      out.push({
        habit,
        status: 'learning',
        yesDays,
        noDays,
        needYes: Math.max(0, MIN_EACH - yesDays),
        needNo: Math.max(0, MIN_EACH - noDays, MIN_TOTAL - rows.length - Math.max(0, MIN_EACH - yesDays)),
      })
      continue
    }
    const effects: Effect[] = []
    for (const k of Object.keys(NOTABLE) as Outcome[]) {
      const yes = rows.filter((r) => r.flag && r.o[k] != null).map((r) => r.o[k]!)
      const no = rows.filter((r) => !r.flag && r.o[k] != null).map((r) => r.o[k]!)
      if (yes.length < MIN_EACH || no.length < MIN_EACH) continue
      const y = mean(yes)
      const n = mean(no)
      const diff = y - n
      const size = k === 'hrv' ? (n > 0 ? (Math.abs(diff) / n) * 100 : 0) : Math.abs(diff)
      effects.push({
        outcome: k,
        yes: y,
        no: n,
        diff,
        better: HIGHER_BETTER[k] ? diff > 0 : diff < 0,
        score: size / NOTABLE[k],
      })
    }
    effects.sort((a, b) => b.score - a.score)
    const main = effects[0] && effects[0].score >= 1 ? effects[0] : null
    out.push({ habit, status: 'ready', effects, main, yesDays, noDays })
  }
  const rank = (h: HabitImpact) => (h.status === 'ready' ? (h.main ? 1000 + h.main.score : 500) : h.yesDays)
  return out.sort((a, b) => rank(b) - rank(a))
}

/** Werte je Morgen aus Uhr, Tagesform und Journal-Gefühl zusammenstellen. */
export function buildOutcomes(input: {
  sleep?: readonly { date: string; asleep_min: number; deep_min?: number | null }[]
  daily?: readonly { date: string; hrv_ms?: number | null; resting_hr?: number | null }[]
  readiness?: ReadonlyMap<string, number>
  entries?: readonly JournalEntry[]
}): Map<string, OutcomeDay> {
  const out = new Map<string, OutcomeDay>()
  const get = (d: string) => {
    const o = out.get(d) ?? {}
    out.set(d, o)
    return o
  }
  for (const s of input.sleep ?? []) {
    if (s.asleep_min > 0) get(s.date).sleep = s.asleep_min
    if (s.deep_min) get(s.date).deep = s.deep_min
  }
  for (const d of input.daily ?? []) {
    if (d.hrv_ms) get(d.date).hrv = d.hrv_ms
    if (d.resting_hr) get(d.date).rhr = d.resting_hr
  }
  for (const [d, v] of input.readiness ?? []) get(d).readiness = v
  for (const e of input.entries ?? []) if (e.feel != null) get(e.date).feel = e.feel
  return out
}

/** Einträge in Folge bis heute/gestern (für eine kleine Serie). */
export function journalStreak(entries: readonly JournalEntry[], today: string): number {
  const dates = new Set(entries.filter((e) => e.tags.length || e.feel != null).map((e) => e.date))
  let d = dates.has(today) ? today : shiftDate(today, -1)
  let n = 0
  while (dates.has(d)) {
    n++
    d = shiftDate(d, -1)
  }
  return n
}
