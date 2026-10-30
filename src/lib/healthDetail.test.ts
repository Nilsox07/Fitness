import { describe, expect, it } from 'vitest'
import {
  bpCategory,
  elevationProfile,
  estimateMaxHr,
  kmSplits,
  personalNormal,
  readiness,
  sleepScore,
  trimp,
  zoneTimes,
} from './health'
import type { HealthSleep, RoutePoint } from '../types'

// 3 km geradeaus nach Norden, 5 min pro km, 10 m Anstieg pro km
const route: RoutePoint[] = Array.from({ length: 31 }, (_, i) => [52 + (i * 100) / 111195, 13, 30 + i, i * 30])
const hr: [number, number][] = Array.from({ length: 31 }, (_, i) => [i * 30, 140 + i])

describe('Aktivität im Detail', () => {
  it('Kilometer-Zeiten mit Puls und Höhe', () => {
    const s = kmSplits(route, hr)
    expect(s).toHaveLength(3)
    expect(s[0].seconds).toBeGreaterThanOrEqual(299)
    expect(s[0].seconds).toBeLessThanOrEqual(301)
    expect(s[0].elevation).toBe(10)
    expect(s[1].hr).toBeGreaterThan(s[0].hr!)
    expect(
      kmSplits(
        [
          [52, 13],
          [52.1, 13],
        ],
        null,
      ),
    ).toEqual([])
  })

  it('Höhenprofil und Pulszonen', () => {
    const e = elevationProfile(route)
    expect(e[0]).toEqual([0, 30])
    expect(e[e.length - 1][0]).toBeCloseTo(3, 1)
    const z = zoneTimes(hr, 200)
    expect(z[2]).toBeGreaterThan(0) // 140–170 bpm bei max 200 → Zone 3/4
    expect(z.reduce((a, b) => a + b, 0)).toBe(930)
  })

  it('Belastung: härter = mehr', () => {
    const easy = trimp({ duration_s: 1800, avg_hr: 120 }, 190)
    const hard = trimp({ duration_s: 1800, avg_hr: 170 }, 190)
    expect(hard).toBeGreaterThan(easy * 2)
    expect(trimp({ duration_s: 930, avg_hr: null, hr_series: hr }, 190)).toBeGreaterThan(0)
    expect(estimateMaxHr(30, [{ max_hr: 201 }])).toBe(201)
    expect(estimateMaxHr(30)).toBe(187)
  })
})

describe('Schlaf & Vitalwerte', () => {
  const night = (p: Partial<HealthSleep>): HealthSleep => ({
    user_id: 'u',
    date: '2026-10-30',
    start_at: '2026-10-29T23:00:00Z',
    end_at: '2026-10-30T07:00:00Z',
    asleep_min: 450,
    deep_min: 80,
    rem_min: 100,
    light_min: 270,
    awake_min: 30,
    source: null,
    in_bed_min: 480,
    awakenings: 2,
    latency_min: 12,
    ...p,
  })

  it('guter Schlaf → hoher Score, kurzer Schlaf → niedrig', () => {
    const good = sleepScore(night({}))
    expect(good.score).toBeGreaterThanOrEqual(80)
    expect(good.pct.deep).toBe(18)
    expect(good.efficiency).toBe(94)
    const bad = sleepScore(night({ asleep_min: 280, deep_min: 20, rem_min: 30, in_bed_min: 380, awakenings: 9 }))
    expect(bad.score).toBeLessThan(55)
    expect(bad.parts.find((p) => p.label === 'Dauer')!.status).toBe('schwach')
  })

  it('Tagesform-Faktoren in Klartext statt Punkten', () => {
    const r = readiness({ sleepMin: 480, hrv: 50, hrvBaseline: 62, restingHr: 52, restingHrBaseline: 52 })!
    const hrv = r.factors.find((f) => f.key === 'hrv')!
    expect(hrv.value).toBe('50 ms')
    expect(hrv.normal).toBe('dein Schnitt 62 ms')
    expect(hrv.status).toBe('schwach')
    expect(hrv.text).toMatch(/unter deinem Schnitt/)
  })

  it('Normalbereich und Blutdruck', () => {
    expect(personalNormal([1, 2, 3])).toBeNull()
    const n = personalNormal([50, 52, 54, 56, 58])!
    expect(n.mean).toBe(54)
    expect(bpCategory(118, 76).label).toBe('Optimal')
    expect(bpCategory(145, 80).status).toBe('schwach')
  })
})
