import { describe, expect, it } from 'vitest'
import { goalPath, goalPathLine, signedKg, weeksLabel } from './goalPath'

const w = (date: string, kg: number) => ({ date, kg })

describe('goalPath', () => {
  it('ohne Ziel oder ohne Messung', () => {
    expect(goalPath({ weights: [w('2026-10-01', 90)], target: null }).status).toBe('no_target')
    expect(goalPath({ weights: [], target: 80 }).status).toBe('no_data')
    expect(goalPathLine(goalPath({ weights: [], target: 80 }))).toBeNull()
  })

  it('Abnehmen: Richtung, Rest, Wochenziel und Spanne', () => {
    const p = goalPath({ weights: [w('2026-10-01', 94.6)], target: 80, goal: 'lose' })
    expect(p.status).toBe('path')
    expect(p.direction).toBe('down')
    expect(p.remaining).toBe(14.6)
    // 0,5–1 % pro Woche → grob 16–34 Wochen
    expect(p.weeksMin).toBe(16)
    expect(p.weeksMax).toBe(34)
    expect(p.weekly).toBe(-0.7)
    expect(p.milestone).toBe(93.9)
    expect(p.mismatch).toBe(false)
    expect(goalPathLine(p)).toBe('noch 14,6 kg · ca. 16–34 Wochen')
  })

  it('Zunehmen ist langsamer (0,25–0,5 %)', () => {
    const p = goalPath({ weights: [w('2026-10-01', 70)], target: 74, goal: 'gain' })
    expect(p.direction).toBe('up')
    expect(p.weekly).toBe(0.3)
    expect(p.weeksMin).toBeGreaterThanOrEqual(11)
    expect(p.weeksMax).toBeLessThanOrEqual(24)
    expect(p.weeksMin).toBeLessThan(p.weeksMax)
  })

  it('Recomp halbiert das Tempo', () => {
    const lose = goalPath({ weights: [w('2026-10-01', 90)], target: 85, goal: 'lose' })
    const recomp = goalPath({ weights: [w('2026-10-01', 90)], target: 85, goal: 'recomp' })
    expect(recomp.weeksMax).toBeGreaterThan(lose.weeksMax)
    expect(Math.abs(recomp.weekly)).toBeLessThan(Math.abs(lose.weekly))
  })

  it('Wochenziel nie größer als der Rest', () => {
    const p = goalPath({ weights: [w('2026-10-01', 81)], target: 80.3 })
    expect(p.weekly).toBe(-0.6)
    const q = goalPath({ weights: [w('2026-10-01', 81)], target: 80.4 })
    expect(q.remaining).toBe(0.6)
    const r = goalPath({ weights: [w('2026-10-01', 90)], target: 89.4 })
    expect(r.weekly).toBe(-0.6)
    expect(Math.abs(r.weekly)).toBeLessThanOrEqual(r.remaining)
    expect(q.weeksMin).toBeGreaterThanOrEqual(1)
  })

  it('Fortschritt ab der ersten Messung seit dem Ziel', () => {
    const weights = [w('2026-08-01', 100), w('2026-09-01', 96), w('2026-10-01', 90), w('2026-10-02', 90)]
    const p = goalPath({ weights, target: 80, since: '2026-09-01' })
    expect(p.start).toBe(96)
    expect(p.progress).toBeGreaterThan(0)
    expect(p.progress).toBeLessThan(1)
    const all = goalPath({ weights, target: 80 })
    expect(all.start).toBe(100)
  })

  it('Ziel erreicht – auch wenn man darüber hinaus ist', () => {
    expect(goalPath({ weights: [w('2026-10-01', 80.3)], target: 80 }).status).toBe('reached')
    const over = goalPath({ weights: [w('2026-08-01', 90), w('2026-10-01', 78), w('2026-10-30', 77.5)], target: 80 })
    expect(over.status).toBe('reached')
    expect(over.progress).toBe(1)
    expect(goalPathLine(over)).toBe('Ziel erreicht')
  })

  it('Halten: ziel ≈ aktuell → erreicht; großer Abstand → Hinweis', () => {
    expect(goalPath({ weights: [w('2026-10-01', 75)], target: 75, goal: 'maintain' }).status).toBe('reached')
    expect(goalPath({ weights: [w('2026-10-01', 85)], target: 75, goal: 'maintain' }).mismatch).toBe(true)
    expect(goalPath({ weights: [w('2026-10-01', 70)], target: 75, goal: 'lose' }).mismatch).toBe(true)
  })
})

describe('Formate', () => {
  it('signedKg', () => {
    expect(signedKg(-0.6)).toBe('−0,6 kg')
    expect(signedKg(0.3)).toBe('+0,3 kg')
  })
  it('weeksLabel', () => {
    expect(weeksLabel(20, 28)).toBe('ca. 20–28 Wochen')
    expect(weeksLabel(1, 1)).toBe('ca. 1 Woche')
    expect(weeksLabel(40, 80)).toBe('ca. 9–18 Monate')
  })
})
