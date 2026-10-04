import { describe, expect, it } from 'vitest'
import {
  DUEL_POINTS,
  daysLeftInWeek,
  duelScore,
  duelStandings,
  effectiveMonthlyPrs,
  effectiveProteinDays,
  effectiveSessions,
  effectiveWeeklyVolume,
  isThisWeek,
  teamGoal,
  weekStart,
} from './duel'

// 2026-09-30 ist ein Mittwoch.
const TODAY = '2026-09-30'

const stat = (id: string, sessions: number, last: string | null, protein = 0, updated?: string) => ({
  user_id: id,
  weekly_sessions: sessions,
  last_workout: last,
  protein_week: protein,
  updated_at: updated ?? null,
})

describe('Woche', () => {
  it('beginnt am Montag', () => {
    expect(weekStart(TODAY)).toBe('2026-09-28')
    expect(weekStart('2026-09-28')).toBe('2026-09-28')
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // Sonntag
  })
  it('erkennt Daten dieser Woche', () => {
    expect(isThisWeek('2026-09-28', TODAY)).toBe(true)
    expect(isThisWeek('2026-10-04', TODAY)).toBe(true)
    expect(isThisWeek('2026-09-27', TODAY)).toBe(false)
    expect(isThisWeek(null, TODAY)).toBe(false)
  })
  it('zählt verbleibende Tage bis Sonntag', () => {
    expect(daysLeftInWeek(TODAY)).toBe(4)
    expect(daysLeftInWeek('2026-10-04')).toBe(0)
    expect(daysLeftInWeek('2026-09-28')).toBe(6)
  })
})

describe('effektive Werte', () => {
  it('ignoriert Trainingszahlen aus der Vorwoche', () => {
    expect(effectiveSessions(stat('a', 3, '2026-09-29'), TODAY)).toBe(3)
    expect(effectiveSessions(stat('a', 3, '2026-09-25'), TODAY)).toBe(0)
    expect(effectiveSessions(stat('a', 2, null), TODAY)).toBe(0)
  })
  it('ignoriert alte Protein-Werte (Gramm) und veraltete Zeilen', () => {
    expect(effectiveProteinDays(stat('a', 0, null, 3), TODAY)).toBe(3)
    expect(effectiveProteinDays(stat('a', 0, null, 140), TODAY)).toBe(0)
    expect(effectiveProteinDays(stat('a', 0, null, 3, '2026-09-29T10:00:00'), TODAY)).toBe(3)
    expect(effectiveProteinDays(stat('a', 0, null, 3, '2026-09-20T10:00:00'), TODAY)).toBe(0)
  })
})

describe('duelScore', () => {
  it('vergibt Punkte für Trainings, Wochenziel und Protein', () => {
    const s = duelScore(stat('a', 3, '2026-09-30', 2), { includeProtein: true, today: TODAY })
    expect(s.training).toBe(3 * DUEL_POINTS.training)
    expect(s.goal).toBe(DUEL_POINTS.goal)
    expect(s.protein).toBe(2 * DUEL_POINTS.protein)
    expect(s.total).toBe(30 + 10 + 10)
  })
  it('lässt Protein weg, wenn nicht aktiv', () => {
    const s = duelScore(stat('a', 1, '2026-09-30', 4), { includeProtein: false, today: TODAY })
    expect(s.protein).toBe(0)
    expect(s.goal).toBe(0)
    expect(s.total).toBe(10)
  })
})

describe('duelStandings', () => {
  it('bestimmt eine:n Führende:n mit Vorsprung', () => {
    const r = duelStandings([stat('me', 1, TODAY), stat('jens', 3, TODAY)], {
      includeProtein: false,
      today: TODAY,
    })
    expect(r.scores.map((s) => s.user_id)).toEqual(['me', 'jens'])
    expect(r.leaderId).toBe('jens')
    expect(r.lead).toBe(30)
    expect(r.sum).toBe(50)
  })
  it('hat bei Gleichstand oder 0 Punkten keine Spitze', () => {
    const opts = { includeProtein: false, today: TODAY }
    expect(duelStandings([stat('a', 2, TODAY), stat('b', 2, TODAY)], opts).leaderId).toBeNull()
    expect(duelStandings([stat('a', 0, null), stat('b', 0, null)], opts).leaderId).toBeNull()
    expect(duelStandings([], opts).leaderId).toBeNull()
  })
})

describe('teamGoal', () => {
  it('summiert Trainings gegen 3 pro Person', () => {
    const g = teamGoal([stat('a', 2, TODAY), stat('b', 3, '2026-09-29')], TODAY)
    expect(g.done).toBe(5)
    expect(g.target).toBe(6)
    expect(g.reached).toBe(false)
    expect(g.progress).toBe(83)
  })
  it('ist erreicht und bei 100 % gedeckelt', () => {
    const g = teamGoal([stat('a', 5, TODAY), stat('b', 3, TODAY)], TODAY)
    expect(g.reached).toBe(true)
    expect(g.progress).toBe(100)
  })
})

describe('veraltete Wochen-/Monatswerte', () => {
  it('Volumen nur aus dieser Woche', () => {
    const base = { user_id: 'a', weekly_sessions: 2, weekly_volume: 5000 }
    expect(effectiveWeeklyVolume({ ...base, last_workout: '2026-09-29' }, TODAY)).toBe(5000)
    expect(effectiveWeeklyVolume({ ...base, last_workout: '2026-09-25' }, TODAY)).toBe(0)
  })
  it('Rekorde nur aus diesem Monat', () => {
    const base = { user_id: 'a', weekly_sessions: 0, monthly_prs: 3 }
    expect(effectiveMonthlyPrs({ ...base, last_workout: '2026-09-02' }, TODAY)).toBe(3)
    expect(effectiveMonthlyPrs({ ...base, last_workout: '2026-08-31' }, TODAY)).toBe(0)
    expect(
      effectiveMonthlyPrs({ ...base, last_workout: '2026-09-02', updated_at: '2026-08-20T10:00:00' }, TODAY),
    ).toBe(0)
  })
})
