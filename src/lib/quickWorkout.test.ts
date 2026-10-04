import libraryRaw from '../../public/exercise-library.json?raw'
import { describe, expect, it } from 'vitest'
import type { LibraryExercise } from './exerciseLibrary'
import {
  QUICK_MINUTES,
  QUICK_PRESETS,
  buildIntervals,
  candidatePool,
  estimateKcal,
  estimateReps,
  familyOf,
  generateQuickWorkout,
  mmss,
  planStructure,
  replaceStation,
  rng,
  swapCandidates,
  totalSeconds,
  type QuickConfig,
  type QuickFocus,
} from './quickWorkout'

const LIB = (JSON.parse(libraryRaw) as { exercises: LibraryExercise[] }).exercises
const byId = new Map(LIB.map((e) => [e.id, e]))

const base: QuickConfig = { minutes: 15, equipment: ['none'], focus: 'full', intensity: 'normal', seed: 1 }

describe('rng', () => {
  it('ist deterministisch pro Seed', () => {
    const a = rng(42)
    const b = rng(42)
    const xs = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(xs)
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(rng(43)()).not.toBe(xs[0])
  })
})

describe('totalSeconds / planStructure', () => {
  it('rechnet Aufwärmen, Pausen und Rundenpausen', () => {
    // 30 + 2 × (6×40 + 5×20) + 60 = 770
    expect(totalSeconds({ stations: 6, rounds: 2, work: 40, rest: 20, warmup: true })).toBe(770)
    expect(totalSeconds({ stations: 4, rounds: 1, work: 30, rest: 30, warmup: false })).toBe(210)
  })

  it('trifft die Wunschdauer für alle Stufen ungefähr', () => {
    for (const minutes of QUICK_MINUTES) {
      for (const intensity of ['easy', 'normal', 'hard'] as const) {
        const w = generateQuickWorkout(LIB, { ...base, minutes, intensity })
        expect(Math.abs(w.totalSeconds - minutes * 60)).toBeLessThanOrEqual(90)
      }
    }
  })

  it('nutzt ab 15 Minuten mehrere Runden mit 6–8 Stationen', () => {
    for (const minutes of [15, 20, 30]) {
      const s = planStructure({ ...base, minutes })
      expect(s.rounds).toBeGreaterThan(1)
      expect(s.stations).toBeGreaterThanOrEqual(6)
      expect(s.stations).toBeLessThanOrEqual(8)
    }
  })

  it('respektiert feste Vorgaben (7-Minuten-Klassiker)', () => {
    const p = QUICK_PRESETS.find((x) => x.id === 'classic7')!
    const w = generateQuickWorkout(LIB, { ...p.config, seed: 3 })
    expect(w.stations).toHaveLength(12)
    expect(w.rounds).toBe(1)
    expect(w.warmupId).toBeNull()
    expect(w.intervals.filter((i) => i.kind === 'work').every((i) => i.seconds === 30)).toBe(true)
    expect(w.intervals.filter((i) => i.kind === 'rest').every((i) => i.seconds === 10)).toBe(true)
  })
})

describe('buildIntervals', () => {
  it('ordnet Aufwärmen, Arbeit, Pausen und Rundenpausen', () => {
    const out = buildIntervals({ stations: ['a', 'b'], rounds: 2, work: 40, rest: 20, warmupId: 'w' })
    expect(out.map((i) => i.kind)).toEqual(['warmup', 'work', 'rest', 'work', 'roundRest', 'work', 'rest', 'work'])
    expect(out[0]).toMatchObject({ exerciseId: 'w', seconds: 30, round: 0 })
    expect(out[4]).toMatchObject({ seconds: 60, round: 2, station: 0 })
    expect(out[out.length - 1]).toMatchObject({ kind: 'work', exerciseId: 'b', round: 2, station: 1 })
  })
})

