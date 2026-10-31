import { describe, expect, it } from 'vitest'
import {
  cheatJudgeText,
  dailyBriefingText,
  expectedShare,
  hypeLineText,
  mealVerdictText,
  pick,
  seedOf,
  weeklyReviewText,
  type BriefingCtx,
  type WeeklyFreeInput,
} from './freeTexts'

const base: BriefingCtx = {
  day: '2026-10-31',
  hour: 9,
  readiness: null,
  trainedToday: false,
  restDay: false,
  nextWorkout: 'Push',
  weekDone: 2,
  weekGoal: 4,
  nutrition: null,
}

const sentences = (s: string) => s.split(/(?<=[.!])\s+/).filter(Boolean).length

describe('Varianten', () => {
  it('sind stabil je Seed und wechseln mit dem Datum', () => {
    expect(seedOf('a')).toBe(seedOf('a'))
    const list = ['x', 'y', 'z', 'w']
    expect(pick(list, '2026-10-31')).toBe(pick(list, '2026-10-31'))
    const days = Array.from({ length: 10 }, (_, i) => pick(list, `2026-11-${10 + i}`))
    expect(new Set(days).size).toBeGreaterThan(1)
  })
})

describe('Tagesbriefing (kostenlos)', () => {
  it('ohne Uhr: nennt den geplanten Plan', () => {
    const t = dailyBriefingText(base)
    expect(t).toMatch(/Push/)
    expect(sentences(t)).toBe(2)
  })

  it('Ruhetag und erledigtes Training', () => {
    expect(dailyBriefingText({ ...base, restDay: true, nextWorkout: null })).toMatch(/Ruhetag/)
    expect(dailyBriefingText({ ...base, trainedToday: true })).toMatch(/2\/4|erledigt|trainiert|Haken/)
  })

  it('niedrige Tagesform nennt den schwachen Faktor und rät zu leichter', () => {
    const t = dailyBriefingText({
      ...base,
      readiness: {
        score: 38,
        factors: [
          { key: 'sleep', value: '5:10 h', status: 'schwach' },
          { key: 'hrv', value: '61 ms', status: 'gut' },
        ],
      },
    })
    expect(t).toMatch(/38/)
    expect(t).toMatch(/kurzer Schlaf \(5:10 h\)/)
    expect(t).toMatch(/leichter/)
  })

  it('hohe Tagesform: schwer trainieren', () => {
    const t = dailyBriefingText({
      ...base,
      readiness: { score: 86, factors: [{ key: 'hrv', value: '70 ms', status: 'gut' }] },
    })
    expect(t).toMatch(/86/)
    expect(t).toMatch(/Push/)
  })

  it('mittlere Tagesform mit Bremse', () => {
    const t = dailyBriefingText({
      ...base,
      readiness: { score: 60, factors: [{ key: 'strength', value: '24 Sätze', status: 'schwach' }] },
    })
    expect(t).toMatch(/viele harte Sätze/)
  })

  it('Ernährung: Eiweiß fehlt am Nachmittag', () => {
    const t = dailyBriefingText({
      ...base,
      hour: 16,
      nutrition: {
        kcalEaten: 900,
        kcalTarget: 2400,
        proteinEaten: 30,
        proteinTarget: 150,
        waterMl: 2000,
        waterTarget: 2500,
      },
    })
    expect(t).toMatch(/120 g Eiweiß offen/)
  })

  it('Ernährung: über dem Ziel, nichts eingetragen, wenig getrunken, alles erreicht', () => {
    const n = {
      kcalEaten: 2900,
      kcalTarget: 2400,
      proteinEaten: 160,
      proteinTarget: 150,
      waterMl: 3000,
      waterTarget: 2500,
    }
    expect(dailyBriefingText({ ...base, hour: 19, nutrition: n })).toMatch(/500 kcal über/)
    expect(dailyBriefingText({ ...base, hour: 13, nutrition: { ...n, kcalEaten: 0, proteinEaten: 0 } })).toMatch(
      /Noch nichts eingetragen/,
    )
    expect(
      dailyBriefingText({ ...base, hour: 15, nutrition: { ...n, kcalEaten: 1200, proteinEaten: 90, waterMl: 300 } }),
    ).toMatch(/ml/)
    expect(dailyBriefingText({ ...base, hour: 21, nutrition: { ...n, kcalEaten: 2350 } })).toMatch(/Ziele erreicht/)
  })

  it('Erwartung steigt über den Tag', () => {
    expect(expectedShare(8)).toBeLessThan(expectedShare(13))
    expect(expectedShare(22)).toBe(1)
  })
})

