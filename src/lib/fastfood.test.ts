import { describe, expect, it } from 'vitest'
import { findChain, menuItemToEstimate, suggestCombo, type MenuItem } from './fastfood'

const item = (name: string, category: string, kcal: number, protein: number): MenuItem => ({
  name,
  category,
  amount_g: 100,
  kcal,
  protein,
  carbs: 10,
  fat: 10,
  sugar: 1,
  fiber: 1,
  sat_fat: 1,
  salt: 1,
})

const menu = [
  item('Big Burger', 'Burger', 900, 45),
  item('Chicken Burger', 'Chicken', 450, 30),
  item('Cheeseburger', 'Burger', 300, 15),
  item('Pommes klein', 'Beilagen', 230, 3),
  item('Cola Zero 0,5 l', 'Getränke', 1, 0),
  item('Sundae', 'Desserts', 300, 6),
]

describe('suggestCombo', () => {
  it('bleibt im Budget und nimmt ein Zero-Getränk dazu', () => {
    const combo = suggestCombo(menu, { kcal: 800, protein: 50 })
    const kcal = combo.reduce((s, i) => s + i.kcal, 0)
    expect(kcal).toBeLessThanOrEqual(800)
    expect(combo.some((i) => i.name === 'Cola Zero 0,5 l')).toBe(true)
    expect(combo.some((i) => i.category === 'Desserts')).toBe(false)
  })
  it('bevorzugt Eiweiß', () => {
    const combo = suggestCombo(menu, { kcal: 1000, protein: 80 })
    expect(combo.map((i) => i.name)).toContain('Big Burger')
  })
  it('liefert bei zu kleinem Budget die kleinste Option', () => {
    const combo = suggestCombo(menu, { kcal: 100, protein: 20 })
    expect(combo[0].name).toBe('Cheeseburger')
  })
})

describe('fastfood helpers', () => {
  it('rechnet Mengen hoch', () => {
    const e = menuItemToEstimate(menu[2], 2)
    expect(e.kcal).toBe(600)
    expect(e.name).toBe('2× Cheeseburger')
  })
  it('findet Ketten unabhängig von Schreibweise', () => {
    const chains = [{ id: 'mcdonalds', name: "McDonald's", items: [] }]
    expect(findChain(chains, "McDonald's")?.id).toBe('mcdonalds')
    expect(findChain(chains, 'Döner')).toBeUndefined()
  })
})
