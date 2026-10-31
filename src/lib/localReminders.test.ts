import { describe, expect, it } from 'vitest'
import { NOTIFY_DEFAULTS } from './notify'
import { planReminders, type ReminderCtx } from './localReminders'

// Mittwoch, 12:00 Uhr (lokale Zeit)
const now = new Date(2026, 9, 28, 12, 0)

const base: ReminderCtx = {
  now,
  notify: NOTIFY_DEFAULTS,
  showNutrition: true,
  meals: { breakfast: true, lunch: false, dinner: false },
  kcalLeft: 900,
  waterMl: 500,
  waterTarget: 2500,
  proteinEaten: 40,
  proteinTarget: 150,
  trainedToday: false,
  trainingDays: ['2026-10-28', '2026-10-30'],
  daysSinceTraining: 1,
  nextWorkout: 'Push',
  supplements: [
    { name: 'Kreatin', time: '08:00', taken: false, dayOffset: 0 },
    { name: 'Vitamin D', time: '18:00', taken: false, dayOffset: 0 },
    { name: 'Kreatin', time: '08:00', taken: false, dayOffset: 1 },
  ],
  fasting: null,
}

const kinds = (r: ReturnType<typeof planReminders>) => r.map((x) => x.title)

describe('Lokale Erinnerungen', () => {
  it('plant nur Zukünftiges und nur, was noch fehlt', () => {
    const r = planReminders(base)
    expect(r.every((x) => x.at > now)).toBe(true)
    // Mittag 13:30 heute fehlt noch → ja; Frühstück heute ist schon da und vorbei
    expect(r.some((x) => x.title.startsWith('Was gab’s mittags') && x.at.getDate() === 28)).toBe(true)
    expect(r.some((x) => x.title.startsWith('Frühstück') && x.at.getDate() === 28)).toBe(false)
    // Vitamin D heute 18:00 ja, Kreatin heute 08:00 ist vorbei
    expect(r.filter((x) => x.title.startsWith('Kreatin')).map((x) => x.at.getDate())).toEqual([29])
  })

  it('Trainingstag nur an geplanten Tagen und nicht nach dem Training', () => {
    expect(kinds(planReminders(base)).filter((t) => t.startsWith('Heute ist Trainingstag'))).toHaveLength(1)
    expect(
      kinds(planReminders({ ...base, trainedToday: true })).filter((t) => t.startsWith('Heute ist Trainingstag')),
    ).toHaveLength(0)
  })

  it('Wasser und Eiweiß entfallen, wenn das Ziel schon (fast) erreicht ist', () => {
    const r = planReminders({ ...base, waterMl: 2000, proteinEaten: 140 })
    expect(r.filter((x) => x.at.getDate() === 28 && /Wasser|Eiweiß/.test(x.title))).toHaveLength(0)
  })

  it('ohne Ernährungsmodul keine Ernährungs-Erinnerungen', () => {
    const r = planReminders({ ...base, showNutrition: false })
    expect(r.some((x) => x.route.startsWith('/nutrition'))).toBe(false)
  })

  it('IDs sind eindeutig und im reservierten Bereich', () => {
    const r = planReminders({
      ...base,
      fasting: { open: '12:30', close: '20:30' },
      notify: { ...NOTIFY_DEFAULTS, fasting: { on: true } },
    })
    const ids = r.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((i) => i >= 8000 && i <= 8499)).toBe(true)
  })
})
