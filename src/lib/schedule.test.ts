import { describe, expect, it } from 'vitest'
import {
  buildHistory,
  daysBetween,
  describeSchedule,
  isConfigured,
  makeAnchor,
  plannedTrainingDates,
  rotationPosition,
  sanitizeSchedule,
  todayPlan,
  upcoming,
  weekdayIndex,
  weeklyGoal,
  type HistoryEntry,
  type Schedule,
} from './schedule'

// 2026-10-05 ist ein Montag
const MON = '2026-10-05'
const h = (date: string, planId: string | null): HistoryEntry => ({ date, planId })

const PPL_REST: Schedule = { type: 'rotation', steps: ['push', 'pull', 'legs', null] }
const WEEKDAYS: Schedule = { type: 'weekdays', days: ['push', null, 'pull', null, 'legs', null, null] }

describe('Helfer', () => {
  it('weekdayIndex: Mo = 0, So = 6', () => {
    expect(weekdayIndex(MON)).toBe(0)
    expect(weekdayIndex('2026-10-04')).toBe(6)
    expect(weekdayIndex('2026-10-09')).toBe(4)
  })
  it('daysBetween über Zeitumstellung', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween(MON, MON)).toBe(0)
  })
  it('isConfigured', () => {
    expect(isConfigured(null)).toBe(false)
    expect(isConfigured({ type: 'weekdays', days: [null, null, null, null, null, null, null] })).toBe(false)
    expect(isConfigured({ type: 'rotation', steps: [null] })).toBe(false)
    expect(isConfigured({ type: 'flexible', perWeek: 2 })).toBe(true)
    expect(isConfigured(WEEKDAYS)).toBe(true)
  })
})

describe('todayPlan – Wochentage', () => {
  it('fester Plan oder Ruhetag je Wochentag', () => {
    expect(todayPlan(WEEKDAYS, [], MON)).toEqual({ kind: 'train', planId: 'push' })
    expect(todayPlan(WEEKDAYS, [], '2026-10-06')).toEqual({ kind: 'rest' })
    expect(todayPlan(WEEKDAYS, [], '2026-10-07')).toEqual({ kind: 'train', planId: 'pull' })
    expect(todayPlan(WEEKDAYS, [], '2026-10-11')).toEqual({ kind: 'rest' })
  })
  it('ohne Rhythmus oder flexibel → frei', () => {
    expect(todayPlan(null, [], MON)).toEqual({ kind: 'free' })
    expect(todayPlan({ type: 'flexible', perWeek: 3 }, [], MON)).toEqual({ kind: 'free' })
  })
})

