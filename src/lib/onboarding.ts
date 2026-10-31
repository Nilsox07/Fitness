// Intro beim ersten Start: aus wenigen Antworten einen Gym- und (auf Wunsch) Ausdauer-Plan bauen.
// Reine Logik – getestet in onboarding.test.ts. Anlegen der Übungen/Pläne übernimmt planStarter.

import type { ActivityLevel, NutritionGoal } from '../types'
import type { Schedule } from './schedule'
import type { StarterTemplate } from './starterSets'

export type FitGoal = 'muscle' | 'lose' | 'fit' | 'strength' | 'endurance'
export type Experience = 'new' | 'some' | 'pro'
export type Place = 'gym' | 'home'
export type CardioKind = 'run' | 'bike' | 'walk' | 'any'

export interface OnboardingAnswers {
  goal: FitGoal
  experience: Experience
  place: Place
  /** Wochentage fürs Krafttraining (0 = Mo … 6 = So) */
  gymDays: number[]
  /** null = kein Ausdauer-Plan */
  cardio: CardioKind | null
  cardioPerWeek: number
}

export const GOALS: { id: FitGoal; label: string; emoji: string }[] = [
  { id: 'muscle', label: 'Muskeln aufbauen', emoji: '💪' },
  { id: 'lose', label: 'Abnehmen', emoji: '🔥' },
  { id: 'fit', label: 'Fitter & gesünder', emoji: '🌿' },
  { id: 'strength', label: 'Stärker werden', emoji: '🏋️' },
  { id: 'endurance', label: 'Ausdauer verbessern', emoji: '🏃' },
]

export const CARDIO_KINDS: { id: CardioKind; label: string; emoji: string }[] = [
  { id: 'run', label: 'Laufen', emoji: '🏃' },
  { id: 'bike', label: 'Radfahren', emoji: '🚴' },
  { id: 'walk', label: 'Gehen', emoji: '🚶' },
  { id: 'any', label: 'Egal / Gerät', emoji: '⚡' },
]

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Sinnvoll verteilte Trainingstage für n Einheiten pro Woche. */
export function suggestDays(n: number): number[] {
  const map: Record<number, number[]> = {
    1: [2],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
  }
  return map[Math.min(6, Math.max(1, Math.round(n)))]
}

/** Vorschlag Ausdauer-Einheiten je Ziel (ohne Wunsch: 0). */
export function suggestCardioPerWeek(goal: FitGoal): number {
  return goal === 'endurance' ? 3 : goal === 'lose' || goal === 'fit' ? 2 : 1
}

// ---------------------------------------------------------------------------
// Krafttraining
// ---------------------------------------------------------------------------

type Ex = { lib: string; name: string; reps: [number, number] }
const ex = (lib: string, name: string, reps: [number, number]): Ex => ({ lib, name, reps })

const G = {
  bench: ex('Barbell_Bench_Press_-_Medium_Grip', 'Bankdrücken', [6, 10]),
  incline: ex('Incline_Dumbbell_Press', 'Schrägbankdrücken (Kurzhantel)', [8, 12]),
  ohp: ex('Dumbbell_Shoulder_Press', 'Schulterdrücken (Kurzhantel)', [8, 12]),
  lateral: ex('Side_Lateral_Raise', 'Seitheben', [12, 15]),
  pushdown: ex('Triceps_Pushdown', 'Trizepsdrücken am Kabel', [10, 15]),
  pulldown: ex('Wide-Grip_Lat_Pulldown', 'Latzug', [8, 12]),
  row: ex('Seated_Cable_Rows', 'Rudern am Kabel', [8, 12]),
  facepull: ex('Face_Pull', 'Face Pulls', [12, 15]),
  curl: ex('Dumbbell_Bicep_Curl', 'Bizepscurls', [10, 12]),
  hammer: ex('Hammer_Curls', 'Hammercurls', [10, 12]),
  squat: ex('Barbell_Squat', 'Kniebeuge', [6, 10]),
  rdl: ex('Romanian_Deadlift', 'Rumänisches Kreuzheben', [8, 10]),
  legpress: ex('Leg_Press', 'Beinpresse', [10, 12]),
  legcurl: ex('Lying_Leg_Curls', 'Beinbeuger', [10, 15]),
  calf: ex('Standing_Calf_Raises', 'Wadenheben', [12, 15]),
  crunch: ex('Crunches', 'Crunches', [12, 20]),
}

