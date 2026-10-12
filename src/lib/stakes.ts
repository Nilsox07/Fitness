// Wochen-Challenges mit Einsatz zwischen Freunden: reine Logik (Ausgang, Texte, eigener Wert).

import { onlyPerformed } from './analytics'
import { byDay } from './nutritionXp'
import { shiftDate } from './day'
import type { FoodEntry, SetWithDate } from '../types'

export type ChallengeKind = 'sessions' | 'protein_days' | 'logged_days'

export interface Challenge {
  id: string
  creator: string
  opponent: string
  kind: ChallengeKind
  target: number
  stake: string
  week_start: string
  status: 'pending' | 'active' | 'declined'
  creator_value: number
  opponent_value: number
  created_at: string
}

export const CHALLENGE_KINDS: { kind: ChallengeKind; label: string; unit: string; nutrition?: boolean }[] = [
  { kind: 'sessions', label: 'Trainings', unit: 'Trainings' },
  { kind: 'protein_days', label: 'Eiweißziel', unit: 'Tage Eiweißziel', nutrition: true },
  { kind: 'logged_days', label: 'Essen tracken', unit: 'Tage getrackt', nutrition: true },
]

export const STAKE_PRESETS = ['☕ Kaffee', '🥤 Proteinshake', '🍕 Pizza', '🍺 Getränk', '🧹 Gym-Tasche tragen']

/** Montag der Woche eines Datums (YYYY-MM-DD). */
export function weekStartOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
  return shiftDate(date, -wd)
}

export const weekEnd = (weekStart: string) => shiftDate(weekStart, 6)

/** Eigener Stand in der Challenge-Woche aus den eigenen Daten. */
export function ownValue(
  kind: ChallengeKind,
  weekStart: string,
  d: { sets: SetWithDate[]; food: FoodEntry[]; proteinTarget: number },
): number {
  const end = weekEnd(weekStart)
  const inWeek = (date: string) => date >= weekStart && date <= end
  if (kind === 'sessions')
    return new Set(
      onlyPerformed(d.sets)
        .filter((s) => inWeek(s.date))
        .map((s) => s.date),
    ).size
  const days = [...byDay(d.food)].filter(([date]) => inWeek(date))
  if (kind === 'logged_days') return days.length
  return d.proteinTarget > 0 ? days.filter(([, v]) => v.protein >= d.proteinTarget).length : 0
}

export type ChallengeOutcome = 'running' | 'both' | 'none' | 'me' | 'them'

/** Ausgang aus Sicht von `me`: wer hat sein Ziel geschafft? */
export function outcome(c: Challenge, me: string, today: string): ChallengeOutcome {
  const mine = c.creator === me ? c.creator_value : c.opponent_value
  const theirs = c.creator === me ? c.opponent_value : c.creator_value
  const iDid = mine >= c.target
  const theyDid = theirs >= c.target
  if (today <= weekEnd(c.week_start) && !(iDid && theyDid)) return 'running'
  if (iDid && theyDid) return 'both'
  if (!iDid && !theyDid) return 'none'
  return iDid ? 'me' : 'them'
}

export function outcomeText(o: ChallengeOutcome, stake: string, friend: string): string {
  switch (o) {
    case 'both':
      return `Beide geschafft – der Einsatz entfällt. Stark! 🙌`
    case 'none':
      return `Keiner hat's geschafft – ihr schuldet euch gegenseitig: ${stake}`
    case 'me':
      return `Du hast gewonnen – ${friend} schuldet dir: ${stake}`
    case 'them':
      return `${friend} hat gewonnen – du schuldest: ${stake}`
    default:
      return ''
  }
}
