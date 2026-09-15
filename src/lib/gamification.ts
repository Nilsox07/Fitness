// Spielerische Fortschritts-Elemente: Ränge, Maskottchen-Stufen, Achievements.
// Reine Logik (ohne UI/DB), damit testbar.

export interface Rank {
  level: number
  title: string
  /** Trainings bis zum nächsten Rang (null = höchster Rang). */
  toNext: number | null
}

const RANKS: { min: number; title: string }[] = [
  { min: 0, title: 'Frischling' },
  { min: 5, title: 'Gym-Neuling' },
  { min: 15, title: 'Hantel-Azubi' },
  { min: 30, title: 'Eisen-Enthusiast' },
  { min: 60, title: 'Hobby-Hulk' },
  { min: 100, title: 'Maschinen-Flüsterer' },
  { min: 200, title: 'Stahl-Veteran' },
  { min: 350, title: 'Eisen-Berserker' },
  { min: 600, title: 'Eisen-Gott' },
]

export function rankForSessions(sessions: number): Rank {
  let idx = 0
  for (let i = 0; i < RANKS.length; i++) if (sessions >= RANKS[i].min) idx = i
  const next = RANKS[idx + 1]
  return {
    level: idx + 1,
    title: RANKS[idx].title,
    toNext: next ? next.min - sessions : null,
  }
}

export function mascotStage(sessions: number): { emoji: string; label: string } {
  if (sessions >= 250) return { emoji: '🦾', label: 'Maschine' }
  if (sessions >= 120) return { emoji: '🏋️', label: 'Athlet' }
  if (sessions >= 60) return { emoji: '💪', label: 'Kraftpaket' }
  if (sessions >= 30) return { emoji: '🐤', label: 'im Aufbau' }
  if (sessions >= 10) return { emoji: '🐣', label: 'Küken' }
  return { emoji: '🥚', label: 'Frisch geschlüpft' }
}

export interface Achievement {
  id: string
  label: string
  icon: string
  done: boolean
}

export interface AchievementInput {
  sessions: number
  weekStreak: number
  tonnage: number
  maxWeight: number
  muscleCategoriesTrained: number
}

export function achievements(i: AchievementInput): Achievement[] {
  return [
    { id: 'first', icon: '🎉', label: 'Erstes Training', done: i.sessions >= 1 },
    { id: 's10', icon: '🔟', label: '10 Trainings', done: i.sessions >= 10 },
    { id: 's50', icon: '🏅', label: '50 Trainings', done: i.sessions >= 50 },
    { id: 's100', icon: '💯', label: '100 Trainings', done: i.sessions >= 100 },
    { id: 'streak4', icon: '🔥', label: '4 Wochen am Stück', done: i.weekStreak >= 4 },
    { id: 'streak12', icon: '🌋', label: '12 Wochen am Stück', done: i.weekStreak >= 12 },
    { id: 'w100', icon: '🏋️', label: '100 kg auf einer Übung', done: i.maxWeight >= 100 },
    { id: 'ton10', icon: '🐘', label: '10 Tonnen bewegt', done: i.tonnage >= 10000 },
    { id: 'ton100', icon: '🚚', label: '100 Tonnen bewegt', done: i.tonnage >= 100000 },
    { id: 'allround', icon: '🧩', label: 'Ganzkörper (4 Bereiche)', done: i.muscleCategoriesTrained >= 4 },
  ]
}
