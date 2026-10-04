// Mahlzeit-Score (0–100) — rein deterministisch aus den Nährwerten berechnet,
// NICHT von der KI. So ist der Score reproduzierbar, testbar und reagiert live
// auf Änderungen (Portion, Zutaten entfernen, Grammzahl).
//
// Modell (bewusst einfach und erklärbar, angelehnt an gängige Empfehlungen):
//   Start 50 Punkte, dann Zu-/Abschläge:
//   • Eiweißdichte (g Eiweiß je 100 kcal):   ≥ 8 → +20 · 5–8 → +10 · 3–5 → 0 · < 3 → −5
//   • Ballaststoffe (g je 100 kcal):         ≥ 1,5 → +10 · ≥ 0,8 → +5
//   • Zucker-Anteil an den kcal (4 kcal/g):  > 25 % → −15 · > 15 % → −8
//   • Gesätt. Fett-Anteil (9 kcal/g):        > 12 % → −10 · > 8 % → −5
//   • Salz (g je 100 kcal, mind. 100 kcal):  > 0,5 → −10 · > 0,3 → −5
//   • „Sauber": kein Abzug bei Zucker/ges. Fett/Salz → +5
//   • Tagesbudget (wenn bekannt): Mahlzeit > Rest + 200 kcal → −10
//     (bei „Abnehmen"/„Recomp" −15, bei „Aufbauen" kein Abzug).
//   • Energiedichte (nur „Abnehmen"/„Recomp", wenn Gramm bekannt):
//     > 2,5 kcal/g → −5 · < 1,2 kcal/g → +5 (sättigt bei wenig Energie).
//   • Ernährungsweise (optional `diet`):
//     Keto: > 15 g KH je Mahlzeit → −12 · Low Carb: > 30 g KH → −8
//     Vegan/Vegetarisch/Pescetarisch: KI meldet passende tierische Zutat → −25
//     Unverarbeitet: KI-Verarbeitungsgrad 4 (NOVA-ähnlich) → −10 · 3 → −4
//   Ergebnis auf 0–100 begrenzt und gerundet.
//
// Salz wird auf mindestens 100 kcal bezogen, damit sehr kleine Portionen
// (z. B. ein Salat mit 40 kcal) nicht künstlich „salzig" wirken.

import type { NutritionGoal } from '../types'
import type { DietMacro, DietRestriction } from './dietStyle'

/** Von der KI erkannte Eigenschaften der Mahlzeit (optional). */
export interface MealFlags {
  /** Strengste enthaltene tierische Kategorie. */
  animal?: 'meat' | 'fish' | 'dairy_egg' | 'none'
  /** Verarbeitungsgrad 1 (unverarbeitet) … 4 (stark verarbeitet), NOVA-ähnlich. */
  processing?: number
}

export interface MealTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sat_fat: number
  salt: number
}

export type ScoreTone = 'great' | 'good' | 'ok' | 'poor'

export interface MealHighlight {
  kind: 'good' | 'warn'
  text: string
}

export interface MealScore {
  score: number
  label: string
  tone: ScoreTone
  highlights: MealHighlight[]
}

export interface MealScoreOptions {
  /** Ernährungsziel des Nutzers (aus nutrition_settings.goal). */
  goal?: NutritionGoal | null
  /** Noch offene kcal für den Tag VOR dieser Mahlzeit; null/undefined = unbekannt. */
  remainingKcal?: number | null
  /** Gesamtgewicht der Mahlzeit in g (für die Energiedichte), falls bekannt. */
  grams?: number | null
  /** Ernährungsweise des Nutzers (Makro-Stil + Einschränkungen). */
  diet?: { macro?: DietMacro | null; restrictions?: readonly DietRestriction[] | null } | null
  /** KI-Hinweise zur Mahlzeit (tierische Produkte, Verarbeitung). */
  flags?: MealFlags | null
}

/** Verstößt die tierische Kategorie gegen die Einschränkungen? → Warntext. */
export function restrictionViolation(
  restrictions: readonly DietRestriction[] | null | undefined,
  animal: MealFlags['animal'],
): string | null {
  if (!restrictions?.length || !animal || animal === 'none') return null
  if (restrictions.includes('vegan')) return 'Nicht vegan'
  if (restrictions.includes('vegetarian') && (animal === 'meat' || animal === 'fish')) return 'Nicht vegetarisch'
  if (restrictions.includes('pescetarian') && animal === 'meat') return 'Nicht pescetarisch'
  return null
}

/** Label und Farbton zu einem Score. */
export function scoreLabel(score: number): { label: string; tone: ScoreTone } {
  if (score >= 80) return { label: 'Sehr gut', tone: 'great' }
  if (score >= 65) return { label: 'Gut', tone: 'good' }
  if (score >= 45) return { label: 'Okay', tone: 'ok' }
  return { label: 'Eher ungünstig', tone: 'poor' }
}

