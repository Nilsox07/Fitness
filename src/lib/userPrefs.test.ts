import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, mealSplitSum, normalizePrefs } from './userPrefs'

describe('normalizePrefs', () => {
  it('leere Eingaben → Standardwerte', () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(normalizePrefs({})).toEqual(DEFAULT_PREFS)
    expect(normalizePrefs('kaputt')).toEqual(DEFAULT_PREFS)
  })
  it('begrenzt Zahlen auf gültige Bereiche', () => {
    const p = normalizePrefs({ kcalBonus: 9999, dayCutoff: -3 })
    expect(p.kcalBonus).toBe(600)
    expect(p.dayCutoff).toBe(0)
    expect(normalizePrefs({ kcalBonus: '300', dayCutoff: 5.4 })).toMatchObject({ kcalBonus: 300, dayCutoff: 5 })
  })
  it('Mahlzeiten-Aufteilung nur mit Summe 100', () => {
    const ok = { breakfast: 30, lunch: 30, dinner: 30, snack: 10 }
    expect(normalizePrefs({ mealSplit: ok }).mealSplit).toEqual(ok)
    expect(normalizePrefs({ mealSplit: { ...ok, snack: 20 } }).mealSplit).toEqual(DEFAULT_PREFS.mealSplit)
    expect(mealSplitSum(DEFAULT_PREFS.mealSplit)).toBe(100)
  })
  it('liest gültige Rhythmen und verwirft kaputte', () => {
    expect(normalizePrefs({ schedule: { type: 'weekdays', days: ['a', 5, null] } }).schedule).toEqual({
      type: 'weekdays',
      days: ['a', null, null, null, null, null, null],
    })
    expect(
      normalizePrefs({ schedule: { type: 'rotation', steps: ['a', null], anchor: { stepIndex: 7, date: '2026-10-04' } } })
        .schedule,
    ).toEqual({ type: 'rotation', steps: ['a', null], anchor: { stepIndex: 1, date: '2026-10-04' } })
    expect(normalizePrefs({ schedule: { type: 'flexible', perWeek: 9 } }).schedule).toEqual({
      type: 'flexible',
      perWeek: 7,
    })
    expect(normalizePrefs({ schedule: { type: 'unbekannt' } }).schedule).toBeNull()
  })
})
