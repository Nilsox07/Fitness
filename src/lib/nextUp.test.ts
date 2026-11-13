import { describe, expect, it } from 'vitest'
import { mealSlot, nextUp, waterBehind, type NextCtx } from './nextUp'

const base: NextCtx = {
  hour: 12,
  showNutrition: true,
  hasWatch: false,
  hasHybrid: false,
  trainedToday: false,
  restDay: false,
  nextWorkout: 'Push',
  cardioToday: null,
  cardioDone: false,
  mealsLogged: {},
  waterMl: 1500,
  waterTarget: 2500,
  supplementDue: null,
  bedAt: null,
  feelAnswered: true,
}

describe('Jetzt dran', () => {
  it('mittags: Training und Mittagessen, höchstens 3', () => {
    const r = nextUp(base)
    expect(r.map((x) => x.kind)).toEqual(['workout', 'meal'])
    expect(r[1].title).toBe('Mittagessen')
  })

  it('morgens zuerst die Frage nach dem Gefühl – danach nicht mehr', () => {
    expect(nextUp({ ...base, hour: 7, feelAnswered: false })[0].kind).toBe('feel')
    expect(nextUp({ ...base, hour: 13, feelAnswered: false }).some((x) => x.kind === 'feel')).toBe(false)
  })

  it('erledigtes verschwindet, Ruhetag ohne Training', () => {
    const r = nextUp({ ...base, trainedToday: true, mealsLogged: { lunch: true } })
    expect(r).toEqual([])
    expect(nextUp({ ...base, restDay: true }).some((x) => x.kind === 'workout')).toBe(false)
  })

  it('ohne Ernährung keine Essens-/Trinkhinweise', () => {
    expect(nextUp({ ...base, showNutrition: false, waterMl: 0 }).map((x) => x.kind)).toEqual(['workout'])
  })

  it('abends Schlafenszeit nur mit Uhr, Ausdauer nur mit Hybrid', () => {
    const eve = { ...base, hour: 20, trainedToday: true, mealsLogged: { dinner: true }, waterMl: 2500, bedAt: '22:30' }
    expect(nextUp(eve)).toEqual([])
    expect(nextUp({ ...eve, hasWatch: true })[0].title).toBe('Ins Bett um 22:30')
    expect(nextUp({ ...eve, cardioToday: 'Locker laufen · 30 min' })).toEqual([])
    expect(nextUp({ ...eve, hasHybrid: true, cardioToday: 'Locker laufen · 30 min' })[0].kind).toBe('cardio')
  })

  it('Mahlzeit je Uhrzeit, Trinken erst ab 500 ml Rückstand', () => {
    expect(mealSlot(8)).toBe('breakfast')
    expect(mealSlot(16)).toBeNull()
    expect(mealSlot(19)).toBe('dinner')
    expect(waterBehind(1000, 2800, 14)).toBe(400)
    expect(waterBehind(0, 2800, 6)).toBe(0)
  })
})
