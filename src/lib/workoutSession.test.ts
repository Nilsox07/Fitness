import { describe, expect, it } from 'vitest'
import { afterSetDone, partnerOf, type Pair } from './workoutSession'

const pairs: Pair[] = [['bank', 'rudern']]

describe('afterSetDone', () => {
  it('ohne Supersatz: Pause starten, auf der Übung bleiben', () => {
    expect(afterSetDone({ exId: 'curl', setIndex: 0, pairs, doneFlags: () => [] })).toEqual({
      next: null,
      rest: true,
    })
  })

  it('Supersatz A1 erledigt, A2 offen: KEINE Pause, zu A2 wechseln', () => {
    const flags: Record<string, boolean[]> = { bank: [true, false], rudern: [false, false] }
    expect(
      afterSetDone({ exId: 'bank', setIndex: 0, pairs, doneFlags: (id) => flags[id] }),
    ).toEqual({ next: 'rudern', rest: false })
  })

  it('Supersatz Runde komplett (A2 erledigt): Pause + zurück zu A1', () => {
    const flags: Record<string, boolean[]> = { bank: [true, false], rudern: [true, false] }
    expect(
      afterSetDone({ exId: 'rudern', setIndex: 0, pairs, doneFlags: (id) => flags[id] }),
    ).toEqual({ next: 'bank', rest: true })
  })

  it('Partner hat weniger Sätze: Runde gilt als komplett', () => {
    const flags: Record<string, boolean[]> = { bank: [true, true, true], rudern: [true, true] }
    expect(
      afterSetDone({ exId: 'bank', setIndex: 2, pairs, doneFlags: (id) => flags[id] }),
    ).toEqual({ next: null, rest: true })
  })
})

describe('partnerOf', () => {
  it('findet den Partner in beide Richtungen', () => {
    expect(partnerOf(pairs, 'bank')).toBe('rudern')
    expect(partnerOf(pairs, 'rudern')).toBe('bank')
    expect(partnerOf(pairs, 'curl')).toBeNull()
  })
})
