import { describe, expect, it } from 'vitest'
import { arrangeCardio, hybridIssues, isHard, isLegPlan, todayAdvice, type GymDay } from './hybrid'
import type { CardioSession } from './onboarding'

// Mo Push, Di Beine, Do Pull, Fr Beine
const week: GymDay[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  day: d,
  gym: [0, 1, 3, 4].includes(d),
  legs: d === 1 || d === 4,
}))
const s = (day: number, type: CardioSession['type'], minutes = 30): CardioSession => ({
  day,
  kind: 'run',
  type,
  minutes,
})

describe('Hybrid-Abstimmung', () => {
  it('erkennt harte Einheiten am oder vor dem Beintag', () => {
    const issues = hybridIssues([s(0, 'interval'), s(4, 'interval'), s(6, 'easy')], week)
    expect(issues.map((i) => i.kind)).toEqual(['hard-before-legs', 'hard-on-legs'])
    expect(issues[0].text).toMatch(/^Mo: Intervalle laufen/)
  })

  it('lockere Einheit am Beintag ist nur ein Hinweis', () => {
    const issues = hybridIssues([s(1, 'easy')], week)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('hint')
  })

  it('verteilt neu, wenn es besser wird – sonst null', () => {
    const fixed = arrangeCardio([s(0, 'interval'), s(4, 'easy', 40)], week)
    expect(fixed).not.toBeNull()
    expect(hybridIssues(fixed!, week).filter((i) => i.severity === 'warn')).toHaveLength(0)
    // Intervalle landen nicht vor/auf einem Beintag
    const iv = fixed!.find((x) => x.type === 'interval')!
    expect([0, 1, 3, 4]).not.toContain(iv.day)
    expect(arrangeCardio([s(6, 'interval'), s(2, 'easy')], week)).toBeNull()
  })

  it('ohne feste Krafttage nichts verschieben', () => {
    expect(
      arrangeCardio(
        [s(0, 'interval')],
        week.map((w) => ({ ...w, gym: false, legs: false })),
      ),
    ).toBeNull()
  })

  it('harte Einheit: Intervalle und lange ab 60 min', () => {
    expect(isHard(s(0, 'interval'))).toBe(true)
    expect(isHard(s(0, 'long', 45))).toBe(false)
    expect(isHard(s(0, 'long', 70))).toBe(true)
  })

  it('Beintag aus den Übungen', () => {
    const m: Record<string, string> = {
      a: 'Beine',
      b: 'Beinbeuger',
      c: 'Brust',
      d: 'Rücken',
      e: 'Schultern',
      f: 'Bizeps',
    }
    expect(isLegPlan(['a', 'b', 'c'], (id) => m[id])).toBe(true)
    expect(isLegPlan(['a', 'c', 'd', 'e', 'f'], (id) => m[id])).toBe(false)
    expect(isLegPlan(['a', 'c'], (id) => m[id])).toBe(true)
  })

  it('Tipp für heute', () => {
    expect(todayAdvice(s(0, 'interval'), week)).toMatch(/Morgen ist Beintag/)
    expect(todayAdvice(s(3, 'easy'), week)).toMatch(/nach dem Krafttraining/)
    expect(todayAdvice(s(6, 'easy'), week)).toBeNull()
  })
})
