import { describe, expect, it } from 'vitest'
import { fatigueByDate, fatigueFactor, muscleMap, overlap, preFatigueSets } from './fatigue'

const muscles = muscleMap([
  { id: 'incline', muscle_group: 'Brust', secondary_muscles: ['Schultern', 'Trizeps'] },
  { id: 'fly', muscle_group: 'Brust', secondary_muscles: [] },
  { id: 'dips', muscle_group: 'Trizeps', secondary_muscles: ['Brust'] },
  { id: 'curl', muscle_group: 'Bizeps', secondary_muscles: [] },
])

let t = 0
const set = (exercise_id: string, set_type = 'working', reps = 10) => ({
  exercise_id,
  set_type,
  reps,
  created_at: `2026-11-04T10:${String(++t).padStart(2, '0')}:00Z`,
})

describe('Vorermüdung', () => {
  it('Überschneidung: gleicher Hauptmuskel 1, Hilfsmuskel 0,5, sonst 0', () => {
    expect(overlap(muscles.get('fly')!, muscles.get('incline')!)).toBe(1)
    expect(overlap(muscles.get('fly')!, muscles.get('dips')!)).toBe(0.5)
    expect(overlap(muscles.get('fly')!, muscles.get('curl')!)).toBe(0)
  })

  it('zählt nur harte, erledigte Sätze VOR der Übung', () => {
    const day = [
      set('incline', 'warmup'),
      set('incline'),
      set('incline'),
      set('incline'),
      set('curl'),
      set('incline', 'working', 0), // geplant, nicht gemacht
      set('fly'),
      set('dips'), // danach → zählt nicht
    ]
    expect(preFatigueSets(day, 'fly', muscles)).toBe(3)
  })

  it('noch keine eigenen Sätze → alles bisher Erledigte zählt', () => {
    expect(preFatigueSets([set('incline'), set('dips')], 'fly', muscles)).toBe(1.5)
  })

  it('Faktor: −1,5 % je Satz, höchstens −15 %', () => {
    expect(fatigueFactor(0)).toBe(1)
    expect(fatigueFactor(4)).toBeCloseTo(0.94)
    expect(fatigueFactor(40)).toBe(0.85)
  })

  it('je Tag', () => {
    const all = [
      { ...set('incline'), date: '2026-11-01' },
      { ...set('fly'), date: '2026-11-01' },
      { ...set('fly'), date: '2026-11-03' },
      { ...set('incline'), date: '2026-11-03' },
    ]
    const m = fatigueByDate(all, 'fly', muscles)
    expect(m.get('2026-11-01')).toBe(1)
    expect(m.get('2026-11-03')).toBe(0)
  })
})
