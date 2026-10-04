import { describe, expect, it } from 'vitest'
import {
  afterSetDone,
  matchingSet,
  partnerOf,
  restSecondsAfter,
  typeOccurrence,
  type Pair,
} from './workoutSession'

const pairs: Pair[] = [['bank', 'rudern']]

type Flags = Record<string, { set_type: string; done: boolean }[]>
const w = (done: boolean) => ({ set_type: 'working', done })
const wu = (done: boolean) => ({ set_type: 'warmup', done })
const dr = (done: boolean) => ({ set_type: 'drop', done })

describe('afterSetDone', () => {
  it('ohne Supersatz: Pause starten, auf der Übung bleiben', () => {
    expect(
      afterSetDone({ exId: 'curl', setType: 'working', occurrence: 0, pairs, setsOf: () => [] }),
    ).toEqual({ next: null, rest: true })
  })

  it('Supersatz A1 erledigt, A2 offen: KEINE Pause, zu A2 wechseln', () => {
    const flags: Flags = { bank: [w(true), w(false)], rudern: [w(false), w(false)] }
    expect(
      afterSetDone({ exId: 'bank', setType: 'working', occurrence: 0, pairs, setsOf: (id) => flags[id] }),
    ).toEqual({ next: 'rudern', rest: false })
  })

  it('Supersatz Runde komplett (A2 erledigt): Pause + zurück zu A1', () => {
    const flags: Flags = { bank: [w(true), w(false)], rudern: [w(true), w(false)] }
    expect(
      afterSetDone({ exId: 'rudern', setType: 'working', occurrence: 0, pairs, setsOf: (id) => flags[id] }),
    ).toEqual({ next: 'bank', rest: true })
  })

  it('Partner hat weniger Sätze: Runde gilt als komplett', () => {
    const flags: Flags = { bank: [w(true), w(true), w(true)], rudern: [w(true), w(true)] }
    expect(
      afterSetDone({ exId: 'bank', setType: 'working', occurrence: 2, pairs, setsOf: (id) => flags[id] }),
    ).toEqual({ next: null, rest: true })
  })

  it('ordnet nach Satz-Typ zu, nicht nach Index (nur A1 hat einen Aufwärmsatz)', () => {
    // bank: W, 1, 2, D — rudern: 1, 2, D
    const flags: Flags = {
      bank: [wu(true), w(true), w(false), dr(false)],
      rudern: [w(false), w(false), dr(false)],
    }
    // Aufwärmsatz von A1: Partner hat keinen → bleiben, Pause
    expect(
      afterSetDone({ exId: 'bank', setType: 'warmup', occurrence: 0, pairs, setsOf: (id) => flags[id] }),
    ).toEqual({ next: null, rest: true })
    // 1. Arbeitssatz von A1 → 1. Arbeitssatz von A2 (Index 0, nicht 1)
    expect(
      afterSetDone({ exId: 'bank', setType: 'working', occurrence: 0, pairs, setsOf: (id) => flags[id] }),
    ).toEqual({ next: 'rudern', rest: false })
  })

  it('Dropsatz trifft Dropsatz', () => {
    const flags: Flags = { bank: [w(true), dr(true)], rudern: [w(true), w(false), dr(false)] }
    expect(
      afterSetDone({ exId: 'bank', setType: 'drop', occurrence: 0, pairs, setsOf: (id) => flags[id] }),
    ).toEqual({ next: 'rudern', rest: false })
  })
})

describe('typeOccurrence / matchingSet', () => {
  it('zählt die Position innerhalb des Satz-Typs', () => {
    const list = [wu(true), w(true), w(false), dr(false)]
    expect(typeOccurrence(list, 0)).toBe(0)
    expect(typeOccurrence(list, 2)).toBe(1)
    expect(typeOccurrence(list, 3)).toBe(0)
    expect(matchingSet(list, 'working', 1)).toBe(list[2])
    expect(matchingSet(list, 'warmup', 1)).toBeUndefined()
  })
})

describe('partnerOf', () => {
  it('findet den Partner in beide Richtungen', () => {
    expect(partnerOf(pairs, 'bank')).toBe('rudern')
    expect(partnerOf(pairs, 'rudern')).toBe('bank')
    expect(partnerOf(pairs, 'curl')).toBeNull()
  })
})

describe('restSecondsAfter', () => {
  it('keine Pause vor einem Dropsatz', () => {
    expect(restSecondsAfter('working', 'drop', 180)).toBe(0)
    expect(restSecondsAfter('drop', 'drop', 180)).toBe(0)
  })
  it('kurze Pause nach dem Aufwärmen', () => {
    expect(restSecondsAfter('warmup', 'warmup', 180)).toBe(45)
    expect(restSecondsAfter('warmup', 'working', 180)).toBe(90)
    expect(restSecondsAfter('warmup', 'working', 60)).toBe(60)
  })
  it('sonst die eingestellte Pause', () => {
    expect(restSecondsAfter('working', 'working', 180)).toBe(180)
    expect(restSecondsAfter('working', null, 120)).toBe(120)
    expect(restSecondsAfter('drop', null, 120)).toBe(120)
  })
})
