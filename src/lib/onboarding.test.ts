import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ANSWERS,
  activityFor,
  buildCardioPlan,
  buildSchedule,
  buildTemplate,
  exerciseCount,
  onboardingExercises,
  onboardingLibraryIds,
  pickSplit,
  repsFor,
  suggestDays,
  toggleEquip,
  togglePlace,
  weekPlanNames,
  type Equip,
  type OnboardingAnswers,
} from './onboarding'
import { normalizePrefs } from './userPrefs'
import { withWidget } from './dashboard'

const base: OnboardingAnswers = {
  ...DEFAULT_ANSWERS,
  goal: 'muscle',
  experience: 'some',
  places: ['gym'],
  gymDays: [0, 2, 4],
  minutes: 60,
  cardio: null,
  cardioPerWeek: 0,
}

const library = JSON.parse(readFileSync(resolve(__dirname, '../../public/exercise-library.json'), 'utf8')) as {
  exercises: { id: string; equipment: string; muscle: string }[]
}
const byId = new Map(library.exercises.map((e) => [e.id, e]))
const libs = (a: OnboardingAnswers) => buildTemplate(a).plans.flatMap((p) => p.exercises.map((e) => e.lib))
const home = (equipment: Equip[], extra: Partial<OnboardingAnswers> = {}): OnboardingAnswers => ({
  ...base,
  places: ['home'],
  equipment,
  ...extra,
})

