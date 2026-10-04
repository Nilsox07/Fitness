import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DIET,
  dietPromptText,
  dietShortLabel,
  entriesOutsideWindow,
  fastingState,
  fastingWindow,
  fmtDuration,
  normalizeDiet,
  resolveDiet,
  toggleRestriction,
} from './dietStyle'
import { dietContext, toMealAnalysis, toMealFlags } from './ai'

const at = (h: number, m = 0) => new Date(2026, 9, 4, h, m)

describe('normalizeDiet', () => {
  it('fällt bei Unsinn auf den Standard zurück', () => {
    expect(normalizeDiet(null)).toEqual(DEFAULT_DIET)
    expect(normalizeDiet({ macro: 'paleo', restrictions: 'x', fasting: '12:12', fastingStart: '25:00' })).toEqual(
      DEFAULT_DIET,
    )
  })
  it('hält Einschränkungen widerspruchsfrei', () => {
    expect(normalizeDiet({ restrictions: ['vegan', 'vegetarian', 'unprocessed'] }).restrictions).toEqual([
      'vegan',
      'unprocessed',
    ])
    expect(toggleRestriction(['vegetarian', 'unprocessed'], 'vegan')).toEqual(['vegan', 'unprocessed'])
    expect(toggleRestriction(['vegan'], 'vegan')).toEqual([])
  })
})

describe('resolveDiet', () => {
  it('liest DB-Spalten, wenn vorhanden', () => {
    const d = resolveDiet({ diet_macro: 'keto', diet_restrictions: ['vegan'], fasting: '16:8', fasting_start: '11:00' })
    expect(d).toEqual({ macro: 'keto', restrictions: ['vegan'], fasting: '16:8', fastingStart: '11:00' })
  })
  it('ohne Spalten (Migration fehlt) → Standard/Fallback', () => {
    expect(resolveDiet({})).toEqual(DEFAULT_DIET)
  })
})

describe('Labels & Prompt', () => {
  const d = normalizeDiet({ macro: 'keto', restrictions: ['vegetarian'], fasting: '16:8', fastingStart: '12:00' })
  it('Kurzlabel', () => {
    expect(dietShortLabel(d)).toBe('Keto · Vegetarisch · 16:8')
    expect(dietShortLabel(DEFAULT_DIET)).toBe('')
  })
  it('Prompt-Zusatz nennt Regeln und Fenster', () => {
    const t = dietPromptText(d)
    expect(t).toContain('Keto')
    expect(t).toContain('30 g')
    expect(t).toContain('vegetarisch')
    expect(t).toContain('12:00–20:00')
    expect(t).toContain('strikt')
    expect(dietContext(DEFAULT_DIET)).toBe('')
    expect(dietContext(d)).toBe(t)
  })
})

describe('Intervallfasten', () => {
  const win = fastingWindow({ fasting: '16:8', fastingStart: '12:00' })!
  it('Fenster', () => {
    expect(win).toMatchObject({ start: '12:00', end: '20:00', hours: 8 })
    expect(fastingWindow({ fasting: '5:2', fastingStart: '12:00' })).toBeNull()
    expect(fastingWindow({ fasting: '20:4', fastingStart: '22:00' })?.end).toBe('02:00')
  })
  it('Fastenphase vor dem Fenster', () => {
    const s = fastingState(at(9, 46), win)
    expect(s.phase).toBe('fasting')
    expect(s.minutesLeft).toBe(134)
    expect(s.nextChange).toBe('12:00')
    expect(fmtDuration(s.minutesLeft)).toBe('2:14 h')
  })
  it('Essensfenster offen', () => {
    const s = fastingState(at(14, 30), win)
    expect(s.phase).toBe('eating')
    expect(fmtDuration(s.minutesLeft)).toBe('5:30 h')
    expect(s.progress).toBeCloseTo(150 / 480)
  })
  it('Fenster über Mitternacht', () => {
    const w = fastingWindow({ fasting: '20:4', fastingStart: '22:00' })!
    expect(fastingState(at(1, 0), w).phase).toBe('eating')
    expect(fastingState(at(3, 0), w).phase).toBe('fasting')
  })
  it('findet Einträge außerhalb des Fensters (nur heute)', () => {
    const now = at(21)
    const out = entriesOutsideWindow(
      [
        { created_at: at(8, 30).toISOString() },
        { created_at: at(13).toISOString() },
        { created_at: new Date(2026, 9, 3, 8).toISOString() },
      ],
      { fasting: '16:8', fastingStart: '12:00' },
      now,
    )
    expect(out).toHaveLength(1)
    expect(out[0].getHours()).toBe(8)
  })
})

describe('Mahlzeit-Flags (KI)', () => {
  it('liest flags robust und rückwärtskompatibel', () => {
    expect(toMealFlags({ animal: 'fish', processing: '3' })).toEqual({ animal: 'fish', processing: 3 })
    expect(toMealFlags({ animal: 'pork', processing: 9 })).toEqual({ processing: 4 })
    expect(toMealFlags(null)).toBeUndefined()
    const a = toMealAnalysis('{"title":"X","verdict":"","items":[{"name":"Ei","kcal":80}],"flags":{"animal":"dairy_egg","processing":1}}')
    expect(a.flags).toEqual({ animal: 'dairy_egg', processing: 1 })
    expect(toMealAnalysis('{"items":[{"name":"Ei","kcal":80}]}').flags).toBeUndefined()
  })
})