describe('todayPlan – Rotation', () => {
  it('ohne Historie: erster Schritt', () => {
    expect(todayPlan(PPL_REST, [], MON)).toEqual({ kind: 'train', planId: 'push' })
  })
  it('nächster Schritt nach dem letzten Training — unabhängig vom Kalender', () => {
    expect(todayPlan(PPL_REST, [h('2026-10-01', 'push')], MON)).toEqual({ kind: 'train', planId: 'pull' })
    expect(todayPlan(PPL_REST, [h('2026-09-20', 'push'), h('2026-10-02', 'pull')], MON)).toEqual({
      kind: 'train',
      planId: 'legs',
    })
  })
  it('Ruhetag, wenn das letzte Training gestern war und danach Ruhe kommt', () => {
    expect(todayPlan(PPL_REST, [h('2026-10-04', 'legs')], MON)).toEqual({ kind: 'rest' })
  })
  it('Ruhe-Schritt wird übersprungen, wenn schon mehr Tage vergangen sind', () => {
    expect(todayPlan(PPL_REST, [h('2026-10-03', 'legs')], MON)).toEqual({ kind: 'train', planId: 'push' })
    expect(todayPlan(PPL_REST, [h('2026-09-01', 'legs')], MON)).toEqual({ kind: 'train', planId: 'push' })
  })
  it('mehrere Ruhetage hintereinander', () => {
    const s: Schedule = { type: 'rotation', steps: ['a', null, null, 'b'] }
    expect(todayPlan(s, [h('2026-10-04', 'a')], MON)).toEqual({ kind: 'rest' })
    expect(todayPlan(s, [h('2026-10-03', 'a')], MON)).toEqual({ kind: 'rest' })
    expect(todayPlan(s, [h('2026-10-02', 'a')], MON)).toEqual({ kind: 'train', planId: 'b' })
  })
  it('ignoriert Trainings von heute und ohne passenden Plan', () => {
    expect(todayPlan(PPL_REST, [h('2026-10-02', 'push'), h(MON, 'pull')], MON)).toEqual({
      kind: 'train',
      planId: 'pull',
    })
    expect(todayPlan(PPL_REST, [h('2026-10-01', 'push'), h('2026-10-03', null), h('2026-10-04', 'other')], MON)).toEqual({
      kind: 'train',
      planId: 'pull',
    })
  })
  it('anderer Plan außer der Reihe: Rotation springt auf dessen Position', () => {
    expect(todayPlan(PPL_REST, [h('2026-10-01', 'push'), h('2026-10-02', 'legs')], MON)).toEqual({
      kind: 'train',
      planId: 'push',
    })
  })
  it('doppelte Pläne in der Rotation (A B A C)', () => {
    const s: Schedule = { type: 'rotation', steps: ['a', 'b', 'a', 'c'] }
    expect(todayPlan(s, [h('2026-10-01', 'a')], MON)).toEqual({ kind: 'train', planId: 'b' })
    expect(todayPlan(s, [h('2026-10-01', 'a'), h('2026-10-02', 'b'), h('2026-10-03', 'a')], MON)).toEqual({
      kind: 'train',
      planId: 'c',
    })
    expect(
      todayPlan(s, [h('2026-10-01', 'a'), h('2026-10-02', 'b'), h('2026-10-03', 'a'), h('2026-10-04', 'c')], MON),
    ).toEqual({ kind: 'train', planId: 'a' })
  })
  it('Historie muss nicht sortiert sein', () => {
    expect(todayPlan(PPL_REST, [h('2026-10-02', 'pull'), h('2026-10-01', 'push')], MON)).toEqual({
      kind: 'train',
      planId: 'legs',
    })
  })
  it('nur Ruhetage → frei', () => {
    expect(todayPlan({ type: 'rotation', steps: [null, null] }, [], MON)).toEqual({ kind: 'free' })
  })
})

describe('Rotation – Anker („Wo stehe ich gerade?")', () => {
  it('Anker setzt den nächsten Schritt; ältere Trainings zählen nicht', () => {
    const s: Schedule = { ...PPL_REST, anchor: { stepIndex: 2, date: '2026-10-04' } }
    expect(todayPlan(s, [h('2026-10-03', 'push')], MON)).toEqual({ kind: 'train', planId: 'legs' })
  })
  it('Trainings nach dem Anker rücken weiter', () => {
    const s: Schedule = { ...PPL_REST, anchor: { stepIndex: 1, date: '2026-10-01' } }
    expect(todayPlan(s, [h('2026-10-02', 'pull')], MON)).toEqual({ kind: 'train', planId: 'legs' })
  })
  it('Anker auf Ruhetag gilt ab dem Anker-Tag', () => {
    const s: Schedule = { ...PPL_REST, anchor: { stepIndex: 3, date: '2026-10-04' } }
    expect(todayPlan(s, [], MON)).toEqual({ kind: 'rest' })
    expect(todayPlan(s, [], '2026-10-06')).toEqual({ kind: 'train', planId: 'push' })
  })
  it('makeAnchor: heute schon trainiert → Stand ab heute, sonst ab gestern', () => {
    expect(makeAnchor(2, [h(MON, 'push')], MON)).toEqual({ stepIndex: 2, date: MON })
    expect(makeAnchor(2, [h('2026-10-01', 'push')], MON)).toEqual({ stepIndex: 2, date: '2026-10-04' })
    const s: Schedule = { ...PPL_REST, anchor: makeAnchor(2, [h(MON, 'push')], MON) }
    // Das heutige Training rückt nicht nochmal weiter
    expect(todayPlan(s, [h(MON, 'push')], '2026-10-06')).toEqual({ kind: 'train', planId: 'legs' })
  })
  it('rotationPosition liefert den nächsten Schritt', () => {
    expect(rotationPosition(PPL_REST, [h('2026-10-02', 'pull')], MON)).toBe(2)
    expect(rotationPosition(PPL_REST, [h('2026-10-04', 'legs')], MON)).toBe(3)
    expect(rotationPosition(PPL_REST, [h('2026-10-02', 'legs')], MON)).toBe(0)
    expect(rotationPosition(WEEKDAYS, [], MON)).toBeNull()
  })
})

