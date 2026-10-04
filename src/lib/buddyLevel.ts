// Buddy-Level (neue App): EIN Level für alles. XP = Trainings-XP (+ Ernährungs-XP,
// wenn Ernährungstracking an ist). Deterministisch aus den Daten abgeleitet,
// Level-Kurve wie bisher (`levelInfo`).

import type { FoodEntry, SetWithDate } from '../types'
import { computeXp, levelInfo, type LevelInfo } from './xp'
import { computeNutritionXp } from './nutritionXp'

export interface BuddyXpInput {
  sets: SetWithDate[]
  foodEntries: FoodEntry[]
  proteinTarget: number
  showNutrition: boolean
  /** YYYY-MM-DD (lokal) */
  today?: string
}

export interface BuddyXpParts {
  fitness: number
  nutrition: number
  total: number
}

/** XP-Anteile: Training + (optional) Ernährung. */
export function buddyXpParts(i: BuddyXpInput): BuddyXpParts {
  const fitness = computeXp(i.sets)
  const nutrition = i.showNutrition ? computeNutritionXp(i.foodEntries, i.proteinTarget, i.today) : 0
  return { fitness, nutrition, total: fitness + nutrition }
}

/** Gesamt-XP des Buddys. */
export function buddyXp(i: BuddyXpInput): number {
  return buddyXpParts(i).total
}

/** Level-Info des Buddys (gleiche Kurve wie das bisherige Fitness-Level). */
export function buddyLevelInfo(i: BuddyXpInput): LevelInfo {
  return levelInfo(buddyXp(i))
}

/** localStorage-Schlüssel für den zuletzt gefeierten Buddy-Level. */
export const SEEN_BUDDY_LEVEL_KEY = 'seen_buddy_level'

type KV = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Prüft, ob ein Level-up gefeiert werden soll, und merkt sich den Level.
 * - Erster Aufruf (noch kein Wert gespeichert): aktuellen Level übernehmen, NICHT
 *   feiern — so bekommt beim Umstieg auf das Buddy-Level niemand ein falsches Level-up.
 * - Der gespeicherte Level sinkt nie (z. B. Ernährung kurz ausgeblendet oder Eintrag
 *   gelöscht) — sonst gäbe es beim Wiederaufstieg erneut Konfetti.
 * Nur mit vollständig geladenen Daten aufrufen.
 */
export function checkBuddyLevelUp(level: number, storage: KV = localStorage): boolean {
  try {
    const raw = storage.getItem(SEEN_BUDDY_LEVEL_KEY)
    const seen = raw == null ? NaN : Number(raw)
    if (!Number.isFinite(seen)) {
      storage.setItem(SEEN_BUDDY_LEVEL_KEY, String(level))
      return false
    }
    if (level > seen) {
      storage.setItem(SEEN_BUDDY_LEVEL_KEY, String(level))
      return true
    }
    return false
  } catch {
    return false
  }
}