const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)

export function scoreMeal(t: MealTotals, opts: MealScoreOptions = {}): MealScore {
  const kcal = pos(t.kcal)
  // Ohne Energie (Wasser, schwarzer Kaffee …) gibt es nichts zu bewerten.
  if (kcal <= 0) return { score: 50, ...scoreLabel(50), highlights: [] }

  const good: MealHighlight[] = []
  const warn: MealHighlight[] = []
  let score = 50

  // Eiweiß
  const proteinPer100 = (pos(t.protein) / kcal) * 100
  if (proteinPer100 >= 8) {
    score += 20
    good.push({ kind: 'good', text: 'Viel Eiweiß' })
  } else if (proteinPer100 >= 5) score += 10
  else if (proteinPer100 < 3) score -= 5

  // Ballaststoffe
  const fiberPer100 = (pos(t.fiber) / kcal) * 100
  if (fiberPer100 >= 1.5) {
    score += 10
    good.push({ kind: 'good', text: 'Ballaststoffreich' })
  } else if (fiberPer100 >= 0.8) score += 5

  let penalized = false

  // Zucker
  const sugarShare = (pos(t.sugar) * 4) / kcal
  if (sugarShare > 0.25) {
    score -= 15
    penalized = true
    warn.push({ kind: 'warn', text: 'Viel Zucker' })
  } else if (sugarShare > 0.15) {
    score -= 8
    penalized = true
  }

  // Gesättigte Fettsäuren
  const satShare = (pos(t.sat_fat) * 9) / kcal
  if (satShare > 0.12) {
    score -= 10
    penalized = true
    warn.push({ kind: 'warn', text: 'Viel gesättigtes Fett' })
  } else if (satShare > 0.08) {
    score -= 5
    penalized = true
  }

  // Salz
  const saltPer100 = (pos(t.salt) / Math.max(kcal, 100)) * 100
  if (saltPer100 > 0.5) {
    score -= 10
    penalized = true
    warn.push({ kind: 'warn', text: 'Salzig' })
  } else if (saltPer100 > 0.3) {
    score -= 5
    penalized = true
  }

  if (!penalized) score += 5

  const goal = opts.goal ?? null
  const cutting = goal === 'lose' || goal === 'recomp'

  // Energiedichte — beim Abnehmen zählt Sättigung pro kcal mehr
  const grams = pos(opts.grams ?? 0)
  if (cutting && grams > 0) {
    const density = kcal / grams
    if (density > 2.5) score -= 5
    else if (density < 1.2) score += 5
  }

  // Passt die Mahlzeit ins Tagesbudget?
  const remaining = opts.remainingKcal
  if (remaining != null && Number.isFinite(remaining)) {
    if (kcal > remaining + 200) {
      if (goal !== 'gain') {
        score -= cutting ? 15 : 10
        warn.push({ kind: 'warn', text: 'Sprengt dein Tagesbudget' })
      }
    } else if (kcal <= remaining) {
      good.push({ kind: 'good', text: 'Passt in dein Tagesbudget' })
    }
  }

  // Ernährungsweise
  const diet = opts.diet ?? null
  const dietWarn: MealHighlight[] = []
  const carbs = pos(t.carbs)
  if (diet?.macro === 'keto') {
    if (carbs > 15) {
      score -= 12
      dietWarn.push({ kind: 'warn', text: 'Zu viele KH für Keto' })
    } else good.push({ kind: 'good', text: 'Keto-tauglich' })
  } else if (diet?.macro === 'low_carb') {
    if (carbs > 30) {
      score -= 8
      dietWarn.push({ kind: 'warn', text: 'Viele KH für Low Carb' })
    } else good.push({ kind: 'good', text: 'Low-Carb-tauglich' })
  }
  const flags = opts.flags ?? null
  const violation = restrictionViolation(diet?.restrictions, flags?.animal)
  if (violation) {
    score -= 25
    dietWarn.push({ kind: 'warn', text: violation })
  }
  const processing = typeof flags?.processing === 'number' ? flags.processing : NaN
  if (diet?.restrictions?.includes('unprocessed') && Number.isFinite(processing)) {
    if (processing >= 4) {
      score -= 10
      dietWarn.push({ kind: 'warn', text: 'Stark verarbeitet' })
    } else if (processing >= 3) score -= 4
    else if (processing <= 1) good.push({ kind: 'good', text: 'Unverarbeitet' })
  }

  const final = Math.max(0, Math.min(100, Math.round(score)))
  return { score: final, ...scoreLabel(final), highlights: [...good, ...dietWarn, ...warn] }
}
