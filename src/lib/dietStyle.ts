// Ernährungsweise („Diet Style"): EIN Makro-Stil + optionale Einschränkungen
// + optionales Intervallfasten. Wirkt auf Zielwerte (computeTargets), den
// Mahlzeit-Score (scoreMeal), alle KI-Prompts (dietContext in ai.ts) und den
// Fasten-Timer auf der Ernährungs-Startseite.
//
// Gespeichert in nutrition_settings (Migration 0027). Solange die Migration
// noch nicht ausgeführt ist, fehlen die Spalten — dann landet die Auswahl im
// localStorage (`diet_style_fallback`), damit nichts kaputtgeht.

export type DietMacro = 'balanced' | 'high_protein' | 'low_carb' | 'keto' | 'mediterranean'
export type DietRestriction = 'vegetarian' | 'vegan' | 'pescetarian' | 'unprocessed'
export type Fasting = 'none' | '16:8' | '18:6' | '20:4' | '5:2'

export interface DietStyle {
  macro: DietMacro
  restrictions: DietRestriction[]
  fasting: Fasting
  /** Beginn des Essensfensters „HH:MM" (nur bei täglichem Fasten relevant). */
  fastingStart: string
}

export const DIET_MACROS: DietMacro[] = ['balanced', 'high_protein', 'low_carb', 'keto', 'mediterranean']
export const DIET_RESTRICTIONS: DietRestriction[] = ['vegetarian', 'vegan', 'pescetarian', 'unprocessed']
export const FASTING_OPTIONS: Fasting[] = ['none', '16:8', '18:6', '20:4', '5:2']

export const DIET_MACRO_LABEL: Record<DietMacro, string> = {
  balanced: 'Ausgewogen',
  high_protein: 'High Protein',
  low_carb: 'Low Carb',
  keto: 'Keto',
  mediterranean: 'Mediterran',
}

export const DIET_MACRO_HINT: Record<DietMacro, string> = {
  balanced: 'Klassische Verteilung — Eiweiß nach Ziel, Rest aus KH & Fett.',
  high_protein: '2,2 g Eiweiß je kg — schützt Muskeln, sättigt lange.',
  low_carb: 'Nur ~22 % der Kalorien aus Kohlenhydraten, mehr Fett.',
  keto: 'Höchstens 30 g KH am Tag, Fett füllt den Rest auf.',
  mediterranean: '~35 % Fett, v. a. Olivenöl, Nüsse, Fisch — ungesättigte Fette.',
}

export const DIET_RESTRICTION_LABEL: Record<DietRestriction, string> = {
  vegetarian: 'Vegetarisch',
  vegan: 'Vegan',
  pescetarian: 'Pescetarisch',
  unprocessed: 'Unverarbeitet',
}

export const FASTING_LABEL: Record<Fasting, string> = {
  none: 'Kein Fasten',
  '16:8': '16:8',
  '18:6': '18:6',
  '20:4': '20:4',
  '5:2': '5:2',
}

export const FASTING_HINT: Record<Fasting, string> = {
  none: '',
  '16:8': '16 h fasten, 8 h Essensfenster.',
  '18:6': '18 h fasten, 6 h Essensfenster.',
  '20:4': '20 h fasten, 4 h Essensfenster.',
  '5:2': '5 Tage normal essen, an 2 Tagen nur ~500–600 kcal.',
}

