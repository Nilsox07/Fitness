import { describe, expect, it } from 'vitest'
import type { Person } from '../social/format'
import {
  activityWorld,
  communitySubtitle,
  detailStats,
  matchesFilter,
  parsePr,
  proteinStandings,
  shortName,
} from './communityUtils'

// 2026-09-30 ist ein Mittwoch.
const TODAY = '2026-09-30'

const person = (p: Partial<Person> & { user_id: string }): Person => ({
  display_name: null,
  total_sessions: 0,
  week_streak: 0,
  tonnage: 0,
  weekly_volume: 0,
  last_workout: null,
  rank_title: null,
  level: 1,
  xp: 0,
  weekly_sessions: 0,
  gym_status: null,
  season_id: null,
  season_xp: 0,
  monthly_prs: 0,
  protein_today: 0,
  kcal_today: 0,
  protein_week: 0,
  updated_at: `${TODAY}T12:00:00`,
  ...p,
})

describe('activityWorld', () => {
  it('ordnet Training und Ernährung zu', () => {
    expect(activityWorld('workout')).toBe('fitness')
    expect(activityWorld('pr')).toBe('fitness')
    expect(activityWorld('level')).toBe('fitness')
    expect(activityWorld('streak')).toBe('fitness')
    expect(activityWorld('cheat')).toBe('food')
    expect(activityWorld('recipe_share')).toBe('food')
    expect(activityWorld('nutrition_level')).toBe('food')
  })
  it('filtert', () => {
    expect(matchesFilter('cheat', 'all')).toBe(true)
    expect(matchesFilter('cheat', 'fitness')).toBe(false)
    expect(matchesFilter('pr', 'fitness')).toBe(true)
  })
})

describe('parsePr', () => {
  it('zerlegt Rekord-Posts', () => {
    expect(parsePr('🏆 Neuer Rekord: Bankdrücken', '~102 kg geschätztes 1RM')).toEqual({
      exercise: 'Bankdrücken',
      value: '~102 kg',
      unit: '1RM',
    })
    expect(parsePr('Training abgeschlossen', null)).toBeNull()
    expect(parsePr('🏆 Neuer Rekord: Kniebeuge', null)).toEqual({ exercise: 'Kniebeuge', value: null, unit: null })
  })
  it('Kennzahlen aus dem Detail', () => {
    expect(detailStats('12 Sätze · 5 Übungen · 3400 kg')).toEqual(['12 Sätze', '5 Übungen', '3400 kg'])
    expect(detailStats('900 kcal · Lecker!')).toEqual([])
    expect(detailStats(null)).toEqual([])
  })
})

describe('Namen & Untertitel', () => {
  it('kürzt Namen', () => {
    expect(shortName('jens.haake')).toBe('Jens')
    expect(shortName('  ')).toBe('Freund')
  })
  it('Fitness: trainiert / Gym-Plan', () => {
    const a = person({ user_id: 'a', display_name: 'Jens', gym_status: `${TODAY}|Heute Abend` })
    const b = person({ user_id: 'b', display_name: 'Mia' })
    expect(communitySubtitle([a, b], 'fitness', TODAY)).toBe('2 Freunde · Jens ist heute im Gym')
    expect(communitySubtitle([b, { ...a, last_workout: TODAY }], 'fitness', TODAY)).toBe(
      '2 Freunde · Jens hat heute trainiert',
    )
    expect(communitySubtitle([b], 'fitness', TODAY)).toBe('1 Freund')
    expect(communitySubtitle([], 'fitness', TODAY)).toBe('Gemeinsam bleibt man dran')
  })
  it('Ernährung: Eiweiß heute, veraltete Zahlen zählen nicht', () => {
    const a = person({ user_id: 'a', display_name: 'Jens', protein_today: 120 })
    expect(communitySubtitle([a], 'food', TODAY)).toBe('1 Freund · Jens hat heute 120 g Eiweiß')
    const stale = { ...a, updated_at: '2026-09-29T12:00:00' }
    expect(communitySubtitle([stale], 'food', TODAY)).toBe('1 Freund')
  })
})

describe('proteinStandings', () => {
  it('sortiert nach Tagen, dann Eiweiß heute', () => {
    const a = person({ user_id: 'a', protein_week: 3, protein_today: 80 })
    const b = person({ user_id: 'b', protein_week: 3, protein_today: 150, updated_at: '2026-09-28T12:00:00' })
    const r = proteinStandings({ user_id: 'me', days: 2, today: 90 }, [a, b], TODAY)
    // b: Zeile von Montag → Tage zählen, Eiweiß heute nicht
    expect(r.rows.map((x) => x.user_id)).toEqual(['a', 'b', 'me'])
    expect(r.leaderId).toBe('a')
    expect(r.maxToday).toBe(90)
    expect(r.totalDays).toBe(8)
  })
  it('kein:e Führende:r bei Gleichstand oder 0', () => {
    const a = person({ user_id: 'a' })
    expect(proteinStandings({ user_id: 'me', days: 0, today: 0 }, [a], TODAY).leaderId).toBeNull()
    const b = person({ user_id: 'b', protein_week: 2, protein_today: 50 })
    expect(proteinStandings({ user_id: 'me', days: 2, today: 50 }, [b], TODAY).leaderId).toBeNull()
  })
})
