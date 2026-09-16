// Streak mit „Freeze" (Duolingo-Style) + perfekte Wochen.

import { isoWeekKey } from './analytics'

const PERFECT_MIN = 4 // Trainings/Woche für eine „perfekte Woche"

function daysPerWeek(dates: string[]): Map<string, number> {
  const byWeek = new Map<string, Set<string>>()
  for (const d of dates) {
    const w = isoWeekKey(d)
    ;(byWeek.get(w) ?? byWeek.set(w, new Set()).get(w)!).add(d)
  }
  const out = new Map<string, number>()
  for (const [w, set] of byWeek) out.set(w, set.size)
  return out
}

/** Streak in Wochen; eine Woche zählt, wenn trainiert ODER eingefroren. */
export function weekStreakWithFreezes(
  dates: string[],
  frozen: string[],
  today = new Date(),
): number {
  const weeks = new Set(dates.map(isoWeekKey))
  const fset = new Set(frozen)
  let streak = 0
  const cursor = new Date(today)
  for (;;) {
    const key = isoWeekKey(cursor.toISOString().slice(0, 10))
    if (weeks.has(key) || fset.has(key)) {
      streak++
      cursor.setUTCDate(cursor.getUTCDate() - 7)
    } else break
  }
  return streak
}

export function perfectWeeksCount(dates: string[]): number {
  let n = 0
  for (const c of daysPerWeek(dates).values()) if (c >= PERFECT_MIN) n++
  return n
}

/** Abgeschlossene (nicht aktuelle) perfekte Wochen, aufsteigend sortiert. */
export function completedPerfectWeeks(dates: string[], today = new Date()): string[] {
  const current = isoWeekKey(today.toISOString().slice(0, 10))
  return [...daysPerWeek(dates).entries()]
    .filter(([w, c]) => c >= PERFECT_MIN && w !== current)
    .map(([w]) => w)
    .sort()
}

export function trainedThisWeek(dates: string[], today = new Date()): boolean {
  const current = isoWeekKey(today.toISOString().slice(0, 10))
  return dates.some((d) => isoWeekKey(d) === current)
}

export function currentWeekKey(today = new Date()): string {
  return isoWeekKey(today.toISOString().slice(0, 10))
}
