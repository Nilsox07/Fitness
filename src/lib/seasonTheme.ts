// Saison-Thema des Monats (von /api/season) und Fortschritt der Saison-Quests.

import { monthlyPrCount, onlyPerformed, onlyWorking, totalVolume } from './analytics'
import type { SetWithDate } from '../types'

export type SeasonQuestType = 'sessions' | 'muscle' | 'protein_days' | 'logged_days' | 'water_days' | 'volume' | 'prs'

export interface SeasonQuest {
  type: SeasonQuestType
  target: number
  muscle?: string
  label: string
}

export interface SeasonTheme {
  id: string
  name: string
  emoji: string
  tagline: string
  badge: { emoji: string; label: string }
  quests: SeasonQuest[]
}

/** Saison-Muskelgruppe → Muskelgruppen der Übungen. */
const MUSCLE_MAP: Record<string, string[]> = {
  Beine: ['Beine', 'Beinbeuger', 'Waden', 'Gesäß'],
  Arme: ['Bizeps', 'Trizeps', 'Unterarme'],
  Brust: ['Brust'],
  Rücken: ['Rücken'],
  Schultern: ['Schultern'],
  Bauch: ['Bauch'],
}

export interface SeasonData {
  sets: SetWithDate[]
  muscleOf: (exerciseId: string) => string | undefined
  /** Ernährung je Tag (nur Tage mit Einträgen) */
  foodDays: Map<string, { protein: number }>
  proteinTarget: number
  /** getrunkene ml je Tag (Wasser + Getränke) */
  drankByDate: Map<string, number>
  waterTarget: number
  /** Stichtag im Monat (für Bestleistungen) */
  today: Date
}

const inMonth = (date: string, month: string) => date.startsWith(month)

export function seasonQuestValue(q: SeasonQuest, month: string, d: SeasonData): number {
  const sets = onlyPerformed(d.sets).filter((s) => inMonth(s.date, month))
  switch (q.type) {
    case 'sessions':
      return new Set(sets.map((s) => s.date)).size
    case 'muscle': {
      const groups = MUSCLE_MAP[q.muscle ?? ''] ?? [q.muscle ?? '']
      return new Set(sets.filter((s) => groups.includes(d.muscleOf(s.exercise_id) ?? '')).map((s) => s.date)).size
    }
    case 'protein_days':
      return d.proteinTarget > 0
        ? [...d.foodDays].filter(([date, v]) => inMonth(date, month) && v.protein >= d.proteinTarget).length
        : 0
    case 'logged_days':
      return [...d.foodDays.keys()].filter((date) => inMonth(date, month)).length
    case 'water_days':
      return [...d.drankByDate].filter(([date, ml]) => inMonth(date, month) && ml >= d.waterTarget).length
    case 'volume':
      return Math.round(totalVolume(onlyWorking(sets)))
    case 'prs':
      return monthlyPrCount(d.sets, d.today)
  }
}

export function seasonProgress(theme: SeasonTheme, d: SeasonData) {
  const quests = theme.quests.map((q) => {
    const value = seasonQuestValue(q, theme.id, d)
    return { ...q, value, done: value >= q.target, pct: Math.min(100, Math.round((value / q.target) * 100)) }
  })
  return { quests, done: quests.length > 0 && quests.every((q) => q.done) }
}

/** Tage bis Monatsende (inkl. heute). */
export function seasonDaysLeft(today = new Date()): number {
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return end.getDate() - today.getDate() + 1
}
