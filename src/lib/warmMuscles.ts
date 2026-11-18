// Welche Muskeln arbeitet eine Übung mit? Wichtig fürs Aufwärmen: Nach Rudern ist der Bizeps schon
// warm (kleiner Pump), nach Bankdrücken der Trizeps. Selbst angelegte Übungen haben oft keine
// „weiteren Muskeln“ eingetragen – dann aus der Übungsbibliothek bzw. dem Namen ableiten.
// Reine Logik – getestet in warmMuscles.test.ts.

import type { MuscleGroup } from '../types'

const has = (n: string, re: RegExp) => re.test(n)

/** Mitarbeitende Muskeln aus dem Namen (deutsch/englisch), passend zur Hauptgruppe. */
export function secondaryFromName(name: string, group: MuscleGroup): MuscleGroup[] {
  const n = name.toLowerCase()
  const out = new Set<MuscleGroup>()
  // Drücken: Trizeps (+ vordere Schulter bei Brust)
  if (has(n, /dr(ü|ue)ck|press|dip|liegest(ü|ue)tz|push/) && !has(n, /bein|leg|wade|calf/)) {
    out.add('Trizeps')
    if (group === 'Brust') out.add('Schultern')
  }
  // Ziehen: Bizeps + Unterarme (+ hintere Schulter beim Rudern)
  if (
    has(n, /ruder|row|klimm|pull|\bchin|latzug|\blat(?!eral)/) &&
    !has(n, /trizeps|triceps|push/) &&
    group !== 'Bizeps'
  ) {
    if (group === 'Rücken' || group === 'Schultern') {
      out.add('Bizeps')
      out.add('Unterarme')
    }
    if (has(n, /ruder|row|face/) && group === 'Rücken') out.add('Schultern')
  }
  // Beine: Kniebeuge/Presse/Ausfallschritt → Gesäß
  if (has(n, /kniebeug|squat|beinpress|leg press|ausfall|lunge|hack|split|step/)) {
    out.add('Gesäß')
    if (group === 'Gesäß') out.add('Beine')
  }
  // Hüftstrecken: Kreuzheben, RDL, Hip Thrust
  if (has(n, /kreuzheb|deadlift|rdl|rum(ä|ae)n|good ?morning|hip ?thrust|hyperext/)) {
    out.add('Gesäß')
    out.add('Beinbeuger')
    if (!has(n, /hip ?thrust/)) out.add('Rücken')
  }
  if (has(n, /curl/) && group === 'Bizeps') out.add('Unterarme')
  if (has(n, /butterfly|fly|flys|crossover|cross-over/) && group === 'Brust') out.add('Schultern')
  out.delete(group)
  return [...out]
}

/**
 * Mitarbeitende Muskeln einer Übung: eingetragene zuerst, sonst aus der Bibliothek, sonst aus dem Namen.
 * `library` = Nebenmuskeln des passenden Bibliotheks-Eintrags (falls bekannt).
 */
export function effectiveSecondary(
  ex: { name: string; muscle_group: MuscleGroup; secondary_muscles?: readonly MuscleGroup[] | null },
  library?: readonly MuscleGroup[] | null,
): MuscleGroup[] {
  if (ex.secondary_muscles?.length) return [...ex.secondary_muscles]
  if (library?.length) return library.filter((m) => m !== ex.muscle_group)
  return secondaryFromName(ex.name, ex.muscle_group)
}