const week: WeeklyFreeInput = {
  weekId: '2026-W43',
  sessions: 4,
  sessionGoal: 4,
  volumeKg: 18250,
  prs: 2,
  daysLogged: 6,
  avgKcal: 2380,
  kcalTarget: 2400,
  avgProtein: 145,
  proteinTarget: 150,
  weightDelta: -0.4,
  goal: 'lose',
  topMuscles: ['Brust', 'Rücken'],
  proteinDays: 5,
  kcalDays: 5,
  streakWeeks: 3,
}

describe('Wochenfazit (kostenlos)', () => {
  it('starke Woche: Ziel, Rekorde, Eiweiß, Kalorien', () => {
    const r = weeklyReviewText(week)
    expect(r.summary).toMatch(/4 von 4/)
    expect(r.training).toMatch(/2 neue Rekorde/)
    expect(r.training).toMatch(/Brust und Rücken/)
    expect(r.nutrition).toMatch(/nah am Ziel/)
    expect(r.nutrition).toMatch(/Eiweißziel an 5 von 6 Tagen/)
    expect(r.nutrition).toMatch(/passt zum Ziel/)
    expect(r.wins.length).toBeGreaterThan(0)
    expect(r.wins.length).toBeLessThanOrEqual(3)
    expect(r.focus.length).toBeGreaterThan(0)
  })

  it('schwache Woche ohne Training und ohne Essen', () => {
    const r = weeklyReviewText({
      ...week,
      sessions: 0,
      prs: 0,
      volumeKg: 0,
      daysLogged: 0,
      avgKcal: null,
      avgProtein: null,
    })
    expect(r.headline).toBe('Neue Woche, neuer Start')
    expect(r.nutrition).toMatch(/Keine Mahlzeiten/)
    expect(r.focus.join(' ')).toMatch(/Training/)
  })

  it('ohne Ernährungsmodul: nutrition = null', () => {
    const r = weeklyReviewText({ ...week, daysLogged: null })
    expect(r.nutrition).toBeNull()
  })

  it('mehr als geplant, zu wenig Eiweiß, über den Kalorien', () => {
    const r = weeklyReviewText({ ...week, sessions: 5, avgProtein: 80, avgKcal: 2900, goal: 'maintain' })
    expect(r.summary).toMatch(/5 Trainings/)
    expect(r.nutrition).toMatch(/Eiweiß zu niedrig/)
    expect(r.nutrition).toMatch(/über dem Ziel/)
  })

  it('halbe Woche ohne Rekord', () => {
    const r = weeklyReviewText({ ...week, sessions: 2, prs: 0 })
    expect(r.summary).toMatch(/2 von 4/)
    expect(r.training).toMatch(/Kein neuer Rekord/)
  })
})

describe('Mahlzeit-Einschätzung', () => {
  it('erkennt viel Eiweiß, wenig Eiweiß, über Budget', () => {
    expect(mealVerdictText({ kcal: 400, protein: 40, carbs: 30, fat: 10 })).toMatch(/Viel Eiweiß/)
    expect(mealVerdictText({ kcal: 800, protein: 10, carbs: 100, fat: 40 })).toMatch(/Wenig Eiweiß/)
    expect(mealVerdictText({ kcal: 900, protein: 30, carbs: 100, fat: 40 }, { kcalLeft: 500 })).toMatch(/über/)
    expect(mealVerdictText({ kcal: 0, protein: 0, carbs: 0, fat: 0 })).toBe('')
  })
})

describe('Spruch & Cheat', () => {
  it('Spruch nennt Rekord bzw. Zahlen', () => {
    expect(hypeLineText({ sets: 18, exercises: 5, volumeKg: 8000, pr: 'Bankdrücken' })).toMatch(/Bankdrücken/)
    expect(hypeLineText({ sets: 12, exercises: 4, volumeKg: 12000 })).toMatch(/kg|Tonnen/)
  })

  it('Cheat nur bei viel Energie und wenig Eiweiß', () => {
    expect(cheatJudgeText({ name: 'Pizza', kcal: 900, protein: 25, carbs: 100, fat: 45 }).indulgent).toBe(true)
    expect(cheatJudgeText({ name: 'Protein-Pizza', kcal: 700, protein: 70, carbs: 60, fat: 18 }).indulgent).toBe(false)
    expect(cheatJudgeText({ name: 'Apfel', kcal: 80, protein: 0, carbs: 20, fat: 0 }).indulgent).toBe(false)
  })
})
