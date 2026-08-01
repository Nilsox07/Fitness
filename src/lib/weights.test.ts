import { describe, expect, it } from 'vitest'
import {
  expandWithAddons,
  generateLadder,
  ladderStep,
  parseLadder,
  snapToLadder,
  subsetSums,
} from './weights'

describe('parseLadder', () => {
  it('parst Liste, sortiert & dedupliziert, Dezimal-Komma erlaubt', () => {
    expect(parseLadder('2,5 5 7,5 5')).toEqual([2.5, 5, 7.5])
  })
  it('ist leer bei null/leer', () => {
    expect(parseLadder('')).toEqual([])
    expect(parseLadder(null)).toEqual([])
  })
})

describe('snapToLadder', () => {
  it('findet das nächstgelegene Gewicht', () => {
    expect(snapToLadder(12, [4, 9, 13, 18])).toBe(13)
    expect(snapToLadder(6, [4, 9, 13, 18])).toBe(4) // 6→4 (Diff 2) statt 9 (Diff 3)
  })
})

describe('ladderStep', () => {
  it('geht eine Stufe rauf/runter', () => {
    expect(ladderStep(9, [4, 9, 13, 18], 1)).toBe(13)
    expect(ladderStep(9, [4, 9, 13, 18], -1)).toBe(4)
  })
  it('bleibt an den Enden', () => {
    expect(ladderStep(18, [4, 9, 13, 18], 1)).toBe(18)
    expect(ladderStep(4, [4, 9, 13, 18], -1)).toBe(4)
  })
})

describe('generateLadder', () => {
  it('erzeugt 4/5-im-Wechsel-Leiter', () => {
    expect(generateLadder(4, [5, 4], 27)).toEqual([4, 9, 13, 18, 22, 27])
  })
  it('erzeugt gleichmäßige 2,5er-Leiter', () => {
    expect(generateLadder(2.5, [2.5], 10)).toEqual([2.5, 5, 7.5, 10])
  })
})

describe('subsetSums', () => {
  it('liefert alle Teilmengen-Summen inkl. 0', () => {
    expect(subsetSums([2.5, 5, 7])).toEqual([0, 2.5, 5, 7, 7.5, 9.5, 12, 14.5])
  })
  it('ist nur [0] ohne Zusatzgewichte', () => {
    expect(subsetSums([])).toEqual([0])
  })
})

describe('expandWithAddons', () => {
  it('verfeinert die Basis-Leiter mit Zusatzgewichten', () => {
    expect(expandWithAddons([13, 18], [2.5, 5])).toEqual([
      13, 15.5, 18, 20.5, 23, 25.5,
    ])
  })
  it('lässt die Basis unverändert ohne Zusatzgewichte', () => {
    expect(expandWithAddons([4, 9, 13], [])).toEqual([4, 9, 13])
  })
})
