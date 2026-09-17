import { describe, expect, it } from 'vitest'
import { isoWeekId, lastWeekRange } from './weeklyReview'

describe('isoWeekId', () => {
  it('liefert die ISO-Woche im Format YYYY-Www', () => {
    // 1. Januar 2026 ist ein Donnerstag → ISO-Woche 1.
    expect(isoWeekId(new Date(2026, 0, 1))).toBe('2026-W01')
    // 4. Januar 2026 (Sonntag) gehört noch zu Woche 1.
    expect(isoWeekId(new Date(2026, 0, 4))).toBe('2026-W01')
    // 5. Januar 2026 (Montag) → Woche 2.
    expect(isoWeekId(new Date(2026, 0, 5))).toBe('2026-W02')
  })
})

describe('lastWeekRange', () => {
  it('gibt Montag–Sonntag der Vorwoche zurück', () => {
    // Mittwoch, 17. September 2025 → Vorwoche Mo 8. – So 14.
    const r = lastWeekRange(new Date(2025, 8, 17))
    expect(r.start).toBe('2025-09-08')
    expect(r.end).toBe('2025-09-14')
  })
})
