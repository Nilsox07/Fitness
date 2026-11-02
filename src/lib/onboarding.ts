// Intro beim ersten Start: aus wenigen Antworten einen Gym- und (auf Wunsch) Ausdauer-Plan bauen.
// Reine Logik – getestet in onboarding.test.ts. Anlegen der Übungen/Pläne übernimmt planStarter.

import type { ActivityLevel, NutritionGoal } from '../types'
import type { Schedule } from './schedule'
import type { StarterTemplate } from './starterSets'

export type FitGoal = 'muscle' | 'lose' | 'fit' | 'strength' | 'endurance'
export type Experience = 'new' | 'some' | 'pro'
export type Place = 'gym' | 'home' | 'outdoor'
export type CardioKind = 'run' | 'bike' | 'walk' | 'any'
/** Alltag (Beruf/Wege) – getrennt vom Sport */
export type Daily = 'sitting' | 'mixed' | 'active'
export type Equip = 'none' | 'mat' | 'dumbbells' | 'barbell' | 'bands' | 'pullupbar' | 'bench' | 'kettlebell'
export type Focus = 'none' | 'core' | 'chest' | 'back' | 'legs' | 'glutes' | 'shoulders' | 'arms'
export type SessionMinutes = 30 | 45 | 60 | 90

export interface OnboardingAnswers {
  goal: FitGoal
  experience: Experience
  /** Mehrfachauswahl, nie leer */
  places: Place[]
  /** Geräte zuhause (nur relevant mit „home“) */
  equipment: Equip[]
  /** Wochentage fürs Krafttraining (0 = Mo … 6 = So) */
  gymDays: number[]
  /** Zeit pro Krafttraining */
  minutes: SessionMinutes
  /** Optionaler Schwerpunkt: eine Übung extra */
  focus: Focus
  /** Verletzungen/Beschwerden → leichterer Plan */
  limits: boolean
  daily: Daily
  /** null = kein Ausdauer-Plan */
  cardio: CardioKind | null
  cardioPerWeek: number
}

export const DEFAULT_ANSWERS: OnboardingAnswers = {
  goal: 'muscle',
  experience: 'new',
  places: ['gym'],
  equipment: ['dumbbells'],
  gymDays: [0, 2, 4],
  minutes: 60,
  focus: 'none',
  limits: false,
  daily: 'mixed',
  cardio: null,
  cardioPerWeek: 0,
}

export const PLACES: { id: Place; label: string; emoji: string }[] = [
  { id: 'gym', label: 'Im Fitnessstudio', emoji: '🏋️' },
  { id: 'home', label: 'Zuhause', emoji: '🏠' },
  { id: 'outdoor', label: 'Draußen', emoji: '🌳' },
]

export const EQUIPMENT: { id: Equip; label: string }[] = [
  { id: 'none', label: 'Keine Geräte' },
  { id: 'mat', label: 'Matte' },
  { id: 'dumbbells', label: 'Kurzhanteln' },
  { id: 'barbell', label: 'Langhantel' },
  { id: 'bands', label: 'Widerstandsbänder' },
  { id: 'pullupbar', label: 'Klimmzugstange' },
  { id: 'bench', label: 'Bank' },
  { id: 'kettlebell', label: 'Kettlebell' },
]

export const FOCUSES: { id: Focus; label: string; emoji: string }[] = [
  { id: 'none', label: 'Keiner', emoji: '✨' },
  { id: 'core', label: 'Bauch & Core', emoji: '🎯' },
  { id: 'chest', label: 'Brust', emoji: '🛡️' },
  { id: 'back', label: 'Rücken', emoji: '🧗' },
  { id: 'legs', label: 'Beine', emoji: '🦵' },
  { id: 'glutes', label: 'Po', emoji: '🍑' },
  { id: 'shoulders', label: 'Schultern', emoji: '🤸' },
  { id: 'arms', label: 'Arme', emoji: '💪' },
]

