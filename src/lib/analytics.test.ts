import { describe, expect, it } from 'vitest'
import type { SetType, SetWithDate } from '../types'
import {
  estimate1RM,
  frequencyStats,
  isoWeekKey,
  onlyWorking,
  personalRecords,
  progressionSuggestion,
  summarizeSessions,
  totalVolume,
  weeklyVolume,
} from './analytics'

let counter = 0
function mkSet(
  date: string,
  reps: number,
  weight: number,
  set_number = 1,
  set_type: SetType = 'working',
): SetWithDate {
  counter += 1
  return {
    id: `s${counter}`,
    user_id: 'u1',
    workout_id: `w-${date}`,
    exercise_id: 'e1',
    set_number,
    reps,
    weight,
    set_type,
    created_at: `${date}T10:00:00Z`,
    date,
  }
}

describe('estimate1RM (Epley)', () => {
  it('gibt das Gewicht bei 1 Wdh zurück', () => {
    expect(estimate1RM(100, 1)).toBe(100)
  })
  it('berechnet 1RM nach Epley für mehrere Wdh', () => {
    // 100 * (1 + 10/30) = 133.33
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1)
  })
  it('ist 0 bei 0 Wdh oder 0 Gewicht', () => {
    expect(estimate1RM(100, 0)).toBe(0)
    expect(estimate1RM(0, 5)).toBe(0)
  })
})

describe('Volumen', () => {
  it('summiert Wdh × Gewicht', () => {
    expect(totalVolume([{ reps: 10, weight: 50 }, { reps: 8, weight: 60 }])).toBe(980)
  })
})

describe('summarizeSessions', () => {
  it('gruppiert nach Datum, sortiert aufsteigend, ermittelt Top-Werte', () => {
    const sets = [
      mkSet('2026-01-10', 10, 50, 1),
      mkSet('2026-01-10', 8, 55, 2),
      mkSet('2026-01-03', 12, 40, 1),
    ]
    const sessions = summarizeSessions(sets)
    expect(sessions.map((s) => s.date)).toEqual(['2026-01-03', '2026-01-10'])
    const last = sessions[1]
    expect(last.topWeight).toBe(55)
    expect(last.volume).toBe(10 * 50 + 8 * 55)
  })
})

describe('personalRecords', () => {
  it('findet Max-Gewicht, Max-Wdh und bestes 1RM', () => {
    const sets = [mkSet('2026-01-01', 5, 100), mkSet('2026-01-08', 12, 80)]
    const pr = personalRecords(sets)
    expect(pr.maxWeight).toBe(100)
    expect(pr.maxReps).toBe(12)
    // 80 * (1 + 12/30) = 112 vs 100 * (1 + 5/30) = 116.67 -> 116.7
    expect(pr.maxEstimated1RM).toBeCloseTo(116.7, 1)
  })
})

describe('weeklyVolume & isoWeekKey', () => {
  it('aggregiert Volumen pro ISO-Woche', () => {
    const sets = [mkSet('2026-01-05', 10, 50), mkSet('2026-01-06', 10, 50)]
    const wv = weeklyVolume(sets)
    expect(wv).toHaveLength(1)
    expect(wv[0].volume).toBe(1000)
    expect(wv[0].week).toBe(isoWeekKey('2026-01-05'))
  })
})

describe('frequencyStats', () => {
  it('zählt Sessions und aktuelle Wochen-Streak', () => {
    const today = new Date('2026-01-15T12:00:00Z')
    const dates = ['2026-01-14', '2026-01-07', '2025-12-31']
    const stats = frequencyStats(dates, today)
    expect(stats.totalSessions).toBe(3)
    expect(stats.weekStreak).toBe(3)
  })
  it('ist leer ohne Daten', () => {
    expect(frequencyStats([]).totalSessions).toBe(0)
  })
})

describe('Satz-Typen', () => {
  it('onlyWorking filtert Aufwärm- und Dropsätze heraus', () => {
    const sets = [
      mkSet('2026-01-10', 10, 40, 1, 'warmup'),
      mkSet('2026-01-10', 5, 80, 2, 'working'),
      mkSet('2026-01-10', 12, 55, 3, 'drop'),
    ]
    expect(onlyWorking(sets)).toHaveLength(1)
    expect(onlyWorking(sets)[0].weight).toBe(80)
  })

  it('PRs ignorieren Aufwärm-/Dropsätze (nur Arbeitssatz zählt)', () => {
    const sets = [
      mkSet('2026-01-10', 10, 40, 1, 'warmup'),
      mkSet('2026-01-10', 5, 80, 2, 'working'),
      mkSet('2026-01-10', 20, 60, 3, 'drop'),
    ]
    const pr = personalRecords(sets)
    expect(pr.maxWeight).toBe(80) // nicht das leichtere Aufwärm-/Dropgewicht
    expect(pr.maxReps).toBe(5) // nicht die 20 Drop-Wdh
  })

  it('progressionSuggestion bewertet nur den Arbeitssatz', () => {
    const ex = { target_rep_min: 8, target_rep_max: 12, increment: 2.5 }
    const sets = [
      mkSet('2026-01-10', 12, 30, 1, 'warmup'), // leicht, 12 Wdh
      mkSet('2026-01-10', 9, 60, 2, 'working'), // echter Arbeitssatz, im Bereich
      mkSet('2026-01-10', 15, 45, 3, 'drop'),
    ]
    const s = progressionSuggestion(ex, sets)
    expect(s.action).toBe('hold')
    expect(s.suggestedWeight).toBe(60)
  })
})

describe('progressionSuggestion (Double Progression)', () => {
  const ex = { target_rep_min: 8, target_rep_max: 12, increment: 2.5 }

  it('empfiehlt Steigerung, wenn alle Sätze das obere Ziel erreichen', () => {
    const sets = [
      mkSet('2026-01-10', 12, 50, 1),
      mkSet('2026-01-10', 12, 50, 2),
      mkSet('2026-01-10', 12, 50, 3),
    ]
    const s = progressionSuggestion(ex, sets)
    expect(s.action).toBe('increase')
    expect(s.suggestedWeight).toBe(52.5)
  })

  it('empfiehlt Halten innerhalb des Bereichs', () => {
    const sets = [mkSet('2026-01-10', 10, 50, 1), mkSet('2026-01-10', 9, 50, 2)]
    const s = progressionSuggestion(ex, sets)
    expect(s.action).toBe('hold')
    expect(s.suggestedWeight).toBe(50)
  })

  it('empfiehlt Deload bei Stagnation über 3 Sessions', () => {
    const sets = [
      mkSet('2026-01-01', 9, 50, 1),
      mkSet('2026-01-08', 9, 50, 1),
      mkSet('2026-01-15', 9, 50, 1),
    ]
    const s = progressionSuggestion(ex, sets)
    expect(s.action).toBe('deload')
    expect(s.suggestedWeight).toBe(45)
  })

  it('gibt Start-Hinweis ohne Daten', () => {
    expect(progressionSuggestion(ex, []).action).toBe('start')
  })
})
