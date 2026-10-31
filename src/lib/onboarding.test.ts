import { describe, expect, it } from 'vitest'
import {
  buildCardioPlan,
  buildSchedule,
  buildTemplate,
  pickSplit,
  repsFor,
  suggestDays,
  weekPlanNames,
  type OnboardingAnswers,
} from './onboarding'
import { normalizePrefs } from './userPrefs'
import { withWidget } from './dashboard'

const base: OnboardingAnswers = {
  goal: 'muscle',
  experience: 'some',
  place: 'gym',
  gymDays: [0, 2, 4],
  cardio: null,
  cardioPerWeek: 0,
}

describe('Intro-Plan', () => {
  it('Einsteiger mit 3 Tagen → Ganzkörper, Profi → Push/Pull/Beine', () => {
    expect(pickSplit(3, 'new')).toBe('fullbody')
    expect(pickSplit(3, 'pro')).toBe('ppl')
    expect(pickSplit(4, 'some')).toBe('upperlower')
    expect(pickSplit(2, 'pro')).toBe('fullbody')
  })

  it('Zuhause nutzt nur Heim-Übungen', () => {
    const t = buildTemplate({ ...base, place: 'home', gymDays: [0, 1, 3, 4, 5] })
    expect(t.plans.map((p) => p.name)).toEqual(['Zuhause Oben', 'Zuhause Unten'])
    expect(t.plans.flatMap((p) => p.exercises).some((e) => e.lib === 'Barbell_Squat')).toBe(false)
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