describe('weeklyGoal', () => {
  it('Wochentage: Anzahl Trainingstage', () => {
    expect(weeklyGoal(WEEKDAYS)).toBe(3)
  })
  it('Rotation: Trainingsschritte pro Zyklus auf 7 Tage', () => {
    expect(weeklyGoal(PPL_REST)).toBe(5) // 3/4 · 7 = 5,25
    expect(weeklyGoal({ type: 'rotation', steps: ['a', null] })).toBe(4) // 3,5 → 4
    expect(weeklyGoal({ type: 'rotation', steps: ['a', null, null] })).toBe(2) // 2,33
    expect(weeklyGoal({ type: 'rotation', steps: ['a', 'b'] })).toBe(7)
    expect(weeklyGoal({ type: 'rotation', steps: ['a', null, null, null, null, null, null, null, null] })).toBe(1)
  })
  it('flexibel: die Zahl (1–7), ohne Rhythmus 3', () => {
    expect(weeklyGoal({ type: 'flexible', perWeek: 4 })).toBe(4)
    expect(weeklyGoal({ type: 'flexible', perWeek: 12 })).toBe(7)
    expect(weeklyGoal(null)).toBe(3)
    expect(weeklyGoal({ type: 'rotation', steps: [] })).toBe(3)
  })
})

describe('upcoming', () => {
  it('Wochentage: 7 Tage ab heute', () => {
    const u = upcoming(WEEKDAYS, [], MON)
    expect(u).toHaveLength(7)
    expect(u.map((d) => d.plan.kind)).toEqual(['train', 'rest', 'train', 'rest', 'train', 'rest', 'rest'])
    expect(u[0].weekday).toBe(0)
  })
  it('Rotation: simuliert erledigte Trainings und Ruhetage', () => {
    const u = upcoming(PPL_REST, [h('2026-10-03', 'push')], MON)
    expect(u.map((d) => (d.plan.kind === 'train' ? d.plan.planId : d.plan.kind))).toEqual([
      'pull',
      'legs',
      'rest',
      'push',
      'pull',
      'legs',
      'rest',
    ])
  })
  it('Rotation: heute schon trainiert zählt real', () => {
    const u = upcoming(PPL_REST, [h('2026-10-03', 'push'), h(MON, 'legs')], MON, 3)
    expect(u[0]).toMatchObject({ done: true, plan: { kind: 'train', planId: 'legs' } })
    expect(u[1].plan).toEqual({ kind: 'rest' })
    expect(u[2].plan).toEqual({ kind: 'train', planId: 'push' })
  })
  it('flexibel: alles frei', () => {
    expect(upcoming({ type: 'flexible', perWeek: 3 }, [], MON, 2).map((d) => d.plan.kind)).toEqual(['free', 'free'])
  })
})

