import { describe, expect, it } from 'vitest'
import { buddyMood, friendBuddyMood, pickLine } from './buddyMood'

const D = '2026-10-04'

describe('buddyMood', () => {
  it('ohne Daten: fröhliche Begrüßung', () => {
    const r = buddyMood({ date: D })
    expect(r.mood).toBe('happy')
    expect(r.line).toContain('Buddy')
  })

  it('laufendes Training hat Vorrang vor allem', () => {
    const r = buddyMood({ activeWorkout: true, newPrToday: true, daysSinceLastWorkout: 10, date: D })
    expect(r.mood).toBe('focus')
  })

  it('Rekord heute → stolz (vor Wochenziel/Training)', () => {
    expect(buddyMood({ newPrToday: true, trainedToday: true, date: D }).mood).toBe('proud')
  })

  it('Wochenziel erreicht → stolz', () => {
    const r = buddyMood({ weeklySessions: 3, weeklyGoal: 3, trainedToday: true, date: D })
    expect(r.mood).toBe('proud')
  })

  it('heute trainiert → fröhlich', () => {
    expect(buddyMood({ trainedToday: true, weeklySessions: 1, date: D }).mood).toBe('happy')
  })

  it('4–6 Tage Pause → traurig, ab 7 → verschlafen', () => {
    expect(buddyMood({ daysSinceLastWorkout: 4, date: D }).mood).toBe('sad')
    expect(buddyMood({ daysSinceLastWorkout: 6, date: D }).mood).toBe('sad')
    expect(buddyMood({ daysSinceLastWorkout: 9, date: D }).mood).toBe('sleepy')
    expect(buddyMood({ daysSinceLastWorkout: 3, date: D }).mood).toBe('happy')
  })

  it('alle Muskeln erschöpft → müde (aber Pause geht vor)', () => {
    expect(buddyMood({ daysSinceLastWorkout: 1, recoveryAllTired: true, date: D }).mood).toBe('tired')
    expect(buddyMood({ daysSinceLastWorkout: 5, recoveryAllTired: true, date: D }).mood).toBe('sad')
  })

  it('abends wenig Eiweiß → hungrig mit Restmenge', () => {
    const r = buddyMood({
      daysSinceLastWorkout: 1,
      showNutrition: true,
      hour: 18,
      proteinToday: 40,
      proteinTarget: 150,
      date: D,
    })
    expect(r.mood).toBe('hungry')
    expect(r.line).toContain('110 g')
  })

  it('hungrig nur abends, mit Ernährung und unter 60 %', () => {
    const base = { daysSinceLastWorkout: 1, proteinTarget: 150, date: D }
    expect(buddyMood({ ...base, showNutrition: true, hour: 12, proteinToday: 10 }).mood).toBe('happy')
    expect(buddyMood({ ...base, showNutrition: false, hour: 19, proteinToday: 10 }).mood).toBe('happy')
    expect(buddyMood({ ...base, showNutrition: true, hour: 19, proteinToday: 100 }).mood).toBe('happy')
  })

  it('Spruch ist pro Tag stabil', () => {
    const a = buddyMood({ daysSinceLastWorkout: 5, date: D })
    const b = buddyMood({ daysSinceLastWorkout: 5, date: D })
    expect(a.line).toBe(b.line)
    expect(a.line.length).toBeGreaterThan(0)
  })
})

describe('pickLine', () => {
  it('wählt deterministisch aus der Liste', () => {
    const lines = ['a', 'b', 'c']
    expect(lines).toContain(pickLine(lines, 'x'))
    expect(pickLine(lines, 'x')).toBe(pickLine(lines, 'x'))
  })
})

describe('friendBuddyMood', () => {
  it('heute trainiert → fröhlich, lange Pause → verschlafen', () => {
    expect(friendBuddyMood(D, D)).toBe('happy')
    expect(friendBuddyMood('2026-10-02', D)).toBe('happy')
    expect(friendBuddyMood('2026-09-30', D)).toBe('sleepy')
    expect(friendBuddyMood(null, D)).toBe('sleepy')
  })
})
