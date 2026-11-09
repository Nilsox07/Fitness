import { describe, expect, it } from 'vitest'
import {
  dayBonus,
  hybridKcal,
  kcalText,
  matchWatchKcal,
  parseKm,
  sessionMinutes,
  strengthKcal,
  strengthMet,
  weightOn,
  withWatch,
  type KcalSet,
} from './trainingKcal'
import { templateById } from './hybridSessions'

/** n Sätze, alle `gap` Minuten ab 18:00 */
const sets = (n: number, gap: number, ex = 'e', type = 'working'): KcalSet[] =>
  Array.from({ length: n }, (_, i) => ({
    created_at: new Date(Date.UTC(2026, 10, 9, 18, 0) + i * gap * 60000).toISOString(),
    set_type: type,
    reps: 10,
    exercise_id: ex,
  }))

const muscle = (m: string) => () => m

describe('Kalorien pro Training', () => {
  it('Dauer aus Zeitstempeln, sonst 2,5 min je Satz', () => {
    expect(sessionMinutes(sets(20, 3))).toBe(59) // 57 min Spanne + 2
    expect(sessionMinutes(sets(4, 0))).toBe(10)
  })

  it('MET steigt mit Dichte und großen Muskeln, mit Grenzen', () => {
    expect(strengthMet(15, 60, 0)).toBe(3.5)
    expect(strengthMet(30, 60, 1)).toBeCloseTo(6.3, 1)
    expect(strengthMet(100, 30, 1)).toBe(6.5)
    expect(strengthMet(2, 60, 0)).toBe(3)
  })

  it('typisches Training: 80 kg, 20 Sätze in 1 h ≈ 200–300 kcal', () => {
    const e = strengthKcal(sets(20, 3), 80, muscle('Brust'))!
    expect(e.kcal).toBeGreaterThan(180)
    expect(e.kcal).toBeLessThan(320)
    expect(e.lo).toBeLessThan(e.kcal)
    expect(kcalText(e)).toMatch(/^≈ \d+–\d+ kcal$/)
    // Beintag verbraucht mehr
    expect(strengthKcal(sets(20, 3), 80, muscle('Beine'))!.kcal).toBeGreaterThan(e.kcal)
    expect(strengthKcal([], 80, muscle('Beine'))).toBeNull()
  })

  it('Uhr gilt, wenn plausibel – sonst begrenzt', () => {
    const e = strengthKcal(sets(20, 3), 80, muscle('Brust'))!
    expect(withWatch(e, e.kcal * 1.2).source).toBe('watch')
    const high = withWatch(e, e.kcal * 3)
    expect(high.source).toBe('watch-capped')
    expect(high.kcal).toBeLessThanOrEqual(Math.round((e.kcal * 1.6) / 10) * 10)
    expect(withWatch(e, null)).toBe(e)
  })

  it('Uhr-Aktivität passend zur Trainingszeit', () => {
    const s = sets(10, 5) // 18:00–18:45 UTC
    const acts = [
      { started_at: '2026-11-09T17:55:00Z', duration_s: 3000, kcal: 350 },
      { started_at: '2026-11-09T08:00:00Z', duration_s: 1800, kcal: 300 },
    ]
    expect(matchWatchKcal(acts, s)).toBe(350)
    expect(matchWatchKcal([acts[1]], s)).toBeNull()
  })

  it('Hybrid: Laufen nach Strecke, Stationen nach Zeit', () => {
    expect(parseKm('1 km')).toBe(1)
    expect(parseKm('800 m')).toBe(0.8)
    expect(parseKm('30 Wdh.')).toBeNull()
    const t = templateById('engine')!
    const e = hybridKcal(t, [120, 60, 60], 80)
    // 0,4 km × 80 × 0,95 ≈ 30 + 120 s × 7 MET × 80 / 3600 ≈ 19
    expect(e.kcal).toBe(50)
  })

  it('Tagesbonus: pauschal oder halbe Gutschrift, max. 600', () => {
    expect(dayBonus('fixed', 250, true, 900)).toBe(250)
    expect(dayBonus('auto', 250, true, 330)).toBe(170)
    expect(dayBonus('auto', 250, true, 5000)).toBe(600)
    expect(dayBonus('auto', 250, false, 400)).toBe(0)
  })

  it('Gewicht am Datum', () => {
    const w = [
      { date: '2026-10-01', kg: 82 },
      { date: '2026-11-01', kg: 80 },
    ]
    expect(weightOn('2026-10-15', w, 70)).toBe(82)
    expect(weightOn('2026-09-01', w, 70)).toBe(70)
    expect(weightOn('2026-09-01', [], null)).toBe(75)
  })
})
