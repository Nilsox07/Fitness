import { describe, expect, it } from 'vitest'
import {
  dropIndex,
  placeForType,
  renumberedSets,
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
    expect(afterSetDone({ exId: 'curl', setType: 'working', occurrence: 0, pairs, setsOf: () => [] })).toEqual({
      next: null,
      rest: true,
    })
  })

  it('Supersatz A1 erledigt, A2 offen: KEINE Pause, zu A2 wechseln', () => {
    const flags: Flags = { bank: [w(true), w(false)], rudern: [w(false), w(false)] }
    expect(afterSetDone({ exId: 'bank', setType: 'working', occurrence: 0, pairs, setsOf: (id) => flags[id] })).toEqual(
      { next: 'rudern', rest: false },
    )
  })

  it('Supersatz Runde komplett (A2 erledigt): Pause + zurück zu A1', () => {
    const flags: Flags = { bank: [w(true), w(false)], rudern: [w(true), w(false)] }
    expect(
      afterSetDone({ exId: 'rudern', setType: 'working', occurrence: 0, pairs, setsOf: (id) => flags[id] }),
    ).toEqual({ next: 'bank', rest: true })
  })

  it('Partner hat weniger Sätze: Runde gilt als komplett', () => {
    const flags: Flags = { bank: [w(true), w(true), w(true)], rudern: [w(true), w(true)] }
    expect(afterSetDone({ exId: 'bank', setType: 'working', occurrence: 2, pairs, setsOf: (id) => flags[id] })).toEqual(
      { next: null, rest: true },
    )
  })

  it('ordnet nach Satz-Typ zu, nicht nach Index (nur A1 hat einen Aufwärmsatz)', () => {
    // bank: W, 1, 2, D — rudern: 1, 2, D
    const flags: Flags = {
      bank: [wu(true), w(true), w(false), dr(false)],
      rudern: [w(false), w(false), dr(false)],
    }
    // Aufwärmsatz von A1: Partner hat keinen → bleiben, Pause
    expect(afterSetDone({ exId: 'bank', setType: 'warmup', occurrence: 0, pairs, setsOf: (id) => flags[id] })).toEqual({
      next: null,
      rest: true,
    })
    // 1. Arbeitssatz von A1 → 1. Arbeitssatz von A2 (Index 0, nicht 1)
    expect(afterSetDone({ exId: 'bank', setType: 'working', occurrence: 0, pairs, setsOf: (id) => flags[id] })).toEqual(
      { next: 'rudern', rest: false },
    )
  })

  it('Dropsatz trifft Dropsatz', () => {
    const flags: Flags = { bank: [w(true), dr(true)], rudern: [w(true), w(false), dr(false)] }
    expect(afterSetDone({ exId: 'bank', setType: 'drop', occurrence: 0, pairs, setsOf: (id) => flags[id] })).toEqual({
      next: 'rudern',
      rest: false,
    })
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
  })
  it('eigene Regeln werden genutzt', () => {
    const rules = { warmupToWarmup: 30, warmupToWorking: 120, beforeDrop: 10 }
    expect(restSecondsAfter('warmup', 'warmup', 180, rules)).toBe(30)
    expect(restSecondsAfter('warmup', 'working', 180, rules)).toBe(120)
    expect(restSecondsAfter('working', 'drop', 180, rules)).toBe(10)
    expect(restSecondsAfter('working', 'working', 150, rules)).toBe(150)
  })
  it('sonst die eingestellte Pause', () => {
    expect(restSecondsAfter('working', 'working', 180)).toBe(180)
    expect(restSecondsAfter('working', null, 120)).toBe(120)
    expect(restSecondsAfter('drop', null, 120)).toBe(120)
  })
})

describe('Sätze umsortieren', () => {
  const sets = [
    { id: 'w', set_number: 1 },
    { id: 'a', set_number: 2 },
    { id: 'b', set_number: 3 },
    { id: 'd', set_number: 4 },
  ]
  it('tauscht Nachbarn und speichert nur Geändertes', () => {
    expect(renumberedSets(sets, 2, 1)).toEqual([
      { id: 'b', set_number: 2 },
      { id: 'a', set_number: 3 },
    ])
  })
  it('lückenhafte oder doppelte Nummern werden dabei repariert', () => {
    const odd = [
      { id: 'x', set_number: 3 },
      { id: 'y', set_number: 3 },
      { id: 'z', set_number: 7 },
    ]
    expect(renumberedSets(odd, 0, 1)).toEqual([
      { id: 'y', set_number: 1 },
      { id: 'x', set_number: 2 },
      { id: 'z', set_number: 3 },
    ])
  })
  it('außerhalb der Liste: nichts', () => {
    expect(renumberedSets(sets, 0, -1)).toEqual([])
    expect(renumberedSets(sets, 3, 4)).toEqual([])
  })
})

describe('Typ ändern sortiert ein', () => {
  const L = [
    { id: 'w', set_number: 1, set_type: 'warmup' },
    { id: 'a', set_number: 2, set_type: 'working' },
    { id: 'b', set_number: 3, set_type: 'working' },
    { id: 'd', set_number: 4, set_type: 'drop' },
    { id: 'n', set_number: 5, set_type: 'working' }, // neu angehängt
  ]
  const order = (patches: { id: string; set_number: number }[]) => {
    const no = new Map(L.map((s) => [s.id, s.set_number]))
    for (const p of patches) no.set(p.id, p.set_number)
    return [...no.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id)
  }
  it('Aufwärmen nach oben hinter andere Aufwärmsätze', () => {
    expect(order(placeForType(L, 'n', 'warmup'))).toEqual(['w', 'n', 'a', 'b', 'd'])
  })
  it('Arbeitssatz vor den Drop', () => {
    expect(order(placeForType(L, 'n', 'working'))).toEqual(['w', 'a', 'b', 'n', 'd'])
  })
  it('Drop ans Ende', () => {
    expect(order(placeForType(L, 'a', 'drop'))).toEqual(['w', 'b', 'd', 'n', 'a'])
  })
})

describe('Ziehen: Zielposition', () => {
  const h = [60, 60, 60, 60]
  it('über die Hälfte der Nachbarzeile = eine Position weiter', () => {
    expect(dropIndex(2, -20, h)).toBe(2)
    expect(dropIndex(2, -35, h)).toBe(1)
    expect(dropIndex(2, -100, h)).toBe(0)
    expect(dropIndex(0, 95, h)).toBe(2)
  })
  it('nicht über die Liste hinaus', () => {
    expect(dropIndex(0, -300, h)).toBe(0)
    expect(dropIndex(3, 300, h)).toBe(3)
  })
})
