import { describe, expect, it } from 'vitest'
import { volumeStat, workoutHeadline, workoutShare, wrapTwoLines, type WorkoutShareInput } from './shareCard'

const base: WorkoutShareInput = {
  title: 'Pull',
  date: new Date(2026, 10, 2),
  volumeKg: 6480,
  sets: 16,
  exercises: 5,
  minutes: 25,
  weekStreak: 1,
  record: null,
}

describe('Teilen-Bild', () => {
  it('Volumen in Tonnen bzw. kg', () => {
    expect(volumeStat(6480)).toEqual({ value: '6,5', label: 'Tonnen' })
    expect(volumeStat(850)).toEqual({ value: '850', label: 'kg bewegt' })
    expect(volumeStat(-3).value).toBe('0')
  })

  it('drei Kennzahlen, Minuten nur wenn plausibel', () => {
    expect(workoutShare(base).stats.map((s) => s.label)).toEqual(['Tonnen', 'Minuten', 'Sätze'])
    expect(workoutShare({ ...base, minutes: null }).stats.map((s) => s.label)).toEqual(['Tonnen', 'Sätze', 'Übungen'])
    expect(workoutShare({ ...base, minutes: 900 }).stats).toHaveLength(3)
  })

  it('Siegel: Rekord vor Serie, Serie erst ab 2 Wochen', () => {
    expect(workoutShare(base).seal).toBeNull()
    expect(workoutShare({ ...base, weekStreak: 8 }).seal).toEqual({ value: '8', label: 'Wochen' })
    expect(workoutShare({ ...base, weekStreak: 8, record: 'Klimmzug' }).seal?.label).toBe('Rekord')
  })

  it('Schlagzeile passt zur Lage und bleibt stabil', () => {
    expect(workoutHeadline({ ...base, record: 'Bank' })).toMatch(/Rekord|Stärker/)
    expect(workoutHeadline(base)).toBe(workoutHeadline(base))
  })

  it('ohne Titel heißt es „Training“', () => {
    expect(workoutShare({ ...base, title: '  ' }).title).toBe('Training')
  })

  it('bricht auf höchstens zwei Zeilen um', () => {
    const m = (s: string) => s.length * 10
    expect(wrapTwoLines('Haken dran.', 500, m)).toEqual(['Haken dran.'])
    expect(wrapTwoLines('Dranbleiben zahlt sich aus.', 150, m)).toEqual(['Dranbleiben', 'zahlt sich aus.'])
    expect(wrapTwoLines('a b c d e f', 10, m)).toHaveLength(2)
  })
})
