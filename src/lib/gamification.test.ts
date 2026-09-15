import { describe, expect, it } from 'vitest'
import { achievements, mascotStage, rankForSessions } from './gamification'

describe('rankForSessions', () => {
  it('startet als Frischling und steigt auf', () => {
    expect(rankForSessions(0).title).toBe('Frischling')
    expect(rankForSessions(15).title).toBe('Hantel-Azubi')
    expect(rankForSessions(100).title).toBe('Maschinen-Flüsterer')
  })
  it('zeigt Trainings bis zum nächsten Rang', () => {
    expect(rankForSessions(12).toNext).toBe(3) // bis 15
    expect(rankForSessions(600).toNext).toBeNull()
  })
})

describe('mascotStage', () => {
  it('wächst mit der Anzahl Trainings', () => {
    expect(mascotStage(0).emoji).toBe('🥚')
    expect(mascotStage(10).emoji).toBe('🐣')
    expect(mascotStage(250).emoji).toBe('🦾')
  })
})

describe('achievements', () => {
  it('markiert erreichte Meilensteine', () => {
    const a = achievements({
      sessions: 55,
      weekStreak: 5,
      tonnage: 12000,
      maxWeight: 120,
      muscleCategoriesTrained: 4,
    })
    const done = new Set(a.filter((x) => x.done).map((x) => x.id))
    expect(done.has('s50')).toBe(true)
    expect(done.has('s100')).toBe(false)
    expect(done.has('streak4')).toBe(true)
    expect(done.has('w100')).toBe(true)
    expect(done.has('allround')).toBe(true)
  })
})