describe('Intro-Plan', () => {
  it('Einsteiger mit 3 Tagen → Ganzkörper, Profi → Push/Pull/Beine', () => {
    expect(pickSplit(3, 'new')).toBe('fullbody')
    expect(pickSplit(3, 'pro')).toBe('ppl')
    expect(pickSplit(4, 'some')).toBe('upperlower')
    expect(pickSplit(2, 'pro')).toBe('fullbody')
  })

  it('jede verwendete Bibliotheks-ID gibt es wirklich', () => {
    const missing = onboardingLibraryIds().filter((id) => !byId.has(id))
    expect(missing).toEqual([])
  })

  it('jede Bibliotheks-ID hat genau einen Namen und jeder Name genau eine ID', () => {
    const nameOf = new Map<string, string>()
    const idOf = new Map<string, string>()
    for (const e of onboardingExercises()) {
      expect(nameOf.get(e.lib) ?? e.name).toBe(e.name)
      expect(idOf.get(e.name) ?? e.lib).toBe(e.lib)
      nameOf.set(e.lib, e.name)
      idOf.set(e.name, e.lib)
    }
  })

  it('Zuhause nutzt nur Heim-Übungen', () => {
    const t = buildTemplate({ ...home(['dumbbells']), gymDays: [0, 1, 3, 4, 5] })
    expect(t.plans.map((p) => p.name)).toEqual(['Zuhause Oben', 'Zuhause Unten'])
    expect(t.title).toBe('Oberkörper · Unterkörper (Zuhause)')
    expect(t.plans.flatMap((p) => p.exercises).some((e) => e.lib === 'Barbell_Squat')).toBe(false)
  })

  it('Studio-Pläne bei 60 min bleiben wie gewohnt', () => {
    const t = buildTemplate({ ...base, experience: 'new' })
    expect(t.plans[0].exercises.map((e) => e.lib)).toEqual([
      'Barbell_Squat',
      'Barbell_Bench_Press_-_Medium_Grip',
      'Seated_Cable_Rows',
      'Dumbbell_Shoulder_Press',
      'Lying_Leg_Curls',
      'Crunches',
    ])
  })

  it('Zeit pro Training bestimmt die Anzahl der Übungen – Grundübungen bleiben', () => {
    expect([30, 45, 60, 90].map((m) => exerciseCount(m as 30, 'some'))).toEqual([4, 5, 6, 8])
    expect(exerciseCount(90, 'new')).toBe(7)
    for (const [minutes, n] of [
      [30, 4],
      [45, 5],
      [60, 6],
      [90, 8],
    ] as const) {
      for (const a of [base, { ...base, gymDays: [0, 2, 4, 5] }, { ...base, experience: 'pro' as const }])
        expect(buildTemplate({ ...a, minutes }).plans.every((p) => p.exercises.length === n)).toBe(true)
      // auch ohne Geräte (wird aufgefüllt)
      expect(buildTemplate({ ...home(['none']), minutes }).plans.every((p) => p.exercises.length === n)).toBe(true)
    }
    const short = buildTemplate({ ...base, minutes: 30 }).plans[0].exercises.map((e) => e.lib)
    expect(short[0]).toBe('Barbell_Squat')
    expect(short).not.toContain('Crunches')
  })

  it('ohne Geräte nur Körpergewicht, Klimmzüge nur mit Stange', () => {
    for (const days of [
      [0, 2, 4],
      [0, 1, 3, 4],
    ]) {
      const ids = libs({ ...home(['none']), gymDays: days, minutes: 90 })
      expect(ids.every((id) => byId.get(id)!.equipment === 'Körpergewicht')).toBe(true)
      expect(ids).toContain('Pushups')
      expect(ids).toContain('Bodyweight_Squat')
      expect(ids).not.toContain('Pullups')
    }
    expect(libs(home(['pullupbar']))).toContain('Pullups')
    expect(libs(home(['mat']))).toEqual(libs(home(['none'])))
  })

  it('Geräte zuhause werden genutzt', () => {
    const bands = libs({ ...home(['bands']), minutes: 90 })
    expect(bands.some((id) => byId.get(id)!.equipment === 'Band')).toBe(true)
    expect(bands.some((id) => byId.get(id)!.equipment === 'Kurzhantel')).toBe(false)
    expect(libs(home(['kettlebell']))).toContain('One-Arm_Kettlebell_Swings')
    expect(libs(home(['dumbbells']))).toContain('Goblet_Squat')
    expect(libs(home(['dumbbells', 'bench']))).toContain('Dumbbell_Bench_Press')
    expect(libs(home(['dumbbells']))).not.toContain('Dumbbell_Bench_Press')
    // Kein Studio-Gerät zuhause
    const all = libs({ ...home(['dumbbells', 'barbell', 'bands', 'pullupbar', 'bench', 'kettlebell']), minutes: 90 })
    expect(all.some((id) => ['Maschine', 'Kabelzug'].includes(byId.get(id)!.equipment))).toBe(false)
  })

  it('nur Draußen: Körpergewicht-Plan und Laufen vorgeschlagen', () => {
    const a = togglePlace(togglePlace(base, 'outdoor'), 'gym')
    expect(a.places).toEqual(['outdoor'])
    expect(a.cardio).toBe('run')
    expect(a.cardioPerWeek).toBeGreaterThanOrEqual(2)
    const t = buildTemplate(a)
    expect(t.title).toBe('Ganzkörper (Draußen)')
    expect(t.plans.flatMap((p) => p.exercises).every((e) => byId.get(e.lib)!.equipment === 'Körpergewicht')).toBe(true)
    // Letzter Ort lässt sich nicht abwählen; Studio + Draußen = Studio-Plan
    expect(togglePlace(a, 'outdoor')).toBe(a)
    expect(buildTemplate({ ...base, places: ['gym', 'outdoor'] }).title).toBe('Ganzkörper')
    // Wer schon Ausdauer gewählt hat, behält sie
    expect(togglePlace({ ...base, places: ['home'], cardio: 'bike', cardioPerWeek: 1 }, 'outdoor').cardio).toBe('bike')
  })

  it('Geräte-Auswahl: „Keine Geräte“ schließt den Rest aus', () => {
    expect(toggleEquip(['dumbbells'], 'none')).toEqual(['none'])
    expect(toggleEquip(['none'], 'bands')).toEqual(['bands'])
    expect(toggleEquip(['bands'], 'bands')).toEqual(['none'])
    expect(toggleEquip(['bands', 'mat'], 'bench')).toEqual(['bands', 'mat', 'bench'])
  })

  it('Schwerpunkt gibt eine passende Übung extra', () => {
    const plain = buildTemplate(base)
    const arms = buildTemplate({ ...base, focus: 'arms' })
    arms.plans.forEach((p, i) => expect(p.exercises.length).toBe(plain.plans[i].exercises.length + 1))
    const extra = arms.plans[0].exercises.find((e) => !plain.plans[0].exercises.some((x) => x.lib === e.lib))!
    expect(['Bizeps', 'Trizeps']).toContain(byId.get(extra.lib)!.muscle)
    // Split: Bein-Schwerpunkt nur am Beintag
    const ul = { ...base, gymDays: [0, 1, 3, 4] }
    const legs = buildTemplate({ ...ul, focus: 'legs' }).plans.map((p) => p.exercises.length)
    expect(legs).toEqual([6, 7])
    // Zuhause ohne Geräte: Po-Übung ohne Gewicht
    const glutes = buildTemplate({ ...home(['none']), focus: 'glutes' })
    expect(glutes.plans.every((p) => p.exercises.length === 7)).toBe(true)
    expect(glutes.plans.flatMap((p) => p.exercises).every((e) => byId.get(e.lib)!.equipment === 'Körpergewicht')).toBe(
      true,
    )
    // Core kommt ans Ende
    const core = buildTemplate({ ...base, focus: 'core' }).plans[0].exercises
    expect(['Bauch']).toContain(byId.get(core[core.length - 1].lib)!.muscle)
  })

  it('mit Beschwerden: leichter, Einsteiger ohne schwere Langhantel', () => {
    expect(repsFor('strength', [6, 10], true)).toEqual([10, 15])
    expect(repsFor('muscle', [12, 20], true)).toEqual([12, 20])
    const t = buildTemplate({ ...base, experience: 'new', limits: true })
    const ids = t.plans.flatMap((p) => p.exercises.map((e) => e.lib))
    for (const heavy of ['Barbell_Squat', 'Barbell_Bench_Press_-_Medium_Grip', 'Romanian_Deadlift'])
      expect(ids).not.toContain(heavy)
    expect(t.plans.every((p) => p.exercises.length === 6)).toBe(true)
    expect(t.plans.flatMap((p) => p.exercises).every((e) => e.reps![0] >= 10)).toBe(true)
    // Erfahrene behalten die Grundübungen, aber mit mehr Wiederholungen
    const pro = buildTemplate({ ...base, limits: true })
    expect(pro.plans[0].exercises[0]).toMatchObject({ lib: 'Barbell_Squat', reps: [10, 15] })
  })

  it('Aktivität aus Sport und Alltag', () => {
    expect(activityFor(3)).toBe('moderate')
    expect(activityFor(3, 'mixed')).toBe('moderate')
    expect(activityFor(3, 'sitting')).toBe('light')
    expect(activityFor(3, 'active')).toBe('active')
    expect(activityFor(0, 'sitting')).toBe('sedentary')
    expect(activityFor(1, 'mixed')).toBe('light')
    expect(activityFor(6, 'active')).toBe('very_active')
    expect(activityFor(9, 'active')).toBe('very_active')
    expect(activityFor(7, 'sitting')).toBe('active')
  })

  it('Kraft-Ziel senkt die Wiederholungen', () => {
    expect(repsFor('strength', [6, 10])).toEqual([4, 6])
    expect(repsFor('fit', [6, 10])).toEqual([10, 15])
    expect(repsFor('muscle', [8, 12])).toEqual([8, 12])
  })

  it('Pläne werden der Reihe nach auf die Tage verteilt', () => {
    expect(weekPlanNames(['A', 'B'], [4, 0, 2])).toEqual(['A', null, 'B', null, 'A', null, null])
    const s = buildSchedule(new Map([['A', 'id-a']]), ['A', 'B'], [0, 2])
    expect(s).toEqual({ type: 'weekdays', days: ['id-a', null, null, null, null, null, null] })
    expect(suggestDays(3)).toEqual([0, 2, 4])
  })

  it('Ausdauer bevorzugt freie Tage, Abnehmen bekommt eine lange Einheit', () => {
    const c = buildCardioPlan({ ...base, goal: 'lose', cardio: 'run', cardioPerWeek: 2 })!
    expect(c.sessions.every((s) => ![0, 2, 4].includes(s.day))).toBe(true)
    expect(c.sessions.some((s) => s.type === 'long')).toBe(true)
    expect(buildCardioPlan({ ...base, cardio: null, cardioPerWeek: 2 })).toBeNull()
  })

  it('Einsteiger bekommen keine Intervalle', () => {
    const c = buildCardioPlan({ ...base, experience: 'new', goal: 'endurance', cardio: 'run', cardioPerWeek: 3 })!
    expect(c.sessions.some((s) => s.type === 'interval')).toBe(false)
    const p = buildCardioPlan({ ...base, experience: 'pro', goal: 'endurance', cardio: 'run', cardioPerWeek: 3 })!
    expect(p.sessions.filter((s) => s.type === 'interval')).toHaveLength(1)
  })

  it('Einstellungen: Ausdauer-Plan wird robust gelesen', () => {
    const p = normalizePrefs({ onboarded: true, cardioPlan: { kind: 'run', sessions: [{ day: 9, type: 'x' }] } })
    expect(p.onboarded).toBe(true)
    expect(p.cardioPlan!.sessions[0]).toEqual({ day: 6, kind: 'run', type: 'easy', minutes: 30 })
    expect(normalizePrefs({ cardioPlan: { kind: 'swim', sessions: [] } }).cardioPlan).toBeNull()
  })

  it('Ausdauer-Widget wird hinter „Nächstes Training“ eingefügt', () => {
    expect(withWidget(['kcal', 'nextWorkout', 'water'], 'cardioPlan', 'nextWorkout')).toEqual([
      'kcal',
      'nextWorkout',
      'cardioPlan',
      'water',
    ])
    expect(withWidget(null, 'cardioPlan', 'nextWorkout')).toBeNull()
  })
})
