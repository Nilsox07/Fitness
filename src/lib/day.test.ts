import { describe, expect, it } from 'vitest'
import { dayLabel, shiftDate } from './day'

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
})