const H = {
  goblet: ex('Goblet_Squat', 'Goblet Squat', [10, 15]),
  pushup: ex('Pushups', 'Liegestütze', [8, 15]),
  row: ex('Bent_Over_Two-Dumbbell_Row', 'Vorgebeugtes Rudern (Kurzhantel)', [10, 12]),
  row1: ex('One-Arm_Dumbbell_Row', 'Einarmiges Rudern', [10, 12]),
  ohp: ex('Dumbbell_Shoulder_Press', 'Schulterdrücken (Kurzhantel)', [8, 12]),
  floor: ex('Dumbbell_Floor_Press', 'Bodendrücken (Kurzhantel)', [8, 12]),
  lunge: ex('Dumbbell_Lunges', 'Ausfallschritte (Kurzhantel)', [10, 12]),
  sldl: ex('Stiff-Legged_Dumbbell_Deadlift', 'Kreuzheben gestreckt (Kurzhantel)', [10, 12]),
  bridge: ex('Butt_Lift_Bridge', 'Hüftheben', [12, 15]),
  bridge1: ex('Single_Leg_Glute_Bridge', 'Einbeiniges Hüftheben', [10, 12]),
  lateral: ex('Side_Lateral_Raise', 'Seitheben', [12, 15]),
  curl: ex('Dumbbell_Bicep_Curl', 'Bizepscurls', [10, 12]),
  kick: ex('Tricep_Dumbbell_Kickback', 'Trizeps-Kickbacks', [10, 15]),
  calf: ex('Standing_Dumbbell_Calf_Raise', 'Wadenheben (Kurzhantel)', [12, 15]),
  crunch: ex('Crunches', 'Crunches', [12, 20]),
  climber: ex('Mountain_Climbers', 'Mountain Climbers', [20, 30]),
}

type Split = 'fullbody' | 'upperlower' | 'ppl'

/** Welcher Split passt? Einsteiger und wenig Tage → Ganzkörper. */
export function pickSplit(days: number, experience: Experience): Split {
  if (days <= 2) return 'fullbody'
  if (days === 3) return experience === 'pro' ? 'ppl' : 'fullbody'
  if (days === 4) return 'upperlower'
  return experience === 'new' ? 'upperlower' : 'ppl'
}

const SPLIT_LABEL: Record<Split, string> = {
  fullbody: 'Ganzkörper',
  upperlower: 'Oberkörper · Unterkörper',
  ppl: 'Push · Pull · Beine',
}

function plansFor(split: Split, place: Place): { name: string; exercises: Ex[] }[] {
  if (place === 'home') {
    if (split === 'fullbody')
      return [
        { name: 'Zuhause A', exercises: [H.goblet, H.pushup, H.row, H.ohp, H.bridge, H.crunch] },
        { name: 'Zuhause B', exercises: [H.lunge, H.floor, H.row1, H.sldl, H.lateral, H.curl] },
      ]
    // Zuhause reicht Ober/Unter auch für 5–6 Tage
    return [
      { name: 'Zuhause Oben', exercises: [H.floor, H.row, H.ohp, H.pushup, H.curl, H.kick] },
      { name: 'Zuhause Unten', exercises: [H.goblet, H.sldl, H.lunge, H.bridge1, H.calf, H.climber] },
    ]
  }
  if (split === 'fullbody')
    return [
      { name: 'Ganzkörper A', exercises: [G.squat, G.bench, G.row, G.ohp, G.legcurl, G.crunch] },
      { name: 'Ganzkörper B', exercises: [G.rdl, G.incline, G.pulldown, G.legpress, G.lateral, G.curl] },
    ]
  if (split === 'upperlower')
    return [
      { name: 'Oberkörper', exercises: [G.bench, G.row, G.ohp, G.pulldown, G.curl, G.pushdown] },
      { name: 'Unterkörper', exercises: [G.squat, G.rdl, G.legpress, G.legcurl, G.calf, G.crunch] },
    ]
  return [
    { name: 'Push', exercises: [G.bench, G.incline, G.ohp, G.lateral, G.pushdown] },
    { name: 'Pull', exercises: [G.pulldown, G.row, G.facepull, G.curl, G.hammer] },
    { name: 'Beine', exercises: [G.squat, G.legpress, G.rdl, G.legcurl, G.calf] },
  ]
}

/** Wiederholungen ans Ziel anpassen: Kraft = weniger, Fitness/Ausdauer = mehr. */
export function repsFor(goal: FitGoal, reps: [number, number]): [number, number] {
  const [lo, hi] = reps
  if (goal === 'strength' && lo <= 8) return [Math.max(3, lo - 2), Math.max(5, hi - 4)]
  if ((goal === 'fit' || goal === 'endurance') && lo < 10) return [10, Math.max(15, hi)]
  return reps
}

/** Vorlage (für planStarter) passend zu den Antworten. */
export function buildTemplate(a: OnboardingAnswers): StarterTemplate & { split: Split } {
  const days = Math.max(1, a.gymDays.length)
  const split = pickSplit(days, a.experience)
  const plans = plansFor(split, a.place).map((p) => ({
    name: p.name,
    exercises: p.exercises.map((e) => ({ ...e, reps: repsFor(a.goal, e.reps) })),
  }))
  return {
    id: split,
    split,
    title: a.place === 'home' ? `${SPLIT_LABEL[split === 'ppl' ? 'upperlower' : split]} (Zuhause)` : SPLIT_LABEL[split],
    desc: '',
    days: `${days}× pro Woche`,
    plans,
  }
}