export const DAILY: { id: Daily; label: string; sub: string; emoji: string }[] = [
  { id: 'sitting', label: 'Überwiegend sitzend', sub: 'Z. B. Büro, Homeoffice', emoji: '🪑' },
  { id: 'mixed', label: 'Teils aktiv', sub: 'Viel auf den Beinen', emoji: '🚶' },
  { id: 'active', label: 'Körperlich aktiv', sub: 'Z. B. Handwerk, Pflege', emoji: '🔨' },
]

export const MINUTES: SessionMinutes[] = [30, 45, 60, 90]

/** Ort an- oder abwählen (mind. einer bleibt). Nur „Draußen“ → Laufen wird vorgeschlagen. */
export function togglePlace(a: OnboardingAnswers, p: Place): OnboardingAnswers {
  const places = a.places.includes(p) ? a.places.filter((x) => x !== p) : [...a.places, p]
  if (!places.length) return a
  const next = { ...a, places }
  if (places.length === 1 && places[0] === 'outdoor' && !a.cardio)
    return { ...next, cardio: 'run', cardioPerWeek: Math.max(2, suggestCardioPerWeek(a.goal)) }
  return next
}

/** Gerät an- oder abwählen: „Keine Geräte“ schließt den Rest aus, leer = „Keine Geräte“. */
export function toggleEquip(list: Equip[], e: Equip): Equip[] {
  if (e === 'none') return ['none']
  const rest = list.filter((x) => x !== 'none')
  const next = rest.includes(e) ? rest.filter((x) => x !== e) : [...rest, e]
  return next.length ? next : ['none']
}

