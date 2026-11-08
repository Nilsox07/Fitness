import { describe, expect, it } from 'vitest'
import { HYBRID_TEMPLATES, bestRun, clock, normalizeRuns, splitsFrom, summarize, templateById } from './hybridSessions'

describe('Hybrid-Einheiten', () => {
  it('Vorlagen sind vollständig und wechseln Lauf/Station', () => {
    const full = templateById('race-full')!
    expect(full.parts).toHaveLength(16)
    expect(full.parts[0].kind).toBe('run')
    expect(full.parts[1]).toEqual({ kind: 'station', name: 'SkiErg', target: '1000 m' })
    expect(new Set(HYBRID_TEMPLATES.map((t) => t.id)).size).toBe(HYBRID_TEMPLATES.length)
    expect(templateById('nix')).toBeNull()
  })

  it('Uhrzeit-Format', () => {
    expect(clock(75)).toBe('1:15')
    expect(clock(3725)).toBe('1:02:05')
    expect(clock(-3)).toBe('0:00')
  })

  it('Zwischenzeiten aus Zeitstempeln, Pausen abgezogen', () => {
    expect(splitsFrom(0, [60_000, 150_000, 200_000], [0, 30_000])).toEqual([60, 60, 50])
  })

  it('Zusammenfassung: Lauf- und Stationszeit, langsamste Station', () => {
    const t = templateById('engine')!
    const s = summarize(t, [100, 60, 50, 110])
    expect(s.runTime).toBe(210)
    expect(s.stationTime).toBe(110)
    expect(s.slowest).toEqual({ name: 'Burpees', sec: 60 })
  })

  it('Bestzeit nur aus vollständigen Läufen', () => {
    const t = templateById('engine')!
    const n = t.parts.length
    const runs = [
      { template: 'engine', date: '2026-11-01', total: 1500, splits: Array(n).fill(100) },
      { template: 'engine', date: '2026-11-03', total: 1200, splits: Array(5).fill(100) },
      { template: 'engine', date: '2026-11-05', total: 1400, splits: Array(n).fill(90) },
    ]
    expect(bestRun(runs, t)?.date).toBe('2026-11-05')
  })

  it('gespeicherte Läufe prüfen', () => {
    expect(normalizeRuns('x')).toEqual([])
    expect(
      normalizeRuns([{ template: 'home', date: '2026-11-05', total: 99.6, splits: [1.4, 'a', 3] }, { date: 'bad' }]),
    ).toEqual([{ template: 'home', date: '2026-11-05', total: 100, splits: [1, 3] }])
  })
})
