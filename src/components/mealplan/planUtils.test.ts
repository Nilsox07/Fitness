import { describe, expect, it } from 'vitest'
import { categoryKind, dayShort, initialDay, itemKeys, planAverages, shoppingText, weekdayOf } from './planUtils'
import type { PlanDay } from '../../types'

const meal = (kcal: number, protein: number) => ({ meal: 'lunch' as const, name: 'x', kcal, protein, carbs: 0, fat: 0 })

describe('mealplan utils', () => {
  it('erkennt Wochentage im Label', () => {
    expect(weekdayOf('Montag')).toBe(1)
    expect(weekdayOf('Tag 3 – Mittwoch')).toBe(3)
    expect(weekdayOf('So')).toBe(0)
    expect(weekdayOf('Tag 1')).toBe(-1)
    expect(dayShort('Freitag')).toBe('Fr')
    expect(dayShort('Tag 2')).toBe('Tag')
  })

  it('wählt den heutigen Wochentag vor', () => {
    const days: PlanDay[] = [{ label: 'Montag', meals: [] }, { label: 'Dienstag', meals: [] }]
    expect(initialDay(days, new Date('2026-10-06T12:00:00'))).toBe(1) // Dienstag
    expect(initialDay([{ label: 'Tag 1', meals: [] }], new Date('2026-10-06T12:00:00'))).toBe(0)
  })

  it('berechnet Durchschnittswerte', () => {
    const days: PlanDay[] = [
      { label: 'A', meals: [meal(1000, 50), meal(1000, 50)] },
      { label: 'B', meals: [meal(1500, 100)] },
    ]
    expect(planAverages(days)).toEqual({ kcal: 1750, protein: 100 })
    expect(planAverages([])).toEqual({ kcal: 0, protein: 0 })
  })

  it('ordnet Kategorien Icons zu', () => {
    expect(categoryKind('Obst & Gemüse')).toBe('fruit')
    expect(categoryKind('Gemüse')).toBe('veg')
    expect(categoryKind('Milchprodukte & Eier')).toBe('dairy')
    expect(categoryKind('Eier')).toBe('egg')
    expect(categoryKind('Fleisch & Fisch')).toBe('meat')
    expect(categoryKind('Fisch & Meeresfrüchte')).toBe('fish')
    expect(categoryKind('Vorrat')).toBe('other')
  })

  it('teilt nur offene Artikel', () => {
    const shopping = [{ category: 'Obst', items: ['Apfel', 'Banane', 'Apfel'] }]
    const keys = itemKeys(shopping[0].items)
    expect(keys).toEqual(['Apfel#0', 'Banane#0', 'Apfel#1'])
    const text = shoppingText(shopping, new Set([`Obst|${keys[0]}`]))
    expect(text).toBe('Einkaufsliste\n\nObst\n• Banane\n• Apfel')
    // alles erledigt → komplette Liste
    const all = new Set(keys.map((k) => `Obst|${k}`))
    expect(shoppingText(shopping, all)).toContain('• Banane')
  })
})
