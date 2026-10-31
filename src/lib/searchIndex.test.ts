import { describe, expect, it } from 'vitest'
import { SEARCH_ENTRIES, searchEntries, suggestions } from './searchIndex'

const ALL = { nutrition: true, social: true, watch: true }

describe('App-Suche', () => {
  it('findet Funktionen über Alltagswörter', () => {
    expect(searchEntries('schlaf', ALL)[0].id).toBe('sleep')
    expect(searchEntries('kreatin', ALL)[0].id).toBe('supplements')
    expect(searchEntries('dunkelmodus', ALL)[0].id).toBe('appearance')
    expect(searchEntries('garmin', ALL)[0].id).toBe('watch')
    expect(searchEntries('mcdonalds', ALL)[0].id).toBe('restaurant')
    expect(searchEntries('Übung', ALL)[0].id).toBe('exercises')
  })

  it('Titel-Treffer stehen vor Stichwort-Treffern', () => {
    const r = searchEntries('rezept', ALL)
    expect(r[0].id).toBe('recipes')
  })

  it('ausgeblendete Module tauchen nicht auf', () => {
    const mods = { nutrition: false, social: false, watch: false }
    expect(searchEntries('schlaf', mods)).toEqual([])
    expect(searchEntries('kalorien', mods).some((e) => e.needs === 'nutrition')).toBe(false)
    expect(suggestions(mods).every((e) => !e.needs)).toBe(true)
  })

  it('jede ID ist eindeutig', () => {
    const ids = SEARCH_ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(searchEntries('   ', ALL)).toEqual([])
  })
})