/** Übungen pro Einheit je nach Zeit (Einsteiger bei 90 min eine weniger). */
export function exerciseCount(minutes: SessionMinutes, experience: Experience): number {
  if (minutes <= 30) return 4
  if (minutes <= 45) return 5
  if (minutes <= 60) return 6
  return experience === 'new' ? 7 : 8
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

// Bibliotheks-IDs aus public/exercise-library.json (Test prüft, dass jede existiert).
// Jede ID hat genau einen deutschen Namen – planStarter erkennt Vorhandenes am Namen.
const X = {
  // Studio
  bench: ex('Barbell_Bench_Press_-_Medium_Grip', 'Bankdrücken', [6, 10]),
  incline: ex('Incline_Dumbbell_Press', 'Schrägbankdrücken (Kurzhantel)', [8, 12]),
  ohp: ex('Dumbbell_Shoulder_Press', 'Schulterdrücken (Kurzhantel)', [8, 12]),
  lateral: ex('Side_Lateral_Raise', 'Seitheben', [12, 15]),
  pushdown: ex('Triceps_Pushdown', 'Trizepsdrücken am Kabel', [10, 15]),
  pulldown: ex('Wide-Grip_Lat_Pulldown', 'Latzug', [8, 12]),
  cableRow: ex('Seated_Cable_Rows', 'Rudern am Kabel', [8, 12]),
  facepull: ex('Face_Pull', 'Face Pulls', [12, 15]),
  crossover: ex('Cable_Crossover', 'Cable Crossover', [12, 15]),
  dips: ex('Dips_-_Triceps_Version', 'Dips', [8, 12]),
  curl: ex('Dumbbell_Bicep_Curl', 'Bizepscurls', [10, 12]),
  hammer: ex('Hammer_Curls', 'Hammercurls', [10, 12]),
  squat: ex('Barbell_Squat', 'Kniebeuge', [6, 10]),
  rdl: ex('Romanian_Deadlift', 'Rumänisches Kreuzheben', [8, 10]),
  legpress: ex('Leg_Press', 'Beinpresse', [10, 12]),
  legcurl: ex('Lying_Leg_Curls', 'Beinbeuger', [10, 15]),
  calf: ex('Standing_Calf_Raises', 'Wadenheben', [12, 15]),
  crunch: ex('Crunches', 'Crunches', [12, 20]),
  // Kurzhanteln
  goblet: ex('Goblet_Squat', 'Goblet Squat', [10, 15]),
  dbBench: ex('Dumbbell_Bench_Press', 'Bankdrücken (Kurzhantel)', [8, 12]),
  floor: ex('Dumbbell_Floor_Press', 'Bodendrücken (Kurzhantel)', [8, 12]),
  fly: ex('Dumbbell_Flyes', 'Fliegende (Kurzhantel)', [10, 15]),
  dbRow: ex('Bent_Over_Two-Dumbbell_Row', 'Vorgebeugtes Rudern (Kurzhantel)', [10, 12]),
  row1: ex('One-Arm_Dumbbell_Row', 'Einarmiges Rudern', [10, 12]),
  lunge: ex('Dumbbell_Lunges', 'Ausfallschritte (Kurzhantel)', [10, 12]),
  sldl: ex('Stiff-Legged_Dumbbell_Deadlift', 'Kreuzheben gestreckt (Kurzhantel)', [10, 12]),
  kick: ex('Tricep_Dumbbell_Kickback', 'Trizeps-Kickbacks', [10, 15]),
  dbCalf: ex('Standing_Dumbbell_Calf_Raise', 'Wadenheben (Kurzhantel)', [12, 15]),
  // Langhantel
  bbRow: ex('Bent_Over_Barbell_Row', 'Langhantelrudern', [8, 12]),
  bbPress: ex('Standing_Military_Press', 'Schulterdrücken stehend (Langhantel)', [6, 10]),
  bbCurl: ex('Barbell_Curl', 'Langhantel-Curls', [8, 12]),
  hipThrust: ex('Barbell_Hip_Thrust', 'Hip Thrust (Langhantel)', [8, 12]),
  // Kettlebell
  kbSwing: ex('One-Arm_Kettlebell_Swings', 'Kettlebell Swings', [12, 20]),
  kbFloor: ex('Alternating_Floor_Press', 'Bodendrücken (Kettlebell)', [8, 12]),
  kbRow: ex('One-Arm_Kettlebell_Row', 'Rudern (Kettlebell)', [10, 12]),
  kbPress: ex('Two-Arm_Kettlebell_Military_Press', 'Schulterdrücken (Kettlebell)', [8, 12]),
  kbTri: ex('Kettlebell_Overhead_Triceps_Extension', 'Trizepsstrecken (Kettlebell)', [10, 15]),
  halo: ex('Kettlebell_Halo', 'Kettlebell Halo', [10, 12]),
  // Bänder
  bandSquat: ex('Squats_-_With_Bands', 'Kniebeuge mit Band', [12, 15]),
  bandPress: ex('Bench_Press_-_With_Bands', 'Brustdrücken mit Band', [10, 15]),
  bandOhp: ex('Shoulder_Press_-_With_Bands', 'Schulterdrücken mit Band', [10, 15]),
  bandLateral: ex('Lateral_Raise_-_With_Bands', 'Seitheben mit Band', [12, 15]),
  bandFly: ex('Back_Flyes_-_With_Bands', 'Reverse Flys mit Band', [12, 15]),
  pullApart: ex('Band_Pull_Apart', 'Band Pull-Apart', [12, 20]),
  goodMorning: ex('Band_Good_Morning', 'Good Mornings mit Band', [12, 15]),
  bandBridge: ex('Hip_Lift_with_Band', 'Hüftheben mit Band', [12, 15]),
  bandSkull: ex('Band_Skull_Crusher', 'Trizepsstrecken mit Band', [12, 15]),
  bandCalf: ex('Calf_Raises_-_With_Bands', 'Wadenheben mit Band', [15, 20]),
  // Klimmzugstange / Bank
  pullup: ex('Pullups', 'Klimmzüge', [5, 10]),
  chinup: ex('Chin-Up', 'Klimmzüge im Untergriff', [5, 10]),
  benchDips: ex('Bench_Dips', 'Dips an der Bank', [10, 15]),
  stepup: ex('Step-up_with_Knee_Raise', 'Step-ups mit Kniehub', [10, 12]),
  // Ohne Geräte
  bwSquat: ex('Bodyweight_Squat', 'Kniebeuge (ohne Gewicht)', [12, 20]),
  bwLunge: ex('Bodyweight_Walking_Lunge', 'Ausfallschritte (ohne Gewicht)', [10, 16]),
  pushup: ex('Pushups', 'Liegestütze', [8, 15]),
  pushupWide: ex('Push-Up_Wide', 'Breite Liegestütze', [8, 15]),
  pushupDecline: ex('Decline_Push-Up', 'Liegestütze mit erhöhten Füßen', [6, 12]),
  pushupClose: ex('Push-Ups_-_Close_Triceps_Position', 'Enge Liegestütze', [6, 12]),
  bridge: ex('Butt_Lift_Bridge', 'Hüftheben', [12, 15]),
  bridge1: ex('Single_Leg_Glute_Bridge', 'Einbeiniges Hüftheben', [10, 12]),
  kickback: ex('Glute_Kickback', 'Glute Kickbacks', [12, 15]),
  deadBug: ex('Dead_Bug', 'Dead Bug', [10, 16]),
  reverseCrunch: ex('Reverse_Crunch', 'Reverse Crunch', [10, 15]),
  climber: ex('Mountain_Climbers', 'Mountain Climbers', [20, 30]),
}

/** Was zum Training da ist. „gym“ = Studio mit Maschinen, Kabelzug und Rack. */
type Gear = 'gym' | 'dumbbells' | 'barbell' | 'bands' | 'pullupbar' | 'bench' | 'kettlebell'
/** Kandidat für ein Bewegungsmuster; `heavy` = schwere Langhantel-Grundübung */
type Opt = { ex: Ex; needs: Gear[]; heavy: boolean }
const o = (e: Ex, needs: Gear[] = [], heavy = false): Opt => ({ ex: e, needs, heavy })

type Pattern =
  | 'squat'
  | 'legpress'
  | 'lunge'
  | 'hinge'
  | 'legcurl'
  | 'glute'
  | 'calf'
  | 'push_h'
  | 'push_incline'
  | 'fly'
  | 'push_v'
  | 'pull_v'
  | 'pull_h'
  | 'pull_h2'
  | 'rear'
  | 'lateral'
  | 'biceps'
  | 'biceps2'
  | 'triceps'
  | 'triceps2'
  | 'core'
  | 'core2'

/** Je Muster die Kandidaten in Wunsch-Reihenfolge – der erste passende gewinnt. */
const P: Record<Pattern, Opt[]> = {
  squat: [
    o(X.squat, ['gym'], true),
    o(X.goblet, ['dumbbells']),
    o(X.goblet, ['kettlebell']),
    o(X.bandSquat, ['bands']),
    o(X.bwSquat),
  ],
  legpress: [o(X.legpress, ['gym']), o(X.lunge, ['dumbbells']), o(X.stepup, ['bench']), o(X.bwLunge)],
  lunge: [o(X.lunge, ['dumbbells']), o(X.bwLunge), o(X.stepup, ['bench'])],
  hinge: [
    o(X.rdl, ['barbell'], true),
    o(X.sldl, ['dumbbells']),
    o(X.kbSwing, ['kettlebell']),
    o(X.goodMorning, ['bands']),
    o(X.bridge1),
  ],
  legcurl: [o(X.legcurl, ['gym']), o(X.bridge1), o(X.kickback)],
  glute: [
    o(X.hipThrust, ['barbell', 'bench'], true),
    o(X.bandBridge, ['bands']),
    o(X.bridge),
    o(X.bridge1),
    o(X.kickback),
  ],
  calf: [o(X.calf, ['gym']), o(X.dbCalf, ['dumbbells']), o(X.bandCalf, ['bands'])],
  push_h: [
    o(X.bench, ['gym'], true),
    o(X.dbBench, ['dumbbells', 'bench']),
    o(X.floor, ['dumbbells']),
    o(X.kbFloor, ['kettlebell']),
    o(X.bandPress, ['bands']),
    o(X.pushup),
    o(X.pushupWide),
  ],
  push_incline: [o(X.incline, ['dumbbells', 'bench']), o(X.pushup), o(X.pushupWide), o(X.pushupDecline)],
  fly: [o(X.crossover, ['gym']), o(X.fly, ['dumbbells', 'bench']), o(X.pushupWide)],
  push_v: [
    o(X.ohp, ['dumbbells']),
    o(X.bbPress, ['barbell'], true),
    o(X.kbPress, ['kettlebell']),
    o(X.bandOhp, ['bands']),
    o(X.pushupDecline),
  ],
  pull_v: [
    o(X.pulldown, ['gym']),
    o(X.pullup, ['pullupbar']),
    o(X.row1, ['dumbbells']),
    o(X.kbRow, ['kettlebell']),
    o(X.bandFly, ['bands']),
  ],
  pull_h: [
    o(X.cableRow, ['gym']),
    o(X.bbRow, ['barbell'], true),
    o(X.dbRow, ['dumbbells']),
    o(X.kbRow, ['kettlebell']),
    o(X.bandFly, ['bands']),
    o(X.chinup, ['pullupbar']),
  ],
  pull_h2: [
    o(X.row1, ['dumbbells']),
    o(X.kbRow, ['kettlebell']),
    o(X.chinup, ['pullupbar']),
    o(X.pullApart, ['bands']),
  ],
  rear: [o(X.facepull, ['gym']), o(X.pullApart, ['bands']), o(X.bandFly, ['bands'])],
  lateral: [o(X.lateral, ['dumbbells']), o(X.bandLateral, ['bands']), o(X.halo, ['kettlebell'])],
  biceps: [o(X.curl, ['dumbbells']), o(X.bbCurl, ['barbell']), o(X.chinup, ['pullupbar'])],
  biceps2: [o(X.hammer, ['dumbbells']), o(X.bbCurl, ['barbell'])],
  triceps: [
    o(X.pushdown, ['gym']),
    o(X.kick, ['dumbbells']),
    o(X.bandSkull, ['bands']),
    o(X.kbTri, ['kettlebell']),
    o(X.benchDips, ['bench']),
    o(X.pushupClose),
  ],
  triceps2: [o(X.dips, ['gym']), o(X.benchDips, ['bench']), o(X.kick, ['dumbbells']), o(X.pushupClose)],
  core: [o(X.crunch), o(X.deadBug), o(X.reverseCrunch)],
  core2: [o(X.deadBug), o(X.reverseCrunch), o(X.climber), o(X.crunch)],
}

/** Auffüllen, falls mit wenig Geräten zu wenig zusammenkommt (alles ohne Geräte). */
const FILL: Ex[] = [X.bridge, X.deadBug, X.bwLunge, X.pushup, X.kickback, X.reverseCrunch, X.climber, X.bwSquat]

/** Alle Bibliotheks-IDs, die das Intro verwenden kann (für den Test). */
export function onboardingLibraryIds(): string[] {
  return [...new Set(Object.values(X).map((e) => e.lib))]
}
/** Alle Übungen (für den Test: ein Name je ID). */
export function onboardingExercises(): Ex[] {
  return Object.values(X)
}

type Split = 'fullbody' | 'upperlower' | 'ppl'
export type Where = 'gym' | 'home' | 'outdoor'
type Region = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs'
type PlanDef = { name: string; region: Region; patterns: Pattern[] }

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

/**
 * Pläne als Bewegungsmuster in Wichtigkeits-Reihenfolge: vorne die Grundübungen, hinten Zubehör und Core.
 * Kürzere Einheiten schneiden hinten ab, längere nehmen mehr davon.
 */
function planDefs(split: Split, where: Where): PlanDef[] {
  if (where !== 'gym') {
    const pre = where === 'home' ? 'Zuhause' : 'Draußen'
    if (split === 'fullbody')
      return [
        {
          name: `${pre} A`,
          region: 'full',
          patterns: ['squat', 'push_h', 'pull_h', 'push_v', 'glute', 'core', 'lateral', 'triceps'],
        },
        {
          name: `${pre} B`,
          region: 'full',
          patterns: ['lunge', 'push_incline', 'pull_v', 'hinge', 'lateral', 'biceps', 'core2', 'calf'],
        },
      ]
    // Ohne Studio reicht Ober/Unter auch für 5–6 Tage
    return [
      {
        name: `${pre} Oben`,
        region: 'upper',
        patterns: ['push_h', 'pull_h', 'push_v', 'push_incline', 'biceps', 'triceps', 'lateral', 'rear'],
      },
      {
        name: `${pre} Unten`,
        region: 'lower',
        patterns: ['squat', 'hinge', 'lunge', 'glute', 'calf', 'core2', 'legcurl', 'core'],
      },
    ]
  }
  if (split === 'fullbody')
    return [
      {
        name: 'Ganzkörper A',
        region: 'full',
        patterns: ['squat', 'push_h', 'pull_h', 'push_v', 'legcurl', 'core', 'lateral', 'biceps'],
      },
      {
        name: 'Ganzkörper B',
        region: 'full',
        patterns: ['hinge', 'push_incline', 'pull_v', 'legpress', 'lateral', 'biceps', 'triceps', 'core2'],
      },
    ]
  if (split === 'upperlower')
    return [
      {
        name: 'Oberkörper',
        region: 'upper',
        patterns: ['push_h', 'pull_h', 'push_v', 'pull_v', 'biceps', 'triceps', 'lateral', 'rear'],
      },
      {
        name: 'Unterkörper',
        region: 'lower',
        patterns: ['squat', 'hinge', 'legpress', 'legcurl', 'calf', 'core', 'glute', 'lunge'],
      },
    ]
  return [
    {
      name: 'Push',
      region: 'push',
      patterns: ['push_h', 'push_incline', 'push_v', 'lateral', 'triceps', 'fly', 'triceps2', 'core'],
    },
    {
      name: 'Pull',
      region: 'pull',
      patterns: ['pull_v', 'pull_h', 'rear', 'biceps', 'biceps2', 'pull_h2', 'core', 'core2'],
    },
    {
      name: 'Beine',
      region: 'legs',
      patterns: ['squat', 'legpress', 'hinge', 'legcurl', 'calf', 'glute', 'lunge', 'core'],
    },
  ]
}

/** Welche Muster ein Schwerpunkt in einem Plan ergänzt (null = passt nicht in diesen Plan). */
function focusPatterns(focus: Focus, region: Region): Pattern[] | null {
  const upper = region === 'full' || region === 'upper'
  const lower = region === 'full' || region === 'lower' || region === 'legs'
  switch (focus) {
    case 'core':
      return ['core', 'core2']
    case 'chest':
      return upper || region === 'push' ? ['fly', 'push_incline', 'push_h'] : null
    case 'back':
      return upper || region === 'pull' ? ['pull_h2', 'pull_v', 'pull_h', 'rear'] : null
    case 'legs':
      return lower ? ['lunge', 'legpress', 'squat', 'legcurl', 'calf'] : null
    case 'glutes':
      return lower ? ['glute', 'hinge', 'lunge'] : null
    case 'shoulders':
      return upper || region === 'push' ? ['lateral', 'rear', 'push_v'] : null
    case 'arms':
      if (region === 'push') return ['triceps', 'triceps2']
      if (region === 'pull') return ['biceps', 'biceps2']
      return upper ? ['biceps', 'triceps', 'biceps2', 'triceps2'] : null
    default:
      return null
  }
}

function pick(patterns: Pattern[], gear: Set<Gear>, skipHeavy: boolean, used: Set<string>): Ex | null {
  for (const p of patterns)
    for (const c of P[p]) {
      if (used.has(c.ex.lib) || (skipHeavy && c.heavy)) continue
      if (c.needs.every((g) => gear.has(g))) return c.ex
    }
  return null
}

/** Übungen eines Plans: Muster auflösen, ggf. auffüllen, auf die Zeit kürzen, Schwerpunkt ergänzen. */
function planExercises(def: PlanDef, gear: Set<Gear>, count: number, skipHeavy: boolean, focus: Focus): Ex[] {
  const used = new Set<string>()
  const list: { ex: Ex; core: boolean }[] = []
  for (const p of def.patterns) {
    const hit = pick([p], gear, skipHeavy, used)
    if (!hit) continue
    used.add(hit.lib)
    list.push({ ex: hit, core: p === 'core' || p === 'core2' })
  }
  const out = list.slice(0, count)
  const taken = new Set(out.map((x) => x.ex.lib))
  // Schwerpunkt zuerst wählen, damit das Auffüllen ihm nichts wegnimmt
  const fp = focusPatterns(focus, def.region)
  const extra = fp ? pick(fp, gear, skipHeavy, taken) : null
  if (extra) taken.add(extra.lib)
  for (const f of FILL) {
    if (out.length >= count) break
    if (taken.has(f.lib)) continue
    taken.add(f.lib)
    out.push({ ex: f, core: true })
  }
  if (extra) {
    // vor den Core-Übungen am Ende einreihen (Core-Schwerpunkt ans Ende)
    const at = focus === 'core' ? -1 : out.findIndex((x) => x.core)
    out.splice(at < 0 ? out.length : at, 0, { ex: extra, core: focus === 'core' })
  }
  return out.map((x) => x.ex)
}

/** Wo wird trainiert? Studio schlägt Zuhause schlägt Draußen. */
export function trainingPlace(places: Place[]): Where {
  if (places.includes('gym') || !places.length) return 'gym'
  return places.includes('home') ? 'home' : 'outdoor'
}

function gearFor(a: OnboardingAnswers): Set<Gear> {
  const where = trainingPlace(a.places)
  if (where === 'gym')
    return new Set<Gear>(['gym', 'dumbbells', 'barbell', 'bands', 'pullupbar', 'bench', 'kettlebell'])
  if (where === 'outdoor') return new Set()
  return new Set(a.equipment.filter((e): e is Exclude<Equip, 'none' | 'mat'> => e !== 'none' && e !== 'mat'))
}

/**
 * Wiederholungen ans Ziel anpassen: Kraft = weniger, Fitness/Ausdauer = mehr.
 * Mit Beschwerden (`careful`) immer im leichteren, höheren Bereich.
 */
export function repsFor(goal: FitGoal, reps: [number, number], careful = false): [number, number] {
  const [lo, hi] = reps
  if (careful) return [Math.max(10, lo), Math.max(15, hi)]
  if (goal === 'strength' && lo <= 8) return [Math.max(3, lo - 2), Math.max(5, hi - 4)]
  if ((goal === 'fit' || goal === 'endurance') && lo < 10) return [10, Math.max(15, hi)]
  return reps
}

/** Vorlage (für planStarter) passend zu den Antworten. */
export function buildTemplate(a: OnboardingAnswers): StarterTemplate & { split: Split } {
  const days = Math.max(1, a.gymDays.length)
  const where = trainingPlace(a.places)
  const picked = pickSplit(days, a.experience)
  // Ohne Studio gibt es kein Push/Pull/Beine
  const split: Split = where !== 'gym' && picked === 'ppl' ? 'upperlower' : picked
  const gear = gearFor(a)
  const count = exerciseCount(a.minutes, a.experience)
  // Mit Beschwerden: Einsteiger ohne schwere Langhantel-Grundübungen
  const skipHeavy = a.limits && a.experience === 'new'
  const plans = planDefs(split, where).map((d) => ({
    name: d.name,
    exercises: planExercises(d, gear, count, skipHeavy, a.focus).map((e) => ({
      ...e,
      reps: repsFor(a.goal, e.reps, a.limits),
    })),
  }))
  return {
    id: split,
    split,
    title: where === 'gym' ? SPLIT_LABEL[split] : `${SPLIT_LABEL[split]} (${where === 'home' ? 'Zuhause' : 'Draußen'})`,
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

const LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active']

/**
 * Aktivität aus Sport (Kraft + Ausdauer pro Woche) und Alltag.
 * „Teils aktiv“ ist die Mitte; sitzend eine Stufe weniger, körperlich aktiv eine mehr.
 */
export function activityFor(sessionsPerWeek: number, daily: Daily = 'mixed'): ActivityLevel {
  const sport = sessionsPerWeek <= 1 ? 1 : sessionsPerWeek <= 4 ? 2 : sessionsPerWeek <= 6 ? 3 : 4
  const shift = daily === 'sitting' ? -1 : daily === 'active' ? 1 : 0
  return LEVELS[Math.min(4, Math.max(0, sport + shift))]
}

/** „Mo · Mi · Fr“ */
export const dayList = (days: number[]) =>
  [...days]
    .sort((x, y) => x - y)
    .map((d) => WD[d])
    .join(' · ')
export { WD as WEEKDAYS }
