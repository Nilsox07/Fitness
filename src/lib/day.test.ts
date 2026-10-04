import { describe, expect, it } from 'vitest'
import { dayLabel, localDate, shiftDate, trainingDay } from './day'

describe('day', () => {
  it('verschiebt über Monats- und Jahresgrenzen', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2025-12-31', 1)).toBe('2026-01-01')
  })
  it('benennt heute und gestern', () => {
    expect(dayLabel('2026-09-30', '2026-09-30')).toBe('Heute')
    expect(dayLabel('2026-09-29', '2026-09-30')).toBe('Gestern')
    expect(dayLabel('2026-09-20', '2026-09-30')).toMatch(/20/)
  })
  it('localDate nutzt die lokale Zeit', () => {
    expect(localDate(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
    expect(localDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })
})

describe('trainingDay', () => {
  it('wechselt erst um 4 Uhr morgens', () => {
    expect(trainingDay(new Date(2026, 9, 4, 23, 30))).toBe('2026-10-04')
    expect(trainingDay(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-04')
    expect(trainingDay(new Date(2026, 9, 5, 3, 59))).toBe('2026-10-04')
    expect(trainingDay(new Date(2026, 9, 5, 4, 0))).toBe('2026-10-05')
  })
  it('über Monats- und Jahresgrenzen', () => {
    expect(trainingDay(new Date(2027, 0, 1, 2, 0))).toBe('2026-12-31')
  })
})
