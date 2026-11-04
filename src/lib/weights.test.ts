import { describe, expect, it } from 'vitest'
import {
  addLadderStep,
  editLadderStep,
  expandWithAddons,
  ladderText,
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

describe('Stufen korrigieren', () => {
  const L = [5, 10, 15, 20, 25]
  it('einzelne Stufe ändern ohne Rest', () => {
    expect(editLadderStep(L, 2, 14, false)).toEqual([5, 10, 14, 20, 25])
  })
  it('unregelmäßiger Sprung: folgende Stufen verschieben sich mit', () => {
    expect(editLadderStep(L, 2, 17.5, true)).toEqual([5, 10, 17.5, 22.5, 27.5])
  })
  it('bleibt sortiert, Doppelte und 0 fallen weg', () => {
    expect(editLadderStep(L, 1, 20, false)).toEqual([5, 15, 20, 25])
    expect(editLadderStep(L, 0, 0, false)).toEqual([10, 15, 20, 25])
  })
  it('Stufe ergänzen und als Text', () => {
    expect(addLadderStep(L, 12.5)).toEqual([5, 10, 12.5, 15, 20, 25])
    expect(ladderText([4.5, 9.1])).toBe('4.5 9.1')
    expect(ladderText([])).toBeNull()
  })
})
