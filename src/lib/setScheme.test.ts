import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SET_SCHEME,
  coldWarmupCount,
  describeScheme,
  warmupHabit,
  warmupShare,
  type PastSet,
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
    expect(
      planSetTypes({ scheme: { working: 5, warmup: 'never', drop: 'always' }, last: [], muscleWarm: false }),
    ).toEqual(['working', 'working', 'working', 'working', 'working', 'drop'])
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
      drop: 'auto',
    })
    // alter Schalter „Dropsatz am Ende“
    expect(normalizeSetScheme({ drop: true }).drop).toBe('always')
    expect(normalizeSetScheme({ drop: false }).drop).toBe('auto')
    expect(normalizeSetScheme(null)).toEqual(S)
    expect(describeScheme({ working: 4, warmup: 'never', drop: 'always' })).toBe('4 Sätze · Drop')
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

describe('Aufwärmen nach Gewohnheit – nur kalte Einheiten zählen', () => {
  const M: Record<string, { group: string; secondary: string[] }> = {
    row: { group: 'back', secondary: ['biceps'] },
    lat: { group: 'back', secondary: ['biceps'] },
    bench: { group: 'chest', secondary: ['triceps', 'shoulders'] },
    curl: { group: 'biceps', secondary: [] },
  }
  const muscles = (id: string) => M[id]
  let t = 0
  /** Ein Training: Übungen in Reihenfolge, je [id, Aufwärmsätze, Arbeitssätze] */
  const day = (date: string, list: [string, number, number][]): PastSet[] =>
    list.flatMap(([id, w, n]) =>
      [...Array(w).fill('warmup'), ...Array(n).fill('working')].map((set_type) => ({
        date,
        exercise_id: id,
        set_type,
        created_at: `${date}T10:${String(t++ % 60).padStart(2, '0')}:00Z`,
      })),
    )
  const W = 'working' as const

  it('Latzug nur nach Rudern gemacht (ohne Aufwärmen) → heute als erste Übung trotzdem aufwärmen', () => {
    const hist = [
      ...day('2026-11-03', [
        ['row', 1, 3],
        ['lat', 0, 3],
      ]),
      ...day('2026-11-10', [
        ['row', 1, 3],
        ['lat', 0, 3],
      ]),
    ]
    const h = warmupHabit(hist, muscles).forExercise('lat')
    expect(h).toEqual({ exercise: null, habit: 1 })
    const sessions = [
      [W, W, W],
      [W, W, W],
    ]
    expect(planSetTypes({ scheme: S, last: sessions[0], sessions, muscleWarm: false, warmups: h })).toEqual([
      'warmup',
      W,
      W,
      W,
    ])
    // nach Rudern weiterhin ohne
    expect(planSetTypes({ scheme: S, last: sessions[0], sessions, muscleWarm: true, warmups: h })).toEqual([W, W, W])
  })

  it('Plan beginnt mit Rudern, heute Latzug zuerst: Isolationsübungen ohne Aufwärmen zählen nicht mit', () => {
    const M2: Record<string, { group: string; secondary: string[] }> = {
      ...M,
      pushdown: { group: 'triceps', secondary: [] },
      fly: { group: 'chest', secondary: [] },
      abs: { group: 'abs', secondary: [] },
    }
    const ses = (date: string) =>
      day(date, [
        ['row', 1, 3],
        ['lat', 0, 3],
        ['curl', 0, 3],
        ['pushdown', 0, 3],
        ['fly', 0, 3],
        ['abs', 0, 2],
      ])
    const hist = [...ses('2026-11-10'), ...ses('2026-11-13'), ...ses('2026-11-17')]
    const h = warmupHabit(hist, (id) => M2[id]).forExercise('lat')
    expect(h).toEqual({ exercise: null, habit: 1 })
    expect(planSetTypes({ scheme: S, last: [W, W, W], sessions: [[W, W, W]], muscleWarm: false, warmups: h })[0]).toBe(
      'warmup',
    )
  })

  it('wer bei kaltem Muskel nie aufwärmt, bekommt keinen Aufwärmsatz', () => {
    const hist = [
      ...day('2026-11-03', [
        ['bench', 0, 3],
        ['row', 0, 3],
      ]),
      ...day('2026-11-05', [['lat', 0, 3]]),
    ]
    const h = warmupHabit(hist, muscles).forExercise('curl')
    expect(h.habit).toBe(0)
    expect(planSetTypes({ scheme: S, last: [], muscleWarm: false, warmups: h })).toEqual([W, W, W])
  })

  it('mehrere Aufwärmsätze werden übernommen – Übung vor Gewohnheit', () => {
    const hist = [
      ...day('2026-11-03', [
        ['bench', 3, 3],
        ['row', 1, 3],
      ]),
      ...day('2026-11-06', [
        ['bench', 3, 3],
        ['row', 1, 3],
      ]),
    ]
    const hb = warmupHabit(hist, muscles)
    expect(hb.forExercise('bench').exercise).toBe(3)
    expect(planSetTypes({ scheme: S, last: [], muscleWarm: false, warmups: hb.forExercise('bench') })).toEqual([
      'warmup',
      'warmup',
      'warmup',
      W,
      W,
      W,
    ])
    expect(coldWarmupCount(hb.forExercise('row'), [])).toBe(1)
  })

  it('Nebenmuskeln wärmen mit: Curls nach Rudern zählen nicht als kalt', () => {
    const hist = day('2026-11-03', [
      ['row', 1, 3],
      ['curl', 0, 3],
    ])
    expect(warmupHabit(hist, muscles).forExercise('curl').exercise).toBeNull()
  })

  it('ohne Verlauf: einer; „immer“ mindestens einer, „nie“ keiner', () => {
    const none = { exercise: null, habit: null }
    expect(coldWarmupCount(none, [])).toBe(1)
    expect(
      planSetTypes({
        scheme: { ...S, warmup: 'always' },
        last: [],
        muscleWarm: true,
        warmups: { exercise: 0, habit: 0 },
      })[0],
    ).toBe('warmup')
    expect(
      planSetTypes({
        scheme: { ...S, warmup: 'never' },
        last: [],
        muscleWarm: false,
        warmups: { exercise: 2, habit: 2 },
      })[0],
    ).toBe(W)
  })

  it('Gewicht der Aufwärmsätze steigt an', () => {
    expect(warmupShare(0, 1)).toBe(0.5)
    expect([0, 1].map((i) => warmupShare(i, 2))).toEqual([0.4, 0.75])
    expect([0, 1, 2].map((i) => warmupShare(i, 3))).toEqual([0.4, 0.57, 0.75])
  })
})

describe('Dropsätze: auto · immer · nie', () => {
  const W = 'working' as const
  const withDrop = [[W, W, W, 'drop' as const]]
  it('auto = wie bei der Übung üblich (auch Doppel-Drop), neue Übung ohne', () => {
    expect(planSetTypes({ scheme: S, last: withDrop[0], sessions: withDrop, muscleWarm: true })).toEqual([
      W,
      W,
      W,
      'drop',
    ])
    const two = [[W, W, 'drop' as const, 'drop' as const]]
    expect(
      planSetTypes({ scheme: S, last: two[0], sessions: two, muscleWarm: true }).filter((x) => x === 'drop'),
    ).toHaveLength(2)
    expect(planSetTypes({ scheme: S, last: [], muscleWarm: true })).toEqual([W, W, W])
  })
  it('nie = überall weg, immer = überall einer', () => {
    expect(
      planSetTypes({ scheme: { ...S, drop: 'never' }, last: withDrop[0], sessions: withDrop, muscleWarm: true }),
    ).toEqual([W, W, W])
    expect(planSetTypes({ scheme: { ...S, drop: 'always' }, last: [], muscleWarm: true })).toEqual([W, W, W, 'drop'])
  })
})
