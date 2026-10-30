import { describe, expect, it } from 'vitest'
import { addableWidgets, mergeLayout, moveItem, visibleLayout, withWatchWidgets, type Modules } from './dashboard'

const ALL: Modules = { training: true, nutrition: true, social: true, watch: true }
const NO_WATCH: Modules = { ...ALL, watch: false }

describe('Dashboard', () => {
  it('blendet Uhr-Widgets ohne Uhr komplett aus', () => {
    const v = visibleLayout(null, NO_WATCH)
    expect(v).not.toContain('readiness')
    expect(v).not.toContain('sleep')
    expect(v[0]).toBe('nextWorkout')
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
    expect(withWatchWidgets(['kcal'])).toEqual(['readiness', 'kcal', 'sleep', 'steps', 'lastActivity'])
    expect(withWatchWidgets(null)).toBeNull()
  })
})
