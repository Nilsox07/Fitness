// Gemeinsames Tages-Kalorienziel für alle Ernährungsansichten (Ernährung, Tagesüberblick,
// Tagesliste, Auswertung, Quests). Ernährung zählt immer nach Kalendertag (lokal),
// genau wie die Essens-Einträge (date = lokales Datum).

/** An Trainingstagen etwas mehr Energie (v. a. Kohlenhydrate) einplanen. */
export const TRAINING_BONUS = 250

/** Wurde an diesem Kalendertag (YYYY-MM-DD) trainiert? */
export function trainedOn(date: string, allSets: readonly { date: string }[] | null | undefined): boolean {
  return (allSets ?? []).some((s) => s.date === date)
}

/**
 * Kalorienziel für einen Tag inkl. Trainingsbonus; 0 = kein Ziel gesetzt.
 * `bonus` = eigener Trainingsbonus aus den Einstellungen (Standard 250).
 */
export function kcalTargetFor(
  settings: { kcal_target: number | null } | null | undefined,
  trained: boolean,
  bonus: number = TRAINING_BONUS,
): number {
  const base = Number(settings?.kcal_target) || 0
  if (base <= 0) return 0
  return base + (trained ? Math.max(0, bonus) : 0)
}
