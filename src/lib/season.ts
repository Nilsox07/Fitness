// Monats-Saison. Deterministisch aus den Sätzen.

import type { SetWithDate } from '../types'
import { computeXp } from './xp'

export function seasonId(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Saison-XP = XP nur aus den Trainings des aktuellen Monats. */
export function seasonXp(sets: SetWithDate[], d = new Date()): number {
  const id = seasonId(d)
  return computeXp(sets.filter((s) => s.date.startsWith(id)))
}
