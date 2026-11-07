import { describe, expect, it } from 'vitest'
import {
  buildOutcomes,
  defaultJournalDay,
  effectText,
  habitImpacts,
  journalStreak,
  trackedHabits,
  type JournalEntry,
} from './journal'
import { shiftDate } from './day'

const TODAY = '2026-11-07'

/** 20 Tage: jeden 3. Tag Alkohol → in der Nacht danach 45 min weniger Schlaf und HRV −15 %. */
function data(days = 20) {
  const entries: JournalEntry[] = []
  const sleep: { date: string; asleep_min: number }[] = []
  const daily: { date: string; hrv_ms: number; resting_hr: number }[] = []
  for (let i = days; i >= 1; i--) {
    const d = shiftDate(TODAY, -i)
    const drink = i % 3 === 0
    entries.push({ date: d, tags: drink ? ['alcohol', 'stress'] : i % 2 ? ['stress'] : [], feel: null })
    const next = shiftDate(d, 1)
    sleep.push({ date: next, asleep_min: drink ? 400 : 445 })
    daily.push({ date: next, hrv_ms: drink ? 51 : 60, resting_hr: drink ? 58 : 55 })
  }
  return { entries, sleep, daily }
}

describe('habitImpacts', () => {
  it('findet die Wirkung von Alkohol auf die Nacht danach', () => {
    const { entries, sleep, daily } = data()
    const out = habitImpacts(entries, buildOutcomes({ sleep, daily }), ['alcohol', 'stress'], TODAY)
    const alc = out.find((h) => h.habit === 'alcohol')!
    expect(alc.status).toBe('ready')
    if (alc.status !== 'ready') return
    expect(alc.main).not.toBeNull()
    expect(alc.main!.better).toBe(false)
    const s = alc.effects.find((e) => e.outcome === 'sleep')!
    expect(Math.round(s.diff)).toBe(-45)
    expect(effectText(s)).toBe('45 min weniger Schlaf')
    const h = alc.effects.find((e) => e.outcome === 'hrv')!
    expect(effectText(h)).toBe('HRV 15 % niedriger')
    // Alkohol mit Wirkung steht vor Stress
    expect(out[0].habit).toBe('alcohol')
  })

  it('braucht genug Tage mit und ohne', () => {
    const { entries, sleep } = data(6)
    const out = habitImpacts(entries, buildOutcomes({ sleep }), ['alcohol'], TODAY)
    expect(out[0].status).toBe('learning')
    if (out[0].status === 'learning') {
      expect(out[0].yesDays).toBe(2)
      expect(out[0].needYes).toBe(1)
    }
  })

  it('zählt ohne Uhr das Gefühl am Morgen', () => {
    const entries: JournalEntry[] = []
    for (let i = 20; i >= 0; i--) {
      const d = shiftDate(TODAY, -i)
      const prevLate = (i + 1) % 2 === 0 // Tag davor spät gegessen
      entries.push({ date: d, tags: i % 2 === 0 ? ['late_meal'] : [], feel: prevLate ? 2 : 4 })
    }
    const out = habitImpacts(entries, buildOutcomes({ entries }), ['late_meal'], TODAY)
    expect(out[0].status).toBe('ready')
    if (out[0].status === 'ready') {
      expect(out[0].main?.outcome).toBe('feel')
      expect(effectText(out[0].main!)).toBe('Morgens weniger ausgeruht')
    }
  })

  it('automatische Gewohnheiten zählen auch an Tagen ohne Eintrag', () => {
    const sleep: { date: string; asleep_min: number }[] = []
    const auto = new Map<string, string[]>()
    for (let i = 20; i >= 1; i--) {
      const d = shiftDate(TODAY, -i)
      const t = i % 2 === 0
      if (t) auto.set(d, ['trained'])
      sleep.push({ date: shiftDate(d, 1), asleep_min: t ? 470 : 440 })
    }
    const out = habitImpacts([], buildOutcomes({ sleep }), ['trained'], TODAY, auto)
    expect(out[0].status).toBe('ready')
    if (out[0].status === 'ready') expect(out[0].main?.better).toBe(true)
  })
})

describe('Journal-Helfer', () => {
  it('fragt vormittags nach gestern', () => {
    expect(defaultJournalDay(TODAY, 8)).toBe('2026-11-06')
    expect(defaultJournalDay(TODAY, 20)).toBe(TODAY)
  })
  it('filtert unbekannte und automatische Gewohnheiten', () => {
    expect(trackedHabits(['alcohol', 'trained', 'xyz'])).toEqual(['alcohol'])
    expect(trackedHabits(null).length).toBeGreaterThan(3)
  })
  it('zählt die Serie', () => {
    const e = (d: string): JournalEntry => ({ date: d, tags: ['stress'], feel: null })
    expect(journalStreak([e('2026-11-06'), e('2026-11-05'), e('2026-11-03')], TODAY)).toBe(2)
    expect(journalStreak([], TODAY)).toBe(0)
  })
})
