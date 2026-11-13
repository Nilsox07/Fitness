import { describe, expect, it } from 'vitest'
import {
  addableWidgets,
  mergeLayout,
  moveItem,
  packLayout,
  timeOk,
  visibleLayout,
  withWatchWidgets,
  type Modules,
} from './dashboard'

const ALL: Modules = { training: true, nutrition: true, social: true, watch: true }
const NO_WATCH: Modules = { ...ALL, watch: false }

describe('Dashboard', () => {
  it('blendet Uhr-Widgets ohne Uhr komplett aus', () => {
    const v = visibleLayout(null, NO_WATCH)
    expect(v).not.toContain('readiness')
    expect(v).not.toContain('sleep')
    expect(v[0]).toBe('kcal')
  })

  it('ohne Ernährung keine Ernährungs-Widgets, auch nicht zum Hinzufügen', () => {
    const mods = { ...NO_WATCH, nutrition: false }
    expect(visibleLayout(null, mods)).not.toContain('kcal')
    expect(addableWidgets(null, mods).map((w) => w.id)).not.toContain('supplements')
  })

  it('ignoriert Unbekanntes und Doppeltes', () => {
    expect(visibleLayout(['kcal', 'kcal', 'gibtsnicht', 'water'], ALL)).toEqual(['kcal', 'water'])
  })

  it('behält ausgeblendete Widgets beim Umsortieren', () => {
    const saved = ['sleep', 'kcal', 'water']
    const merged = mergeLayout(saved, ['water', 'kcal'], NO_WATCH)
    expect(merged).toEqual(['water', 'kcal', 'sleep'])
  })

  it('verschiebt und ergänzt Uhr-Widgets', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(withWatchWidgets(['kcal'])).toEqual(['steps', 'kcal', 'sleep'])
    expect(withWatchWidgets(null)).toBeNull()
  })
})

describe('Dashboard und Uhr-Fähigkeiten', () => {
  it('jede Widget-ID hat eine Definition', async () => {
    const { WIDGETS, DEFAULT_LAYOUT } = await import('./dashboard')
    const ids = new Set(WIDGETS.map((w) => w.id))
    for (const id of [...DEFAULT_LAYOUT, 'heart', 'cardioWeek', 'lastWorkout']) expect(ids.has(id as never)).toBe(true)
  })

  it('blendet Widgets aus, die die Uhr nicht liefert – erst wenn Daten da sind', async () => {
    const { visibleLayout, addableWidgets } = await import('./dashboard')
    const none = {
      sleep: false,
      stages: false,
      hrv: false,
      restingHr: false,
      steps: false,
      spo2: false,
      activities: false,
      hrSeries: false,
    }
    const ALLM = { training: true, nutrition: true, social: true, watch: true }
    // noch nichts synchronisiert → alles zeigen
    expect(visibleLayout(null, ALLM, { known: false, has: none })).toContain('sleep')
    // Uhr ohne Schlaf, aber mit Schritten
    const caps = { known: true, has: { ...none, steps: true, restingHr: true } }
    const v = visibleLayout(null, ALLM, caps)
    expect(v).not.toContain('sleep')
    expect(v).toContain('steps')
    // Tagesform steht oben in der Hero-Karte, ist aber weiter hinzufügbar (Ruhepuls reicht)
    expect(addableWidgets(null, ALLM, caps).map((w) => w.id)).toContain('readiness')
    expect(addableWidgets(null, ALLM, caps).map((w) => w.id)).toContain('heart')
  })
})

describe('Hybrid-Bereich', () => {
  it('Ausdauer-Plan nur mit Hybrid, unabhängig von Ernährung', async () => {
    const { visibleLayout } = await import('./dashboard')
    const base = { training: true, social: false, watch: false }
    for (const nutrition of [true, false]) {
      expect(visibleLayout(['cardioPlan', 'nextWorkout'], { ...base, nutrition, hybrid: false })).toEqual([
        'nextWorkout',
      ])
      expect(visibleLayout(['cardioPlan', 'nextWorkout'], { ...base, nutrition, hybrid: true })).toEqual([
        'cardioPlan',
        'nextWorkout',
      ])
    }
    expect(visibleLayout(['kcal', 'water'], { ...base, nutrition: false, hybrid: true })).toEqual([])
  })
})

describe('Heute schlank', () => {
  it('halbe Kacheln paarweise, eine allein wird breit', () => {
    const size = (id: string) => (id === 'kcal' ? 'full' : 'half') as 'full' | 'half'
    expect(packLayout(['kcal', 'water', 'steps', 'streak'] as never, size)).toEqual([true, false, false, true])
    expect(packLayout(['water', 'kcal', 'steps'] as never, size)).toEqual([true, true, true])
    expect(packLayout(['water', 'steps'] as never, size)).toEqual([false, false])
  })

  it('Schlafenszeit erst ab dem Nachmittag', () => {
    expect(timeOk('bedtime', 9)).toBe(false)
    expect(timeOk('bedtime', 18)).toBe(true)
    expect(timeOk('kcal', 9)).toBe(true)
  })

  it('Standard ohne Uhr und Ernährung: nur die Serie', () => {
    expect(visibleLayout(null, { training: true, nutrition: false, social: true, watch: false })).toEqual(['streak'])
  })
})
