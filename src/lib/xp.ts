// XP-/Level-System + Quests. Alles deterministisch aus den Trainingsdaten
// abgeleitet (nichts zu persistieren) — so bleibt es konsistent.

import type { SetWithDate } from '../types'
import { frequencyStats, isoWeekKey, onlyWorking, totalVolume } from './analytics'

export interface LevelInfo {
  level: number
  xp: number
  /** XP innerhalb des aktuellen Levels */
  xpInLevel: number
  /** XP-Bedarf für das aktuelle Level (Level-Breite) */
  xpForLevel: number
  /** 0..100 */
  progress: number
}

/** Kumulatives XP, um Level L zu erreichen (Level 1 = 0). */
export function cumulativeXp(level: number): number {
  return 50 * (level - 1) * level // 0, 100, 300, 600, 1000, ...
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1
  while (cumulativeXp(level + 1) <= xp) level++
  const base = cumulativeXp(level)
  const span = cumulativeXp(level + 1) - base
  const xpInLevel = xp - base
  return {
    level,
    xp,
    xpInLevel,
    xpForLevel: span,
    progress: span > 0 ? Math.round((xpInLevel / span) * 100) : 0,
  }
}

/** Gesamt-XP aus allen Sätzen. */
export function computeXp(sets: SetWithDate[]): number {
  const sessions = new Set(sets.map((s) => s.date)).size
  const workingSets = onlyWorking(sets).length
  const tonnage = totalVolume(sets)
  const streak = frequencyStats([...new Set(sets.map((s) => s.date))]).weekStreak
  return Math.round(sessions * 50 + workingSets * 3 + tonnage / 100 + streak * 25)
}

export interface Quest {
  id: string
  label: string
  done: boolean
  progress: number // 0..100
  xp: number
}

function quest(id: string, label: string, cur: number, goal: number, xp: number): Quest {
  return { id, label, done: cur >= goal, progress: Math.min(100, Math.round((cur / goal) * 100)), xp }
}

export function dailyQuests(sets: SetWithDate[], today: string): Quest[] {
  const todays = sets.filter((s) => s.date === today)
  const exercises = new Set(todays.map((s) => s.exercise_id)).size
  const working = onlyWorking(todays).length
  return [
    quest('train', 'Heute trainieren', todays.length > 0 ? 1 : 0, 1, 30),
    quest('ex3', '3 Übungen heute', exercises, 3, 20),
    quest('sets10', '10 Arbeitssätze heute', working, 10, 20),
  ]
}

export function weeklyQuests(sets: SetWithDate[], today = new Date()): Quest[] {
  const week = isoWeekKey(today.toISOString().slice(0, 10))
  const wSets = sets.filter((s) => isoWeekKey(s.date) === week)
  const sessions = new Set(wSets.map((s) => s.date)).size
  const volume = totalVolume(wSets)
  return [
    quest('w3', '3 Trainings diese Woche', sessions, 3, 60),
    quest('vol15', '15.000 kg Volumen diese Woche', volume, 15000, 80),
    quest('w4', '4 Trainings diese Woche', sessions, 4, 40),
  ]
}