/** Wochenplan: Pläne der Reihe nach auf die gewählten Tage verteilen. */
export function weekPlanNames(planNames: string[], gymDays: number[]): (string | null)[] {
  const days: (string | null)[] = Array(7).fill(null)
  ;[...gymDays].sort((x, y) => x - y).forEach((d, i) => (days[d] = planNames[i % planNames.length] ?? null))
  return days
}

/** Fester Wochen-Rhythmus aus Plan-IDs (Name → ID). */
export function buildSchedule(planIds: Map<string, string>, planNames: string[], gymDays: number[]): Schedule {
  return {
    type: 'weekdays',
    days: weekPlanNames(planNames, gymDays).map((n) => (n ? (planIds.get(n) ?? null) : null)),
  }
}

// ---------------------------------------------------------------------------
// Ausdauer
// ---------------------------------------------------------------------------

export type CardioType = 'easy' | 'interval' | 'long'

export interface CardioSession {
  /** 0 = Mo … 6 = So */
  day: number
  kind: CardioKind
  type: CardioType
  minutes: number
}

export interface CardioPlan {
  kind: CardioKind
  sessions: CardioSession[]
}

const KIND_VERB: Record<CardioKind, string> = { run: 'laufen', bike: 'Rad fahren', walk: 'gehen', any: 'Ausdauer' }
const TYPE_LABEL: Record<CardioType, string> = { easy: 'Locker', interval: 'Intervalle', long: 'Lang & locker' }

/** Kurzer Titel, z. B. „Locker laufen · 30 min“. */
export function cardioTitle(s: CardioSession): string {
  const verb = KIND_VERB[s.kind]
  return s.kind === 'any'
    ? `${TYPE_LABEL[s.type]} · ${s.minutes} min`
    : `${TYPE_LABEL[s.type]} ${verb} · ${s.minutes} min`
}

/** Erklärung nur auf Tippen. */
export function cardioHowTo(s: CardioSession): string {
  if (s.type === 'interval')
    return '10 min locker warm machen, dann 6× 1 min zügig und 2 min locker. Zum Schluss 5 min auslaufen.'
  if (s.type === 'long') return 'Ruhig und gleichmäßig – du solltest dich dabei noch unterhalten können (Zone 2).'
  return 'So locker, dass du dich noch unterhalten kannst (Zone 2). Das baut Ausdauer auf, ohne zu ermüden.'
}

/**
 * Ausdauer-Einheiten auf die Woche verteilen – bevorzugt an Tagen ohne Krafttraining.
 * Dauer und Art hängen von Ziel und Erfahrung ab.
 */
export function buildCardioPlan(a: OnboardingAnswers): CardioPlan | null {
  if (!a.cardio || a.cardioPerWeek <= 0) return null
  const n = Math.min(6, Math.max(1, Math.round(a.cardioPerWeek)))
  const gym = new Set(a.gymDays)
  const free = [6, 2, 5, 3, 1, 4, 0].filter((d) => !gym.has(d))
  const busy = [2, 4, 0, 5, 1, 3, 6].filter((d) => gym.has(d))
  const days = [...free, ...busy].slice(0, n).sort((x, y) => x - y)

  const base = a.experience === 'new' ? 20 : a.experience === 'some' ? 30 : 40
  const easy = a.goal === 'lose' || a.goal === 'endurance' ? base + 10 : base
  const sessions: CardioSession[] = days.map((day) => ({ day, kind: a.cardio!, type: 'easy', minutes: easy }))

  // Ab 2 Einheiten: eine lange am Wochenende (oder letzte); ab 3 (nicht Einsteiger/Gehen): eine Intervall-Einheit
  if (sessions.length >= 2 && (a.goal === 'endurance' || a.goal === 'lose')) {
    const long = sessions.find((s) => s.day >= 5) ?? sessions[sessions.length - 1]
    long.type = 'long'
    long.minutes = easy + (a.experience === 'new' ? 10 : 20)
  }
  if (sessions.length >= 3 && a.experience !== 'new' && a.cardio !== 'walk') {
    const iv = sessions.find((s) => s.type === 'easy')
    if (iv) {
      iv.type = 'interval'
      iv.minutes = 30
    }
  }
  return { kind: a.cardio, sessions }
}

// ---------------------------------------------------------------------------
// Ernährung (nur wenn das Modul an ist)
// ---------------------------------------------------------------------------

export function nutritionGoalFor(goal: FitGoal, experience: Experience): NutritionGoal {
  if (goal === 'lose') return 'lose'
  if (goal === 'muscle') return experience === 'new' ? 'recomp' : 'gain'
  return 'maintain'
}

/** Aktivität aus den geplanten Einheiten pro Woche. */
export function activityFor(sessionsPerWeek: number): ActivityLevel {
  if (sessionsPerWeek <= 1) return 'light'
  if (sessionsPerWeek <= 4) return 'moderate'
  if (sessionsPerWeek <= 6) return 'active'
  return 'very_active'
}

/** „Mo · Mi · Fr“ */
export const dayList = (days: number[]) =>
  [...days]
    .sort((x, y) => x - y)
    .map((d) => WD[d])
    .join(' · ')
export { WD as WEEKDAYS }
