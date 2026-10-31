import { describe, expect, it } from 'vitest'
import {
  activityBests,
  agoText,
  baseline,
  cardioSummary,
  durationText,
  hrZone,
  paceText,
  readiness,
  routePath,
  sleepStats,
} from './health'
import type { HealthActivity, HealthDaily, HealthSleep } from '../types'

const act = (p: Partial<HealthActivity>): HealthActivity => ({
  id: Math.random().toString(),
  user_id: 'u',
  source_id: Math.random().toString(),
  source: null,
  type: 'run',
  title: null,
  started_at: '2026-10-28T07:00:00Z',
  duration_s: 1800,
  distance_m: 6000,
  kcal: 400,
  avg_hr: 150,
  max_hr: 170,
  elevation_m: null,
  route: null,
  ...p,
})

describe('Ausdauer', () => {
  it('Tempo je Sportart', () => {
    expect(paceText(act({ duration_s: 1800, distance_m: 6000 }))).toBe('5:00 /km')
    expect(paceText(act({ type: 'ride', duration_s: 3600, distance_m: 25000 }))).toBe('25 km/h')
    expect(paceText(act({ type: 'swim', duration_s: 1200, distance_m: 1000 }))).toBe('2:00 /100 m')
    expect(paceText(act({ distance_m: null }))).toBeNull()
    expect(durationText(2520)).toBe('42 min')
    expect(durationText(3900)).toBe('1:05 h')
  })

  it('Wochensumme und Bestleistungen', () => {
    const list = [
      act({ distance_m: 5000, duration_s: 1500 }),
      act({ distance_m: 10000, duration_s: 3300, started_at: '2026-10-26T07:00:00Z' }),
      act({ type: 'ride', distance_m: 30000, duration_s: 3600 }),
      act({ started_at: '2026-10-10T07:00:00Z' }),
    ]
    const w = cardioSummary(list, '2026-10-26', '2026-11-01')
    expect(w.count).toBe(3)
    expect(w.distance_m).toBe(45000)
    expect(w.byType[0].type).toBe('run')
    const b = activityBests(list, 'run')!
    expect(b.longest.distance_m).toBe(10000)
    expect(b.fastest!.distance_m).toBe(5000)
    expect(hrZone(150, 190)).toBe(3)
    expect(hrZone(null)).toBeNull()
  })
})

describe('Tagesform', () => {
  it('ohne Uhr-Daten keine Tagesform', () => {
    expect(readiness({ kcalBalanceYesterday: -900 })).toBeNull()
  })

  it('gut geschlafen und erholt → hoch', () => {
    const r = readiness({
      sleepMin: 500,
      hrv: 70,
      hrvBaseline: 60,
      restingHr: 50,
      restingHrBaseline: 52,
      proteinRatioYesterday: 1,
    })!
    expect(r.level).toBe('hoch')
    expect(r.score).toBeGreaterThanOrEqual(75)
  })

  it('kurzer Schlaf, Defizit und harte Einheit → niedrig, Ernährung zählt mit', () => {
    const r = readiness({
      sleepMin: 300,
      hrv: 45,
      hrvBaseline: 60,
      restingHr: 60,
      restingHrBaseline: 52,
      loadYesterday: 180,
      kcalBalanceYesterday: -1000,
      proteinRatioYesterday: 0.5,
    })!
    expect(r.level).toBe('niedrig')
    expect(r.factors.map((f) => f.key)).toContain('energy')
    expect(r.factors.map((f) => f.key)).toContain('protein')
  })

  it('Kraft, Ausdauer, Tiefschlaf und Trinken fließen getrennt ein', () => {
    const base = { sleepMin: 450, hrv: 60, hrvBaseline: 60, restingHr: 52, restingHrBaseline: 52 }
    const rested = readiness(base)!
    const tired = readiness({ ...base, strengthSets: 26, cardioLoad: 150, deepMin: 30, waterRatioYesterday: 0.4 })!
    expect(tired.score).toBeLessThan(rested.score - 15)
    expect(tired.factors.map((f) => f.key)).toEqual(expect.arrayContaining(['strength', 'load', 'deep', 'water']))
  })

  it('Basis aus den Vortagen', () => {
    const days: HealthDaily[] = [1, 2, 3, 4].map((n) => ({
      user_id: 'u',
      date: `2026-10-0${n}`,
      steps: null,
      active_kcal: null,
      resting_hr: 50 + n,
      hrv_ms: null,
      vo2max: null,
    }))
    expect(baseline(days, 'resting_hr', '2026-10-05')).toBe(52.5)
    expect(baseline(days, 'hrv_ms', '2026-10-05')).toBeNull()
  })
})

describe('Schlaf & Strecke', () => {
  it('Durchschnitt und Regelmäßigkeit', () => {
    const n = (start: string, min: number): HealthSleep => ({
      user_id: 'u',
      date: '2026-10-01',
      start_at: start,
      end_at: start,
      asleep_min: min,
      deep_min: null,
      rem_min: null,
      light_min: null,
      awake_min: null,
      source: null,
    })
    const s = sleepStats([n('2026-10-01T23:00:00', 420), n('2026-10-02T23:00:00', 480)])!
    expect(s.avgMin).toBe(450)
    expect(s.bedtimeSpreadMin).toBe(0)
    expect(sleepStats([])).toBeNull()
  })

  it('Route als SVG-Pfad', () => {
    const d = routePath(
      [
        [52.5, 13.4],
        [52.51, 13.41],
      ],
      100,
      100,
    )
    expect(d.startsWith('M')).toBe(true)
    expect(d).toContain('L')
    expect(routePath(null, 10, 10)).toBe('')
  })
})

describe('agoText', () => {
  const now = new Date('2026-10-31T12:00:00Z').getTime()
  it('formatiert den letzten Abgleich', () => {
    expect(agoText(null, now)).toBeNull()
    expect(agoText('2026-10-31T11:59:30Z', now)).toBe('gerade eben')
    expect(agoText('2026-10-31T11:48:00Z', now)).toBe('vor 12 Min.')
    expect(agoText('2026-10-31T09:00:00Z', now)).toBe('vor 3 Std.')
    expect(agoText('2026-10-30T12:00:00Z', now)).toBe('vor 1 Tag')
  })
})
