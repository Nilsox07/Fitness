// Ernährungs-Gamification: Level/XP, Streak, Quests, Badges — deterministisch
// aus den Ernährungsdaten abgeleitet (analog zur Fitness-Gamification in xp.ts).

import type { FoodEntry } from '../types'
import type { Quest } from './xp'

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function quest(id: string, label: string, cur: number, goal: number, xp: number): Quest {
  return { id, label, done: cur >= goal, progress: Math.min(100, Math.round((cur / goal) * 100)), xp }
}

interface DayTotals {
  kcal: number
  protein: number
}

/** Tageswerte je Datum. */
export function byDay(entries: FoodEntry[]): Map<string, DayTotals> {
  const m = new Map<string, DayTotals>()
  for (const e of entries) {
    const d = m.get(e.date) ?? { kcal: 0, protein: 0 }
    d.kcal += e.kcal
    d.protein += e.protein
    m.set(e.date, d)
  }
  return m
}

/** Log-Streak: aufeinanderfolgende Tage mit Eintrag, bis heute (mit Kulanz für heute). */
export function nutritionStreak(dates: Set<string>, today: string): number {
  let streak = 0
  const d = new Date(today)
  if (!dates.has(today)) d.setDate(d.getDate() - 1) // heute noch nicht geloggt → ab gestern zählen
  while (dates.has(ymd(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** Gesamt-XP aus der Ernährungshistorie. */
export function computeNutritionXp(entries: FoodEntry[], proteinTarget: number, today: string): number {
  const days = byDay(entries)
  const daysLogged = days.size
  const proteinDays = proteinTarget > 0
    ? [...days.values()].filter((d) => d.protein >= proteinTarget).length
    : 0
  const streak = nutritionStreak(new Set(days.keys()), today)
  return Math.round(daysLogged * 20 + proteinDays * 15 + streak * 20)
}

export interface NutritionQuestInput {
  loggedToday: boolean
  protein: number
  proteinTarget: number
  kcal: number
  kcalTarget: number
  waterMl: number
  waterTarget: number
}

export function nutritionDailyQuests(i: NutritionQuestInput): Quest[] {
  const inRange = i.kcalTarget > 0 && Math.abs(i.kcal - i.kcalTarget) <= 200 ? 1 : 0
  return [
    quest('nlog', 'Essen geloggt', i.loggedToday ? 1 : 0, 1, 20),
    quest('nprot', 'Eiweißziel erreicht', i.protein, Math.max(1, i.proteinTarget), 25),
    quest('nwater', 'Wasserziel erreicht', i.waterMl, Math.max(1, i.waterTarget), 15),
    quest('nkcal', 'Im Kalorienrahmen (±200)', inRange, 1, 20),
  ]
}

export function nutritionWeeklyQuests(
  entries: FoodEntry[],
  proteinTarget: number,
  today = new Date(),
): Quest[] {
  // Diese Kalenderwoche (Mo–So)
  const day = today.getDay() || 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day - 1))
  const start = ymd(monday)
  const days = [...byDay(entries).entries()].filter(([d]) => d >= start)
  const logged = days.length
  const proteinDays = proteinTarget > 0 ? days.filter(([, v]) => v.protein >= proteinTarget).length : 0
  return [
    quest('nw5', '5 Tage geloggt', logged, 5, 60),
    quest('nwp5', '5× Eiweißziel getroffen', proteinDays, 5, 70),
  ]
}

export interface NutritionBadge {
  id: string
  label: string
  icon: string
  done: boolean
}

export function nutritionAchievements(stats: {
  daysLogged: number
  streak: number
  proteinDays: number
  waterGoalDays: number
}): NutritionBadge[] {
  const b = (id: string, label: string, icon: string, done: boolean): NutritionBadge => ({
    id,
    label,
    icon,
    done,
  })
  return [
    b('first', 'Erster Log', '🍽️', stats.daysLogged >= 1),
    b('week', '7 Tage geloggt', '📆', stats.daysLogged >= 7),
    b('month', '30 Tage geloggt', '🗓️', stats.daysLogged >= 30),
    b('streak7', '7er-Streak', '🔥', stats.streak >= 7),
    b('streak30', '30er-Streak', '🌋', stats.streak >= 30),
    b('protein10', '10× Eiweißziel', '🥩', stats.proteinDays >= 10),
    b('protein50', '50× Eiweißziel', '💪', stats.proteinDays >= 50),
    b('hydro', 'Wasserziel-Held', '💧', stats.waterGoalDays >= 7),
  ]
}
