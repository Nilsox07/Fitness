import { describe, expect, it } from 'vitest'
import { cardioSnapshot, mainKind, planLine, roundLoc } from './outdoorWidget'
import type { HealthActivity } from '../types'
import type { CardioPlan } from './onboarding'

const TODAY = '2026-11-07' // Samstag

const act = (date: string, p: Partial<HealthActivity> = {}): HealthActivity =>
  ({
    id: date,
    user_id: 'u',
    source_id: date,
    source: null,
    type: 'run',
    title: null,
    started_at: `${date}T07:00:00Z`,
    duration_s: 1800,
    distance_m: 6000,
    kcal: null,
    avg_hr: null,
    max_hr: null,
    elevation_m: null,
    route: null,
    ...p,
  }) as HealthActivity

const plan: CardioPlan = {
  kind: 'run',
  sessions: [
    { day: 2, kind: 'run', type: 'interval', minutes: 30 },
    { day: 5, kind: 'run', type: 'easy', minutes: 40 },
  ],
}

describe('Ausdauer-Widget', () => {
  it('zählt nur diese Woche (ab Montag) und verteilt km auf die Tage', () => {
    const s = cardioSnapshot({
      acts: [act('2026-11-07'), act('2026-11-04', { distance_m: 8200 }), act('2026-11-01')],
      today: TODAY,
      plan,
      cardioDone: [],
    })
    expect(s.weekKm).toBe(14.2)
    expect(s.weekCount).toBe(2)
    expect(s.weekMin).toBe(60)
    expect(s.days).toEqual([0, 0, 8.2, 0, 0, 6, 0])
    expect(s.last?.when).toBe('Heute')
    expect(s.last?.label).toBe('Laufen')
    expect(s.last?.pace).toBe('5:00 /km')
  })

  it('Plan: heute offen, erledigt oder nächste Einheit', () => {
    expect(planLine(plan, TODAY, false)).toBe('Heute: Locker laufen · 40 min')
    expect(planLine(plan, TODAY, true)).toBe('Erledigt · Mi: Intervalle laufen · 30 min')
    expect(planLine(plan, '2026-11-02', false)).toBe('Mi: Intervalle laufen · 30 min')
    expect(planLine(null, TODAY, false)).toBeNull()
  })

  it('Sportart aus Plan, sonst aus den letzten Einheiten', () => {
    expect(mainKind(plan, [])).toBe('run')
    expect(mainKind(null, [act('2026-11-01', { type: 'ride' }), act('2026-11-02', { type: 'ride' })])).toBe('bike')
    expect(mainKind(null, [])).toBe('run')
  })

  it('rundet den Ort auf ≈ 1 km', () => {
    expect(roundLoc(52.52437, 13.41053)).toEqual({ lat: 52.52, lon: 13.41 })
    expect(roundLoc(NaN, 1)).toBeNull()
    expect(roundLoc(95, 1)).toBeNull()
  })
})
