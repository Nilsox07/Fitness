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

// Art über den festen ID-Bereich (die Texte wechseln täglich)
type R = ReturnType<typeof planReminders>[number]
const isKind = (base: number) => (x: R) => x.id >= base && x.id < base + 20
const LUNCH = isKind(8020)
const BREAKFAST = isKind(8000)
const WORKOUT = isKind(8300)
const supps = (r: R[]) => r.filter((x) => x.id >= 8200 && x.id < 8300)

describe('Lokale Erinnerungen', () => {
  it('Journal abends um 21 Uhr – nicht, wenn heute schon eingetragen', () => {
    const j = (done: boolean) => planReminders({ ...base, journalDone: done }).filter(isKind(8440))
    expect(j(false).map((x) => [x.at.getDate(), x.at.getHours()])).toEqual([
      [28, 21],
      [29, 21],
    ])
    expect(j(true).map((x) => x.at.getDate())).toEqual([29])
    expect(j(false)[0].route).toBe('/journal')
  })
  it('Schlafenszeit 30 min vorher, nach Mitternacht am Folgetag', () => {
    const bed = (bedAt: string) => planReminders({ ...base, bedtime: { bedAt, need: '8:15 h' } }).filter(isKind(8420))
    const r = bed('22:45')
    expect(r.map((x) => [x.at.getDate(), x.at.getHours(), x.at.getMinutes()])).toEqual([
      [28, 22, 15],
      [29, 22, 15],
    ])
    expect(r[0].body).toMatch(/8:15 h/)
    expect(bed('0:20').map((x) => [x.at.getDate(), x.at.getHours(), x.at.getMinutes()])).toEqual([
      [28, 23, 50],
      [29, 23, 50],
    ])
    expect(planReminders(base).some(isKind(8420))).toBe(false)
  })

  it('plant nur Zukünftiges und nur, was noch fehlt', () => {
    const r = planReminders(base)
    expect(r.every((x) => x.at > now)).toBe(true)
    // Mittag 13:30 heute fehlt noch → ja; Frühstück heute ist schon da und vorbei
    expect(r.some((x) => LUNCH(x) && x.at.getDate() === 28)).toBe(true)
    expect(r.some((x) => BREAKFAST(x) && x.at.getDate() === 28)).toBe(false)
    // Vitamin D heute 18:00 ja, Kreatin heute 08:00 ist vorbei
    expect(
      supps(r)
        .filter((x) => x.title.includes('Kreatin'))
        .map((x) => x.at.getDate()),
    ).toEqual([29])
    expect(supps(r).some((x) => x.title.includes('Vitamin D') && x.at.getDate() === 28)).toBe(true)
  })

  it('Trainingstag nur an geplanten Tagen und nicht nach dem Training', () => {
    expect(planReminders(base).filter((x) => WORKOUT(x) && x.at.getDate() === 28)).toHaveLength(1)
    expect(
      planReminders({ ...base, trainedToday: true }).filter((x) => WORKOUT(x) && x.at.getDate() === 28),
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

describe('Formulierungen', () => {
  it('nennen echte Zahlen und schreiben keine bestimmten Lebensmittel vor', () => {
    const r = planReminders({ ...base, notify: { ...NOTIFY_DEFAULTS, protein: { on: true, time: '16:00' } } })
    const p = r.find((x) => x.id >= 8080 && x.id < 8100 && x.at.getDate() === 28)!
    expect(p.title).toContain('110 g')
    expect(r.every((x) => !/Skyr|Shake/.test(x.title + x.body))).toBe(true)
  })
})
