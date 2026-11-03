import { describe, expect, it } from 'vitest'
import { DEFAULT_SET_SCHEME, describeScheme, lastSessionTypes, normalizeSetScheme, planSetTypes } from './setScheme'

const S = DEFAULT_SET_SCHEME

describe('Satz-Schema', () => {
  it('neue Übung: Standard 3 Arbeitssätze, Aufwärmen nur wenn Muskel kalt, kein Drop', () => {
    expect(planSetTypes({ scheme: S, last: [], muscleWarm: false })).toEqual([
      'warmup',
      'working',
      'working',
      'working',
    ])
    expect(planSetTypes({ scheme: S, last: [], muscleWarm: true })).toEqual(['working', 'working', 'working'])
  })

  it('bekannte Übung: Struktur vom letzten Mal (z. B. W, 1, 2, Drop)', () => {
    const last = ['warmup', 'working', 'working', 'drop'] as const
    expect(planSetTypes({ scheme: S, last: [...last], muscleWarm: false })).toEqual([
      'warmup',
      'working',
      'working',
      'drop',
    ])
    // Muskel schon warm → ohne Aufwärmsatz
    expect(planSetTypes({ scheme: S, last: [...last], muscleWarm: true })).toEqual(['working', 'working', 'drop'])
  })

  it('wer nie aufwärmt, bekommt auch keinen Aufwärmsatz', () => {
    expect(planSetTypes({ scheme: S, last: ['working', 'working', 'working', 'working'], muscleWarm: false })).toEqual(
      Array(4).fill('working'),
    )
  })

  it('Einstellung „nie“/„immer“ überstimmt', () => {
    expect(planSetTypes({ scheme: { ...S, warmup: 'never' }, last: [], muscleWarm: false })[0]).toBe('working')
    expect(planSetTypes({ scheme: { ...S, warmup: 'always' }, last: ['working'], muscleWarm: true })[0]).toBe('warmup')
  })

  it('eigenes Schema für neue Übungen', () => {
    expect(planSetTypes({ scheme: { working: 5, warmup: 'never', drop: true }, last: [], muscleWarm: false })).toEqual([
      'working',
      'working',
      'working',
      'working',
      'working',
      'drop',
    ])
  })

  it('letzte Einheit aus dem Verlauf, unvollständige Werte werden repariert', () => {
    expect(
      lastSessionTypes([
        { date: '2026-10-01', set_type: 'working' },
        { date: '2026-10-08', set_type: 'warmup' },
        { date: '2026-10-08', set_type: null },
      ]),
    ).toEqual(['warmup', 'working'])
    expect(normalizeSetScheme({ working: 99, warmup: 'x', drop: 'ja' })).toEqual({
      working: 8,
      warmup: 'auto',
      drop: false,
    })
    expect(normalizeSetScheme(null)).toEqual(S)
    expect(describeScheme({ working: 4, warmup: 'never', drop: true })).toBe('4 Sätze · Drop')
  })
})
