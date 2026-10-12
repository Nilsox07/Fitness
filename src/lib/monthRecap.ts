// Monats-Rückblick (für die teilbare Story-Karte). Reine Rechenlogik.

import { onlyPerformed, onlyWorking, totalVolume, monthlyPrCount, frequencyStats, sessionDates } from './analytics'
import { byDay } from './nutritionXp'
import type { FoodEntry, SetWithDate } from '../types'

export interface MonthRecap {
  month: string
  monthName: string
  sessions: number
  volume: number
  prs: number
  weekStreak: number
  topExercise: string | null
  loggedDays: number
  proteinDays: number
  weightChange: number | null
}

export function monthRecap(
  month: string,
  d: {
    sets: SetWithDate[]
    exerciseName: (id: string) => string | undefined
    food: FoodEntry[]
    proteinTarget: number
    weights: { date: string; kg: number }[]
  },
): MonthRecap {
  const inMonth = (date: string) => date.startsWith(month)
  const sets = onlyPerformed(d.sets).filter((s) => inMonth(s.date))
  const counts = new Map<string, number>()
  for (const s of onlyWorking(sets)) counts.set(s.exercise_id, (counts.get(s.exercise_id) ?? 0) + 1)
  const top = [...counts].sort((a, b) => b[1] - a[1])[0]
  const days = [...byDay(d.food)].filter(([date]) => inMonth(date))
  const w = d.weights.filter((x) => inMonth(x.date)).sort((a, b) => a.date.localeCompare(b.date))
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0)
  // Serie: Stand am Monatsende (bzw. heute)
  const until = d.sets.filter((s) => s.date <= `${month}-31`)
  return {
    month,
    monthName: new Date(y, m - 1, 15).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
    sessions: new Set(sets.map((s) => s.date)).size,
    volume: Math.round(totalVolume(onlyWorking(sets))),
    prs: monthlyPrCount(d.sets, lastDay < new Date() ? lastDay : new Date()),
    weekStreak: frequencyStats(sessionDates(until)).weekStreak,
    topExercise: top ? (d.exerciseName(top[0]) ?? null) : null,
    loggedDays: days.length,
    proteinDays: d.proteinTarget > 0 ? days.filter(([, v]) => v.protein >= d.proteinTarget).length : 0,
    weightChange: w.length >= 2 ? Math.round((w[w.length - 1].kg - w[0].kg) * 10) / 10 : null,
  }
}

/** Welcher Monat soll standardmäßig gezeigt werden? In den ersten 5 Tagen der Vormonat. */
export function defaultRecapMonth(today = new Date()): string {
  const d = today.getDate() <= 5 ? new Date(today.getFullYear(), today.getMonth() - 1, 15) : today
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
