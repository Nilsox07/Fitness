import { describe, expect, it } from 'vitest'
import { addExtraItem, clearDoneExtras, removeExtraItem, toggleExtraItem } from './shoppingExtras'

describe('Einkaufsliste „Fehlt mir“', () => {
  it('fügt hinzu, ohne Doppelte', () => {
    let l = addExtraItem([], '  200 g   Feta ', 'a')
    expect(l).toEqual([{ id: 'a', text: '200 g Feta', done: false }])
    l = addExtraItem(l, '200 g feta', 'b')
    expect(l).toHaveLength(1)
    expect(addExtraItem(l, '   ', 'c')).toHaveLength(1)
  })

  it('abgehakt + erneut hinzugefügt → wieder offen', () => {
    let l = addExtraItem([], 'Zitrone', 'a')
    l = toggleExtraItem(l, 'a')
    expect(l[0].done).toBe(true)
    l = addExtraItem(l, 'zitrone', 'b')
    expect(l).toEqual([{ id: 'a', text: 'Zitrone', done: false }])
  })

  it('entfernen und Erledigte aufräumen', () => {
    let l = addExtraItem(addExtraItem([], 'A', 'a'), 'B', 'b')
    l = toggleExtraItem(l, 'a')
    expect(clearDoneExtras(l).map((x) => x.id)).toEqual(['b'])
    expect(removeExtraItem(l, 'b').map((x) => x.id)).toEqual(['a'])
  })
})
