import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, mealSplitSum, modulesSyncAction, normalizePrefs } from './userPrefs'

describe('Cheat-Teilen, Module, gesehene Version', () => {
  it('Cheat-Meal teilen ist standardmäßig aus', () => {
    expect(normalizePrefs({}).shareCheat).toBe(false)
    expect(normalizePrefs({ shareCheat: 'ja' }).shareCheat).toBe(false)
    expect(normalizePrefs({ shareCheat: true }).shareCheat).toBe(true)
  })
  it('Module nur vollständig übernehmen', () => {
    expect(normalizePrefs({ modules: { nutrition: false, social: true, watch: false } }).modules).toEqual({
      nutrition: false,
      social: true,
      watch: false,
      cycle: false,
    })
    expect(
      normalizePrefs({ modules: { nutrition: true, social: true, watch: true, cycle: true } }).modules?.cycle,
    ).toBe(true)
    expect(normalizePrefs({ modules: { nutrition: false } }).modules).toBeNull()
    expect(normalizePrefs({ seenVersion: '2.0' }).seenVersion).toBe('2.0')
    expect(normalizePrefs({ seenVersion: 2 }).seenVersion).toBeNull()
  })
  it('Module abgleichen: neues Gerät übernimmt, sonst schreibt das Gerät', () => {
    const on = { nutrition: true, social: true, watch: false }
    const off = { nutrition: false, social: true, watch: false }
    expect(modulesSyncAction(on, null, false)).toBe('push')
    expect(modulesSyncAction(on, on, false)).toBe('none')
    expect(modulesSyncAction(on, off, false)).toBe('adopt')
    expect(modulesSyncAction(on, off, true)).toBe('push')
  })
})

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
      normalizePrefs({
        schedule: { type: 'rotation', steps: ['a', null], anchor: { stepIndex: 7, date: '2026-10-04' } },
      }).schedule,
    ).toEqual({ type: 'rotation', steps: ['a', null], anchor: { stepIndex: 1, date: '2026-10-04' } })
    expect(normalizePrefs({ schedule: { type: 'flexible', perWeek: 9 } }).schedule).toEqual({
      type: 'flexible',
      perWeek: 7,
    })
    expect(normalizePrefs({ schedule: { type: 'unbekannt' } }).schedule).toBeNull()
  })
})

describe('Zucker/Salz anheften', () => {
  it('standardmäßig aus, nur echtes true schaltet ein', () => {
    expect(normalizePrefs({})).toMatchObject({ showSugar: false, showSalt: false })
    expect(normalizePrefs({ showSugar: 'ja', showSalt: 1 })).toMatchObject({ showSugar: false, showSalt: false })
    expect(normalizePrefs({ showSugar: true, showSalt: true })).toMatchObject({ showSugar: true, showSalt: true })
  })
})
