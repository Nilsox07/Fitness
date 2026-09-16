// Monats-Saison mit Battle-Pass-Belohnungsleiste. Deterministisch aus den Sätzen.

import type { SetWithDate } from '../types'
import { computeXp } from './xp'

const TIER_XP = 400

export const SEASON_REWARDS = [
  '🥉 Bronze-Abzeichen',
  '🎽 Season-Trikot',
  '🥈 Silber-Abzeichen',
  '🎨 Farbtupfer',
  '🥇 Gold-Abzeichen',
  '🦾 Season-Skin',
  '💎 Diamant',
  '👑 Champion',
]

export function seasonId(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function seasonName(d = new Date()): string {
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

/** Saison-XP = XP nur aus den Trainings des aktuellen Monats. */
export function seasonXp(sets: SetWithDate[], d = new Date()): number {
  const id = seasonId(d)
  return computeXp(sets.filter((s) => s.date.startsWith(id)))
}

export interface SeasonInfo {
  xp: number
  tier: number
  maxTier: number
  inTier: number
  perTier: number
  progress: number
  nextReward: string | null
}

export function seasonInfo(xp: number): SeasonInfo {
  const maxTier = SEASON_REWARDS.length
  const tier = Math.min(maxTier, Math.floor(xp / TIER_XP))
  const inTier = xp - tier * TIER_XP
  return {
    xp,
    tier,
    maxTier,
    inTier: Math.min(inTier, TIER_XP),
    perTier: TIER_XP,
    progress: tier >= maxTier ? 100 : Math.round((inTier / TIER_XP) * 100),
    nextReward: tier < maxTier ? SEASON_REWARDS[tier] : null,
  }
}

export function daysLeftInSeason(d = new Date()): number {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return Math.max(0, Math.ceil((end.getTime() - d.getTime()) / 86400000))
}
