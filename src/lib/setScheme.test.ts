import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SET_SCHEME,
  describeScheme,
  lastSessionTypes,
  normalizeSetScheme,
  planSetTypes,
  recentSessionTypes,
  usualSession,
} from './setScheme'

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

describe('Übliche Satzzahl statt nur letztes Mal', () => {
  const W = 'working' as const
  const w = (n: number) => Array(n).fill(W)

  it('einmal nur 1 Satz geschafft → nächstes Mal wieder die übliche Anzahl', () => {
    const sessions = [w(1), w(3), w(3), w(3)]
    expect(usualSession(sessions, S).working).toBe(3)
    expect(planSetTypes({ scheme: S, last: w(1), sessions, muscleWarm: true })).toEqual(w(3))
  })

  it('nur eine Einheit bekannt und die war kurz → mindestens das eigene Schema', () => {
    expect(usualSession([w(1)], S).working).toBe(3)
    expect(usualSession([w(5)], S).working).toBe(5)
  })

  it('zweimal hintereinander gleich = bewusst geändert', () => {
    expect(usualSession([w(2), w(2), w(4), w(4)], S).working).toBe(2)
    expect(usualSession([w(5), w(5), w(3)], S).working).toBe(5)
  })

  it('Gleichstand → die größere Anzahl; Aufwärm/Drop aus der passenden Einheit', () => {
    const sessions = [w(2), ['warmup', ...w(4), 'drop'] as const, w(3), w(2)].map((x) => [...x])
    // 2 und 4… Häufigkeit: 2×2, 1×4, 1×3 → 2
    expect(usualSession(sessions, S).working).toBe(2)
    const tie = [w(1), ['warmup', ...w(4), 'drop'], w(3)].map((x) => [...x]) as ('working' | 'warmup' | 'drop')[][]
    const u = usualSession(tie, S)
    expect(u.working).toBe(4)
    expect(planSetTypes({ scheme: S, last: w(1), sessions: tie, muscleWarm: false })).toEqual([
      'warmup',
      ...w(4),
      'drop',
    ])
  })

  it('Einheiten aus dem Verlauf, neueste zuerst', () => {
    const h = [
      { date: '2026-11-01', set_type: W },
      { date: '2026-11-08', set_type: W },
      { date: '2026-11-08', set_type: 'drop' as const },
      { date: '2026-11-04', set_type: null },
    ]
    expect(recentSessionTypes(h)).toEqual([[W, 'drop'], [W], [W]])
  })
})
