import { describe, expect, it } from 'vitest'
import { bedtimePlan, sleepEfficiency, sleepNeed, strainLevel, typicalWake } from './sleepNeed'
import { shiftDate } from './day'

const TODAY = '2026-11-07'

const loads = (today: number) => {
  const m = new Map<string, number>()
  for (let i = 1; i <= 20; i += 2) m.set(shiftDate(TODAY, -i), 50)
  if (today) m.set(TODAY, today)
  return m
}

describe('strainLevel', () => {
  it('vergleicht mit deinen üblichen Trainingstagen', () => {
    expect(strainLevel(loads(0), TODAY)).toBe('rest')
    expect(strainLevel(loads(20), TODAY)).toBe('light')
    expect(strainLevel(loads(50), TODAY)).toBe('normal')
    expect(strainLevel(loads(80), TODAY)).toBe('hard')
    expect(strainLevel(loads(120), TODAY)).toBe('very')
  })
  it('ohne Verlauf zählt Training als normal', () => {
    expect(strainLevel(new Map([[TODAY, 10]]), TODAY)).toBe('normal')
  })
})

describe('sleepNeed', () => {
  it('Grundbedarf + Belastung + ¼ Schlafschuld (max. 60 min)', () => {
    const sleep = Array.from({ length: 7 }, (_, i) => ({ date: shiftDate(TODAY, -i), asleep_min: 420 }))
    const n = sleepNeed({ baseMin: 480, today: TODAY, load: loads(80), sleep })
    expect(n.strain).toBe('hard')
    expect(n.strainMin).toBe(30)
    expect(n.debtMin).toBe(420)
    expect(n.paybackMin).toBe(60)
    expect(n.needMin).toBe(570)
  })
  it('ohne Schuld und ohne Training = Grundbedarf', () => {
    const sleep = Array.from({ length: 7 }, (_, i) => ({ date: shiftDate(TODAY, -i), asleep_min: 500 }))
    const n = sleepNeed({ baseMin: 450, today: TODAY, load: new Map(), sleep })
    expect(n.needMin).toBe(450)
    expect(n.paybackMin).toBe(0)
  })
})

describe('Zubettgehzeit', () => {
  it('rechnet von der Aufstehzeit zurück', () => {
    expect(bedtimePlan(480, '6:30', 0.9)).toEqual({ bedAt: '21:35', inBedMin: 535 })
    expect(bedtimePlan(420, '7:00', 1)).toEqual({ bedAt: '0:00', inBedMin: 420 })
  })
  it('übliche Aufstehzeit als Median', () => {
    const at = (d: string, hhmm: string) => ({ date: d, end_at: new Date(`${d}T${hhmm}:00`).toISOString() })
    const s = [
      at('2026-11-03', '06:30'),
      at('2026-11-04', '06:40'),
      at('2026-11-05', '06:35'),
      at('2026-11-06', '09:00'),
    ]
    expect(typicalWake(s, TODAY)).toBe('6:40')
    expect(typicalWake(s.slice(0, 2), TODAY)).toBeNull()
  })
  it('Schlafeffizienz mit Grenzen', () => {
    expect(sleepEfficiency([], TODAY)).toBe(0.9)
    const s = [1, 2, 3].map((i) => ({ date: shiftDate(TODAY, -i), asleep_min: 400, in_bed_min: 440 }))
    expect(sleepEfficiency(s, TODAY)).toBeCloseTo(0.909, 2)
  })
})
