import { describe, expect, it } from 'vitest'
import { dayKind, easterSunday, germanHolidays, predictWake, wakeDateFor } from './wakeRhythm'
import { shiftDate } from './day'

/** Nacht, die am `date` um `hhmm` (Ortszeit) endet */
const night = (date: string, hhmm: string) => ({
  end_at: new Date(`${date}T${hhmm.padStart(5, '0')}:00`).toISOString(),
})

/** Nächte rückwärts ab `until` (exklusiv): Werktage `work`, Wochenende/Feiertage `free` */
function weeks(until: string, days: number, work: string, free: string, special: Record<number, string> = {}) {
  const out = []
  for (let i = 1; i <= days; i++) {
    const d = shiftDate(until, -i)
    const wd = (new Date(d + 'T12:00:00').getDay() + 6) % 7
    out.push(night(d, special[wd] ?? (dayKind(d).free ? free : work)))
  }
  return out
}

describe('Feiertage', () => {
  it('Ostern und bewegliche Feiertage', () => {
    expect(easterSunday(2026)).toBe('2026-04-05')
    expect(easterSunday(2027)).toBe('2027-03-28')
    const h = germanHolidays(2026)
    expect(h.get('2026-04-03')).toBe('Karfreitag')
    expect(h.get('2026-05-14')).toBe('Christi Himmelfahrt')
    expect(h.get('2026-05-25')).toBe('Pfingstmontag')
    expect(h.get('2026-10-03')).toBe('Tag der Deutschen Einheit')
  })
  it('Wochenende und Feiertag sind frei', () => {
    expect(dayKind('2026-11-21').free).toBe(true) // Samstag
    expect(dayKind('2026-11-19').free).toBe(false) // Donnerstag
    expect(dayKind('2026-12-25')).toEqual({ free: true, holiday: '1. Weihnachtstag' })
  })
})

describe('Aufstehzeit nach Rhythmus', () => {
  const nights = weeks('2026-11-19', 35, '6:30', '9:00')

  it('Werktag früh, Wochenende länger', () => {
    expect(predictWake(nights, '2026-11-20')).toMatchObject({ wake: '6:30', free: false })
    const sat = predictWake(nights, '2026-11-21')!
    expect(sat).toMatchObject({ wake: '9:00', free: true })
    expect(sat.reason).toMatch(/Samstag/)
  })

  it('Feiertag unter der Woche wie ein freier Tag', () => {
    const n = weeks('2026-12-24', 35, '6:30', '9:00')
    const g = predictWake(n, '2026-12-25')!
    expect(g.wake).toBe('9:00')
    expect(g.reason).toMatch(/Weihnachtstag/)
  })

  it('fester anderer Tag: freitags frei', () => {
    const n = weeks('2026-11-19', 35, '6:30', '9:00', { 4: '8:30' })
    expect(predictWake(n, '2026-11-20')!.wake).toBe('8:30')
    expect(predictWake(n, '2026-11-19')!.wake).toBe('6:30')
  })

  it('Urlaub: die letzten Werktage später → neuer Rhythmus', () => {
    const n = weeks('2026-11-19', 35, '6:30', '9:00').map((x, i) =>
      i < 4
        ? night(shiftDate('2026-11-19', -(i + 1)), dayKind(shiftDate('2026-11-19', -(i + 1))).free ? '9:00' : '8:45')
        : x,
    )
    const g = predictWake(n, '2026-11-19')!
    expect(g.wake).toBe('8:45')
    expect(g.reason).toMatch(/später/)
  })

  it('feste Zeit gilt für Werktage, freie Tage lernen weiter', () => {
    expect(predictWake(nights, '2026-11-20', '6:00')!.wake).toBe('6:00')
    expect(predictWake(nights, '2026-11-21', '6:00')!.wake).toBe('9:00')
    // ohne Daten: frei = feste Zeit + 1 h
    expect(predictWake([], '2026-11-21', '6:00')!.wake).toBe('7:00')
    expect(predictWake([], '2026-11-20')).toBeNull()
  })

  it('nach Mitternacht zählt noch die laufende Nacht', () => {
    expect(wakeDateFor(new Date('2026-11-20T01:30:00'))).toBe('2026-11-20')
    expect(wakeDateFor(new Date('2026-11-20T21:30:00'))).toBe('2026-11-21')
  })
})