describe('generateQuickWorkout', () => {
  const foci: QuickFocus[] = ['full', 'upper', 'lower', 'core', 'cardio']

  it('ist deterministisch und mischt mit neuem Seed neu', () => {
    const a = generateQuickWorkout(LIB, base)
    const b = generateQuickWorkout(LIB, base)
    expect(b.stations).toEqual(a.stations)
    const others = [2, 3, 4, 5].map((seed) => generateQuickWorkout(LIB, { ...base, seed }).stations.join())
    expect(others.some((s) => s !== a.stations.join())).toBe(true)
  })

  it('wählt nur passende Übungen ohne Duplikate', () => {
    for (const focus of foci) {
      for (let seed = 1; seed <= 5; seed++) {
        const w = generateQuickWorkout(LIB, { ...base, focus, seed })
        expect(w.stations.length).toBeGreaterThanOrEqual(4)
        expect(new Set(w.stations).size).toBe(w.stations.length)
        for (const id of w.stations) {
          const ex = byId.get(id)!
          expect(ex.home).toBe(true)
          expect(ex.equipment).toBe('Körpergewicht')
          expect(ex.level).not.toBe('Profi')
        }
        if (w.warmupId) expect(w.stations).not.toContain(w.warmupId)
      }
    }
  })

  it('trainiert im Ganzkörper-Zirkel nie denselben Muskel direkt hintereinander', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = generateQuickWorkout(LIB, { ...base, seed })
      const muscles = w.stations.map((id) => byId.get(id)!.muscle)
      for (let i = 1; i < muscles.length; i++) expect(muscles[i]).not.toBe(muscles[i - 1])
    }
  })

  it('hält den Fokus ein', () => {
    const lower = generateQuickWorkout(LIB, { ...base, focus: 'lower' })
    for (const id of lower.stations) expect(['Beine', 'Beinbeuger', 'Gesäß', 'Waden']).toContain(byId.get(id)!.muscle)
    const core = generateQuickWorkout(LIB, { ...base, focus: 'core' })
    for (const id of core.stations) expect(byId.get(id)!.muscle).toBe('Bauch')
  })

  it('nutzt ausgewähltes Equipment', () => {
    const w = generateQuickWorkout(LIB, { ...base, equipment: ['dumbbell'], focus: 'upper' })
    const eq = w.stations.map((id) => byId.get(id)!.equipment)
    expect(eq.filter((e) => e === 'Kurzhantel').length).toBeGreaterThanOrEqual(3)
    expect(eq.every((e) => e === 'Kurzhantel' || e === 'Körpergewicht')).toBe(true)
  })

  it('wärmt mit Hampelmann o. Ä. auf', () => {
    const w = generateQuickWorkout(LIB, base)
    expect(w.warmupId).toBeTruthy()
    expect(w.intervals[0].kind).toBe('warmup')
  })

  it('funktioniert auch mit leerer Bibliothek', () => {
    const w = generateQuickWorkout([], base)
    expect(w.stations).toEqual([])
    expect(w.warmupId).toBeNull()
  })
})

describe('swap', () => {
  it('schlägt passende Alternativen ohne aktuelle Stationen vor und tauscht eine aus', () => {
    const w = generateQuickWorkout(LIB, base)
    const alts = swapCandidates(LIB, base, w.stations)
    expect(alts.length).toBeGreaterThan(0)
    expect(alts.some((a) => w.stations.includes(a.id))).toBe(false)
    const next = replaceStation(w, 1, alts[0].id)
    expect(next.stations[1]).toBe(alts[0].id)
    expect(next.totalSeconds).toBe(w.totalSeconds)
    expect(next.intervals.filter((i) => i.kind === 'work' && i.station === 1).every((i) => i.exerciseId === alts[0].id)).toBe(true)
  })

  it('Pool schließt ungeeignete Übungen aus', () => {
    const pool = candidatePool(LIB, base)
    expect(pool.some((e) => /bank|bench|partner|klimmz/i.test(e.name_de + e.name_en))).toBe(false)
  })
})

describe('Hilfen', () => {
  it('familyOf erkennt Varianten', () => {
    expect(familyOf({ name_de: 'Schräge Liegestütze', name_en: 'Incline Push-Up' })).toBe('pushup')
    expect(familyOf({ name_de: 'Reverse Crunch', name_en: 'Reverse Crunch' })).toBe('crunch')
    expect(familyOf({ name_de: 'Dead Bug', name_en: 'Dead Bug' })).toBeNull()
  })

  it('schätzt Wiederholungen und kcal', () => {
    expect(estimateReps(40)).toBe(13)
    expect(estimateReps(1)).toBe(1)
    // 8 MET × 75 kg × 0,25 h = 150
    expect(estimateKcal(900, 75)).toBe(150)
    expect(estimateKcal(900, 0)).toBe(150)
  })

  it('formatiert mm:ss', () => {
    expect(mmss(0)).toBe('0:00')
    expect(mmss(75)).toBe('1:15')
  })
})
