import { describe, expect, it } from 'vitest'
import {
  SPORTS,
  activityKcal,
  activityTitle,
  coveredByWatch,
  recentActivities,
  searchSports,
  sportById,
  type ManualActivity,
} from './sports'

const act = (p: Partial<ManualActivity>): ManualActivity => ({
  id: Math.random().toString(),
  date: '2026-11-12',
  sport: 'volleyball',
  minutes: 90,
  intensity: 'moderate',
  distance_km: null,
  kcal: 0,
  note: null,
  created_at: '2026-11-12T18:00:00Z',
  ...p,
})

describe('Manuelle Aktivitäten', () => {
  it('Sportarten eindeutig, MET steigend', () => {
    expect(new Set(SPORTS.map((s) => s.id)).size).toBe(SPORTS.length)
    for (const s of SPORTS) expect(s.met[0] <= s.met[1] && s.met[1] <= s.met[2]).toBe(true)
    expect(sportById('gibtsnicht').id).toBe('other')
  })

  it('Kalorien: (MET − 1) × kg × h', () => {
    // Volleyball mittel: (4 − 1) × 80 × 1,5 = 360
    expect(activityKcal('volleyball', 'moderate', 90, 80)).toBe(360)
    // Radfahren hart 60 min, 70 kg: 9 × 70 = 630
    expect(activityKcal('bike', 'hard', 60, 70)).toBe(630)
    expect(activityKcal('yoga', 'easy', 0, 80)).toBe(0)
  })

  it('Suche über Namen und Stichwörter', () => {
    expect(searchSports('fussball').map((s) => s.id)).toEqual(['football'])
    expect(searchSports('bouldern').map((s) => s.id)).toEqual(['climb'])
    expect(searchSports('').length).toBe(SPORTS.length)
  })

  it('Titel und letzte Kombinationen', () => {
    expect(activityTitle(act({ sport: 'bike', minutes: 45, distance_km: 18.5 }))).toBe('Radfahren · 45 min · 18,5 km')
    const list = [
      act({ created_at: '2026-11-10T10:00:00Z' }),
      act({ created_at: '2026-11-12T10:00:00Z' }),
      act({ sport: 'bike', minutes: 30, created_at: '2026-11-11T10:00:00Z' }),
    ]
    expect(recentActivities(list).map((a) => a.sport)).toEqual(['volleyball', 'bike'])
  })

  it('Uhr hat die Aktivität schon → zählt nur einmal', () => {
    const w = (type: string, min: number, date = '2026-11-12') => ({
      started_at: `${date}T17:00:00Z`,
      duration_s: min * 60,
      type,
    })
    expect(coveredByWatch(act({ sport: 'bike', minutes: 60 }), [w('ride', 55)])).toBe(true)
    expect(coveredByWatch(act({ sport: 'bike', minutes: 60 }), [w('run', 60)])).toBe(false)
    expect(coveredByWatch(act({ sport: 'bike', minutes: 60 }), [w('ride', 20)])).toBe(false)
    expect(coveredByWatch(act({}), [w('other', 85)])).toBe(true)
    expect(coveredByWatch(act({}), [w('other', 85, '2026-11-11')])).toBe(false)
    expect(coveredByWatch(act({ sport: 'run', minutes: 30 }), [w('other', 30)])).toBe(false)
  })
})
