import { describe, expect, it } from 'vitest'
import {
  foodTotalsByDate,
  kcalStatus,
  loggedSummary,
  macroSplit,
  monthGrid,
  proteinDots,
  proteinStreak,
  shiftMonth,
  weightChangeFitsGoal,
} from './foodProgress'

const e = (date: string, kcal: number, protein = 0, carbs = 0, fat = 0) => ({ date, kcal, protein, carbs, fat })

describe('foodTotalsByDate', () => {
  it('summiert je Tag inkl. Anzahl', () => {
    const m = foodTotalsByDate([e('2026-10-01', 500, 30, 50, 10), e('2026-10-01', 300, 10), e('2026-10-02', 100)])
    expect(m.get('2026-10-01')).toEqual({ kcal: 800, protein: 40, carbs: 50, fat: 10, count: 2 })
    expect(m.get('2026-10-02')?.count).toBe(1)
  })
})

describe('kcalStatus', () => {
  it('bewertet relativ zum Ziel', () => {
    expect(kcalStatus(0, 2000)).toBe('empty')
    expect(kcalStatus(2100, 2000)).toBe('ok')
    expect(kcalStatus(1800, 2000)).toBe('ok')
    expect(kcalStatus(2300, 2000)).toBe('over')
    expect(kcalStatus(1000, 2000)).toBe('under')
    expect(kcalStatus(1000, 0)).toBe('logged')
    expect(kcalStatus(0, 2000, true)).toBe('under')
  })
})

describe('monthGrid', () => {
  it('beginnt am Montag und füllt auf volle Wochen', () => {
    // 1. Okt. 2026 ist ein Donnerstag
    const g = monthGrid(2026, 10)
    expect(g[0].slice(0, 3)).toEqual([null, null, null])
    expect(g[0][3]).toBe('2026-10-01')
    expect(g.every((w) => w.length === 7)).toBe(true)
    expect(g.flat().filter(Boolean)).toHaveLength(31)
  })
})

describe('shiftMonth', () => {
  it('springt über Jahresgrenzen', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
  })
})

describe('loggedSummary', () => {
  it('zählt geloggte Tage, Ø ohne heute', () => {
    const m = foodTotalsByDate([e('2026-10-04', 500), e('2026-10-03', 2000), e('2026-10-01', 2200), e('2026-08-01', 9999)])
    expect(loggedSummary(m, '2026-10-04', 30)).toEqual({ logged: 3, days: 30, avgKcal: 2100 })
  })
})

describe('macroSplit', () => {
  it('rechnet kcal-Anteile mit Summe 100', () => {
    const s = macroSplit(100, 200, 50) // 400 / 800 / 450
    expect(s.protein + s.carbs + s.fat).toBe(100)
    expect(s.carbs).toBe(48)
    expect(macroSplit(0, 0, 0)).toEqual({ protein: 0, carbs: 0, fat: 0 })
  })
})

describe('proteinDots / proteinStreak', () => {
  const m = foodTotalsByDate([e('2026-10-04', 1, 50), e('2026-10-03', 1, 150), e('2026-10-02', 1, 160)])
  it('liefert n Tage, heute zuletzt', () => {
    const d = proteinDots(m, '2026-10-04', 140, 14)
    expect(d).toHaveLength(14)
    expect(d[13]).toEqual({ date: '2026-10-04', state: 'miss' })
    expect(d[12].state).toBe('hit')
    expect(d[0].state).toBe('empty')
  })
  it('Serie zählt ab gestern, wenn heute offen', () => {
    expect(proteinStreak(m, '2026-10-04', 140)).toBe(2)
    expect(proteinStreak(m, '2026-10-04', 0)).toBe(0)
  })
})

describe('weightChangeFitsGoal', () => {
  it('passt zum Ziel', () => {
    expect(weightChangeFitsGoal(-0.6, 'lose')).toBe(true)
    expect(weightChangeFitsGoal(0.6, 'lose')).toBe(false)
    expect(weightChangeFitsGoal(0.4, 'gain')).toBe(true)
    expect(weightChangeFitsGoal(0.3, 'maintain')).toBe(true)
    expect(weightChangeFitsGoal(-1, 'maintain')).toBe(false)
  })
})