describe('plannedTrainingDates', () => {
  const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
  it('Wochentage: alle geplanten Tage der Woche', () => {
    expect([...plannedTrainingDates(WEEKDAYS, [], '2026-10-07', week)].sort()).toEqual([
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
    ])
  })
  it('Rotation: nur ab heute', () => {
    const got = plannedTrainingDates(PPL_REST, [h('2026-10-06', 'pull')], '2026-10-08', week)
    // Do: legs? Nein — letztes Training Di (pull) → Mi verpasst, Do legs, Fr Ruhe, Sa push, So pull
    expect([...got].sort()).toEqual(['2026-10-08', '2026-10-10', '2026-10-11'])
  })
  it('flexibel: nichts', () => {
    expect(plannedTrainingDates({ type: 'flexible', perWeek: 3 }, [], MON, week).size).toBe(0)
  })
})

describe('sanitizeSchedule', () => {
  const ids = new Set(['push', 'legs'])
  it('Wochentage: unbekannte Pläne → Ruhetag', () => {
    expect(sanitizeSchedule(WEEKDAYS, ids)).toEqual({
      type: 'weekdays',
      days: ['push', null, null, null, 'legs', null, null],
    })
  })
  it('Rotation: unbekannte Schritte fallen weg, Anker wandert mit', () => {
    const s: Schedule = { ...PPL_REST, anchor: { stepIndex: 2, date: MON } }
    expect(sanitizeSchedule(s, ids)).toEqual({
      type: 'rotation',
      steps: ['push', 'legs', null],
      anchor: { stepIndex: 1, date: MON },
    })
  })
  it('flexibel wird auf 1–7 begrenzt', () => {
    expect(sanitizeSchedule({ type: 'flexible', perWeek: 0 }, ids)).toEqual({ type: 'flexible', perWeek: 1 })
    expect(sanitizeSchedule(null, ids)).toBeNull()
  })
})

describe('buildHistory', () => {
  const plans = [
    { id: 'push', exercise_ids: ['bank', 'dips'] },
    { id: 'pull', exercise_ids: ['rudern', 'curls'] },
    { id: 'full', exercise_ids: ['bank', 'rudern', 'squat', 'dips'] },
  ]
  const s = (exercise_id: string, date: string, reps = 8) => ({ exercise_id, date, reps, reps_right: null })
  it('ordnet über die Übungen zu (höchster Anteil gewinnt)', () => {
    const got = buildHistory(plans, [
      s('bank', '2026-10-01'),
      s('dips', '2026-10-01'),
      s('rudern', '2026-10-03'),
      s('bank', '2026-10-03'),
      s('squat', '2026-10-03'),
      s('xyz', '2026-10-04'),
      s('curls', '2026-10-02', 0), // nicht ausgeführt
    ])
    expect(got).toEqual([h('2026-10-01', 'push'), h('2026-10-03', 'full'), h('2026-10-04', null)])
  })
  it('gemerkte Plan-Vorlage hat Vorrang', () => {
    const got = buildHistory(plans, [s('bank', '2026-10-01'), s('dips', '2026-10-01')], new Map([['2026-10-01', 'full']]))
    expect(got).toEqual([h('2026-10-01', 'full')])
  })
})

describe('describeSchedule', () => {
  it('beschreibt alle Typen', () => {
    expect(describeSchedule(PPL_REST)).toBe('Rotation · 3 Tage + Ruhetag')
    expect(describeSchedule({ type: 'rotation', steps: ['a', null, 'b', null, null] })).toBe(
      'Rotation · 2 Tage + 3 Ruhetage',
    )
    expect(describeSchedule(WEEKDAYS)).toBe('Wochentage · Mo, Mi, Fr')
    expect(describeSchedule({ type: 'flexible', perWeek: 4 })).toBe('Flexibel · 4× pro Woche')
    expect(describeSchedule(null)).toBe('Nicht festgelegt')
  })
})
