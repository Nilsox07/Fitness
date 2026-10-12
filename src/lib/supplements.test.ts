import { describe, expect, it } from 'vitest'
import { message } from '../../api/_notify.js'
import { dosesFor, planLabel, weekdayOf, type Supplement } from './supplements'

const sup = (id: string, times: string[], days = [0, 1, 2, 3, 4, 5, 6]): Supplement => ({
  id,
  user_id: 'u',
  name: id,
  dose: '5 g',
  times,
  days,
  remind: true,
  position: 0,
  created_at: '',
})

describe('Supplemente', () => {
  it('Wochentag', () => {
    expect(weekdayOf('2026-10-12')).toBe(0) // Montag
    expect(weekdayOf('2026-10-18')).toBe(6)
  })
  it('Einnahmen eines Tages, sortiert und abgehakt', () => {
    const list = [sup('Magnesium', ['21:00']), sup('Kreatin', ['08:00', '20:00']), sup('Whey', ['18:00'], [0, 2, 4])]
    const d = dosesFor('2026-10-13', list, [{ supplement_id: 'Kreatin', date: '2026-10-13', slot: '08:00' }])
    expect(d.map((x) => `${x.slot} ${x.supplement.name} ${x.taken ? '✓' : ''}`.trim())).toEqual([
      '08:00 Kreatin ✓',
      '20:00 Kreatin',
      '21:00 Magnesium',
    ])
  })
  it('Plan-Text', () => {
    expect(planLabel({ times: ['20:00', '08:00'], days: [0, 1, 2, 3, 4, 5, 6] })).toBe('täglich 08:00 & 20:00')
    expect(planLabel({ times: ['18:00'], days: [0, 1, 2, 3, 4] })).toBe('Mo–Fr 18:00')
    expect(planLabel({ times: ['18:00'], days: [4, 0, 2] })).toBe('Mo, Mi, Fr 18:00')
  })
  it('Erinnerung mit „Genommen“-Knopf', () => {
    const m = message('supplement', { id: 'abc', slot: '08:00', name: 'Kreatin', dose: '5 g' }) as unknown as {
      title: string
      actions: { url: string }[]
    }
    expect(m.title).toContain('Kreatin')
    expect(m.actions[0].url).toBe('/nutrition?supp=abc&slot=08:00')
  })
})
