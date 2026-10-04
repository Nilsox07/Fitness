import { describe, expect, it } from 'vitest'
import { kcalTargetFor, trainedOn, TRAINING_BONUS } from './dayTarget'

describe('dayTarget', () => {
  const sets = [{ date: '2026-10-01' }, { date: '2026-10-03' }]
  it('erkennt Trainingstage per Kalenderdatum', () => {
    expect(trainedOn('2026-10-01', sets)).toBe(true)
    expect(trainedOn('2026-10-02', sets)).toBe(false)
    expect(trainedOn('2026-10-02', undefined)).toBe(false)
  })
  it('addiert den Trainingsbonus nur mit gesetztem Ziel', () => {
    expect(kcalTargetFor({ kcal_target: 2000 }, false)).toBe(2000)
    expect(kcalTargetFor({ kcal_target: 2000 }, true)).toBe(2000 + TRAINING_BONUS)
    expect(kcalTargetFor({ kcal_target: 0 }, true)).toBe(0)
    expect(kcalTargetFor(null, true)).toBe(0)
  })
  it('nimmt einen eigenen Trainingsbonus', () => {
    expect(kcalTargetFor({ kcal_target: 2000 }, true, 400)).toBe(2400)
    expect(kcalTargetFor({ kcal_target: 2000 }, true, 0)).toBe(2000)
    expect(kcalTargetFor({ kcal_target: 2000 }, false, 400)).toBe(2000)
  })
})
