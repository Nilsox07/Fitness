import { beforeEach, describe, expect, it } from 'vitest'
import { endWorkout, isWorkoutRunning, touchWorkout } from './activeWorkout'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage
})

describe('activeWorkout', () => {
  it('erkennt ein laufendes Training', () => {
    touchWorkout('2026-10-12')
    expect(isWorkoutRunning(Date.now(), '2026-10-12')).toBe(true)
  })
  it('nicht mehr laufend nach Beenden, am nächsten Tag oder nach 3 h Pause', () => {
    touchWorkout('2026-10-12')
    expect(isWorkoutRunning(Date.now(), '2026-10-13')).toBe(false)
    expect(isWorkoutRunning(Date.now() + 4 * 3600_000, '2026-10-12')).toBe(false)
    endWorkout()
    expect(isWorkoutRunning(Date.now(), '2026-10-12')).toBe(false)
  })
})