export const DEFAULT_DIET: DietStyle = {
  macro: 'balanced',
  restrictions: [],
  fasting: 'none',
  fastingStart: '12:00',
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Robust aus beliebigen Werten (DB-Zeile, localStorage) lesen. */
export function normalizeDiet(raw: {
  macro?: unknown
  restrictions?: unknown
  fasting?: unknown
  fastingStart?: unknown
} | null | undefined): DietStyle {
  const macro = DIET_MACROS.includes(raw?.macro as DietMacro) ? (raw!.macro as DietMacro) : 'balanced'
  const list = Array.isArray(raw?.restrictions) ? (raw!.restrictions as unknown[]) : []
  let restrictions = DIET_RESTRICTIONS.filter((r) => list.includes(r))
  // Vegan schließt vegetarisch/pescetarisch ein; vegetarisch schließt pescetarisch aus.
  if (restrictions.includes('vegan')) restrictions = restrictions.filter((r) => r !== 'vegetarian' && r !== 'pescetarian')
  else if (restrictions.includes('vegetarian')) restrictions = restrictions.filter((r) => r !== 'pescetarian')
  const fasting = FASTING_OPTIONS.includes(raw?.fasting as Fasting) ? (raw!.fasting as Fasting) : 'none'
  const fastingStart =
    typeof raw?.fastingStart === 'string' && TIME_RE.test(raw.fastingStart) ? raw.fastingStart : '12:00'
  return { macro, restrictions, fasting, fastingStart }
}

/** Wählt eine Einschränkung an/ab und hält die Kombination widerspruchsfrei. */
export function toggleRestriction(list: DietRestriction[], r: DietRestriction): DietRestriction[] {
  if (list.includes(r)) return list.filter((x) => x !== r)
  const animal: DietRestriction[] = ['vegetarian', 'vegan', 'pescetarian']
  const base = animal.includes(r) ? list.filter((x) => !animal.includes(x)) : list
  return DIET_RESTRICTIONS.filter((x) => x === r || base.includes(x))
}

export function isDefaultDiet(d: DietStyle): boolean {
  return d.macro === 'balanced' && d.restrictions.length === 0 && d.fasting === 'none'
}

// --- Speicherung -----------------------------------------------------------

export const DIET_FALLBACK_KEY = 'diet_style_fallback'

export function readDietFallback(): DietStyle | null {
  try {
    const raw = localStorage.getItem(DIET_FALLBACK_KEY)
    return raw ? normalizeDiet(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function writeDietFallback(d: DietStyle | null) {
  try {
    if (d) localStorage.setItem(DIET_FALLBACK_KEY, JSON.stringify(d))
    else localStorage.removeItem(DIET_FALLBACK_KEY)
  } catch {
    /* ignore */
  }
}

/** DB-Spalten (Migration 0027) einer nutrition_settings-Zeile. */
export interface DietColumns {
  diet_macro?: string | null
  diet_restrictions?: string[] | null
  fasting?: string | null
  fasting_start?: string | null
}

/** true, wenn die Zeile die neuen Spalten enthält (Migration ausgeführt). */
export function rowHasDietColumns(row: object | null | undefined): boolean {
  return !!row && 'diet_macro' in row
}

export function dietFromRow(row: DietColumns): DietStyle {
  return normalizeDiet({
    macro: row.diet_macro,
    restrictions: row.diet_restrictions,
    fasting: row.fasting,
    fastingStart: row.fasting_start,
  })
}

export function dietToColumns(d: DietStyle): Required<DietColumns> {
  return {
    diet_macro: d.macro,
    diet_restrictions: d.restrictions,
    fasting: d.fasting,
    fasting_start: d.fastingStart,
  }
}

/**
 * Aktive Ernährungsweise zu einer Settings-Zeile: DB-Werte, wenn die Spalten
 * existieren (eine noch nicht übertragene localStorage-Wahl hat Vorrang, solange
 * die DB nur den Standard enthält) — sonst der localStorage-Fallback.
 */
export function resolveDiet(row: (object & DietColumns) | null | undefined): DietStyle {
  const fb = readDietFallback()
  if (rowHasDietColumns(row)) {
    const d = dietFromRow(row!)
    return isDefaultDiet(d) && fb ? fb : d
  }
  return fb ?? DEFAULT_DIET
}

// Aktuelle Ernährungsweise für Nicht-React-Code (KI-Prompts). Wird beim Laden
// der Einstellungen (useNutritionSettings) und nach dem Speichern gesetzt.
let active: DietStyle | null = null

export function setActiveDiet(d: DietStyle) {
  active = d
}

export function getActiveDiet(): DietStyle {
  return active ?? readDietFallback() ?? DEFAULT_DIET
}

// --- Darstellung -----------------------------------------------------------

/** Kurzlabel für den Chip, z. B. „Keto · Vegan · 16:8" ('' bei Standard). */
export function dietShortLabel(d: DietStyle): string {
  const parts: string[] = []
  if (d.macro !== 'balanced') parts.push(DIET_MACRO_LABEL[d.macro])
  for (const r of d.restrictions) parts.push(DIET_RESTRICTION_LABEL[r])
  if (d.fasting !== 'none') parts.push(d.fasting)
  return parts.join(' · ')
}

const MACRO_PROMPT: Record<DietMacro, string> = {
  balanced: '',
  high_protein: 'High Protein (sehr eiweißreich, ~2,2 g Eiweiß je kg Körpergewicht)',
  low_carb: 'Low Carb (~20–25 % der Kalorien aus Kohlenhydraten, wenig Zucker/Stärke)',
  keto: 'Keto (höchstens 30 g Kohlenhydrate pro Tag, fettreich, keine Brot/Nudeln/Reis/Kartoffeln/Zucker)',
  mediterranean: 'Mediterran (~35 % Fett v. a. aus Olivenöl, Nüssen, Fisch; viel Gemüse, Hülsenfrüchte, Vollkorn)',
}

const RESTRICTION_PROMPT: Record<DietRestriction, string> = {
  vegetarian: 'vegetarisch (kein Fleisch, kein Fisch)',
  vegan: 'vegan (keinerlei tierische Produkte: kein Fleisch, Fisch, Milch, Käse, Ei, Honig)',
  pescetarian: 'pescetarisch (kein Fleisch, Fisch/Meeresfrüchte erlaubt)',
  unprocessed: 'unverarbeitet/Clean Eating (keine stark verarbeiteten Fertigprodukte)',
}

/** Prompt-Zusatz zur Ernährungsweise ('' bei Standard). */
export function dietPromptText(d: DietStyle): string {
  const parts: string[] = []
  if (d.macro !== 'balanced') parts.push(MACRO_PROMPT[d.macro])
  for (const r of d.restrictions) parts.push(RESTRICTION_PROMPT[r])
  if (d.fasting === '5:2') parts.push('Intervallfasten 5:2 (an 2 Tagen/Woche nur ~500–600 kcal)')
  else if (d.fasting !== 'none') {
    const w = fastingWindow(d)
    parts.push(`Intervallfasten ${d.fasting} (Essensfenster ${w ? `${w.start}–${w.end}` : ''})`)
  }
  if (!parts.length) return ''
  return ` Ernährungsweise des Nutzers: ${parts.join(', ')}. Halte dich strikt daran.`
}

// --- Intervallfasten -------------------------------------------------------

const EAT_HOURS: Partial<Record<Fasting, number>> = { '16:8': 8, '18:6': 6, '20:4': 4 }

/** Tägliches Essensfenster (null bei „kein Fasten" oder 5:2). */
export function fastingWindow(d: Pick<DietStyle, 'fasting' | 'fastingStart'>): {
  start: string
  end: string
  startMin: number
  hours: number
} | null {
  const hours = EAT_HOURS[d.fasting]
  if (!hours) return null
  const m = TIME_RE.exec(d.fastingStart) ?? TIME_RE.exec('12:00')!
  const startMin = Number(m[1]) * 60 + Number(m[2])
  const endMin = (startMin + hours * 60) % 1440
  return { start: fmtClock(startMin), end: fmtClock(endMin), startMin, hours }
}

function fmtClock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Liegt die Uhrzeit (Minuten seit Mitternacht) im Essensfenster? */
export function inEatingWindow(minOfDay: number, startMin: number, hours: number): boolean {
  const rel = (((minOfDay - startMin) % 1440) + 1440) % 1440
  return rel < hours * 60
}

export interface FastingState {
  phase: 'eating' | 'fasting'
  /** Minuten bis zum nächsten Phasenwechsel. */
  minutesLeft: number
  /** Fortschritt der aktuellen Phase 0…1. */
  progress: number
  /** Uhrzeit des nächsten Wechsels „HH:MM". */
  nextChange: string
}

export function fastingState(now: Date, win: { startMin: number; hours: number }): FastingState {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const eatLen = win.hours * 60
  const rel = (((nowMin - win.startMin) % 1440) + 1440) % 1440
  if (rel < eatLen) {
    return {
      phase: 'eating',
      minutesLeft: eatLen - rel,
      progress: rel / eatLen,
      nextChange: fmtClock(win.startMin + eatLen),
    }
  }
  const fastLen = 1440 - eatLen
  const intoFast = rel - eatLen
  return {
    phase: 'fasting',
    minutesLeft: fastLen - intoFast,
    progress: intoFast / fastLen,
    nextChange: fmtClock(win.startMin),
  }
}

/** „2:14 h" bzw. „45 min". */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`
}
