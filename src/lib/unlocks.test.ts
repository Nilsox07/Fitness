import { describe, expect, it } from 'vitest'
import { FALLBACK_THEMES, normalizeTheme } from '../../api/_season.js'
import { achievementProgress, isUnlocked, nextUnlocks, normalizeLook, titleLabel, UNLOCKS } from './unlocks'
import { seasonProgress, type SeasonTheme } from './seasonTheme'

const ctx = (level: number, prestige = 0, ach: string[] = []) => ({ level, prestige, achievements: new Set(ach) })

describe('Freischaltungen', () => {
  it('Level-Belohnungen bis 50, Erfolge separat', () => {
    expect(Math.max(...UNLOCKS.filter((u) => u.level).map((u) => u.level!))).toBe(50)
    const fox = UNLOCKS.find((u) => u.id === 'fox')!
    expect(isUnlocked(fox, ctx(29))).toBe(false)
    expect(isUnlocked(fox, ctx(30))).toBe(true)
    // Nach Prestige bleibt alles offen, auch bei Level 1
    expect(isUnlocked(fox, ctx(1, 1))).toBe(true)
    const chain = UNLOCKS.find((u) => u.id === 'chain')!
    expect(isUnlocked(chain, ctx(50, 2))).toBe(false)
    expect(isUnlocked(chain, ctx(1, 0, ['sessions100']))).toBe(true)
  })
  it('als Nächstes', () => {
    expect(nextUnlocks(ctx(16), 2).map((u) => u.level)).toEqual([17, 18])
    expect(nextUnlocks(ctx(5, 1))).toEqual([])
  })
  it('Erfolge', () => {
    const p = achievementProgress({
      sessions: 120,
      proteinDays: 3,
      weekStreak: 10,
      photoSpanDays: 60,
      pokesSent: 2,
      prestige: 0,
    })
    expect(p.sessions100.done).toBe(true)
    expect(p.protein30.done).toBe(false)
    expect(p.streak10.done).toBe(true)
    expect(p.photo8w.done).toBe(true)
    expect(p.prestige1.done).toBe(false)
  })
  it('Aussehen robust lesen', () => {
    expect(normalizeLook({ skin: 'fox', accessory: '<script>', title: 'legende' })).toMatchObject({
      skin: 'fox',
      accessory: 'none',
      title: 'legende',
    })
    expect(titleLabel('legende')).toBe('Legende')
    expect(titleLabel('none')).toBe('')
  })
})

describe('Saison-Themen', () => {
  it('KI-Antwort wird geprüft und auf 3 gültige Quests gebracht', () => {
    const t = normalizeTheme(
      {
        name: 'Beintag-Oktober',
        emoji: '🦵',
        tagline: 'Kein Beintag fällt aus.',
        badge: { emoji: '🦵', label: 'Beinmaschine' },
        quests: [
          { type: 'muscle', muscle: 'Beine', target: 50 },
          { type: 'quatsch', target: 3 },
          { type: 'muscle', muscle: 'Arme', target: 4 },
        ],
      },
      '2026-10',
    )
    expect(t.id).toBe('2026-10')
    expect(t.quests).toHaveLength(3)
    expect(t.quests[0]).toMatchObject({ type: 'muscle', muscle: 'Beine', target: 10 })
    expect(new Set(t.quests.map((q) => q.type)).size).toBe(3)
    expect(t.quests[0].label).toBe('10× Beine trainieren')
  })
  it('Ersatz-Thema ohne KI', () => {
    expect(FALLBACK_THEMES).toHaveLength(12)
    const t = normalizeTheme(null, '2026-11')
    expect(t.name).toBe('Eiweiß-November')
    expect(t.quests).toHaveLength(3)
  })
  it('Fortschritt aus echten Daten', () => {
    const theme = normalizeTheme(
      {
        quests: [
          { type: 'muscle', muscle: 'Beine', target: 3 },
          { type: 'sessions', target: 6 },
          { type: 'protein_days', target: 8 },
        ],
      },
      '2026-10',
    ) as SeasonTheme
    const set = (date: string, ex: string) =>
      ({
        id: date + ex,
        user_id: 'u',
        workout_id: 'w',
        exercise_id: ex,
        set_number: 1,
        reps: 8,
        weight: 50,
        set_type: 'working',
        to_failure: false,
        created_at: '',
        date,
      }) as never
    const p = seasonProgress(theme, {
      sets: [
        set('2026-10-01', 'squat'),
        set('2026-10-03', 'bench'),
        set('2026-10-05', 'calf'),
        set('2026-09-30', 'squat'),
      ],
      muscleOf: (id) => ({ squat: 'Beine', calf: 'Waden', bench: 'Brust' })[id],
      foodDays: new Map([['2026-10-02', { protein: 160 }]]),
      proteinTarget: 150,
      drankByDate: new Map(),
      waterTarget: 2500,
      today: new Date('2026-10-12T12:00:00'),
    })
    expect(p.quests.map((q) => q.value)).toEqual([2, 3, 1])
    expect(p.done).toBe(false)
  })
})
