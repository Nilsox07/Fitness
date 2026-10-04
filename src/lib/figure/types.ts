/**
 * Typen des Übungsfiguren-Systems (reines SVG, keine Abhängigkeiten).
 *
 * Koordinaten: Welt in „Figur-Pixeln" (viewBox 400 × 300, Boden bei y = FLOOR).
 * x = nach vorn (Blickrichtung der Figur in der Seitenansicht), y = nach unten,
 * z = seitlich zur Kamera hin (nahe Körperseite +z, ferne −z).
 * Winkel in Grad, gemessen in der x/y-Ebene (Sagittalebene) mit y nach unten:
 *   0 = nach vorn/rechts, 90 = nach unten, −90 = nach oben, 180 = nach hinten/links.
 * Positive relative Drehungen (Rumpfbeugung, Kopf) kippen „nach vorn" (zur Brust).
 */

export type MuscleRegion =
  | 'chest'
  | 'frontDelt'
  | 'sideDelt'
  | 'rearDelt'
  | 'lats'
  | 'traps'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'lowerBack'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'adductors'

/** Gliedmaße über Winkel (Vorwärtskinematik). */
export interface AngleLimb {
  /** Winkel [Oberarm/Oberschenkel, Unterarm/Unterschenkel] in der Sagittalebene. */
  a: [number, number]
  /** Abspreizen aus der Ebene heraus (Grad, + = vom Körper weg zur Seite). */
  out?: [number, number]
  /** Winkel relativ zum Rumpf (Arme: oberer Rumpf, Beine: Becken) statt absolut. */
  rel?: boolean
}

/** Gliedmaße über Zielpunkt (2-Knochen-IK mit festen Längen). */
export interface TargetLimb {
  /** Weltziel [x, y, zusätzliche Breite nach außen]. Endpunkt = Griffpunkt (Arm) bzw. Knöchel (Bein). */
  to: [number, number, number?]
  /** Beugerichtung in der Ebene: Arme +1 (Ellbogen nach hinten), Beine −1 (Knie nach vorn). */
  bend?: 1 | -1
  /** Dreht die Beugeebene zur Seite (0 = in der Ebene, 90 = Ellbogen/Knie ganz nach außen). */
  splay?: number
}

/** Zielpunkt relativ zum Rumpf: [entlang Rumpf ab Schulter, nach vorn, Breite nach außen]. */
export interface LocalLimb {
  at: [number, number, number?]
  bend?: 1 | -1
  splay?: number
}

export type LimbSpec = AngleLimb | TargetLimb | LocalLimb

export interface PoseSpec {
  /** Hüftmittelpunkt (Welt). */
  hip: [number, number]
  /** Rumpfwinkel Hüfte → Schulter (unterer Rumpfabschnitt). */
  torso: number
  /** Wirbelsäulenbeugung (+ = einrollen/Crunch, − = Überstreckung). */
  bend?: number
  /** Rotation des Schultergürtels um die Rumpfachse (Grad). */
  twist?: number
  /** Schulterheben (px entlang Rumpf). */
  shrug?: number
  /** Kopfneigung relativ zum oberen Rumpf (+ = Kinn zur Brust). */
  head?: number
  arm: LimbSpec
  armFar?: LimbSpec
  leg: LimbSpec
  legFar?: LimbSpec
  /** Fußwinkel absolut (Ferse → Zehen). Standard: flach bei Zielbein, sonst 90° zum Schienbein. */
  foot?: number
  footFar?: number
}

export interface TimelineKey {
  /** Zeitpunkt im Zyklus (0..1). */
  at: number
  pose: string
  /** Segment, das hier ENDET, ist konzentrisch (Muskel arbeitet → stärkeres Leuchten). */
  c?: boolean
  /** Grundspannung in dieser Pose (0..1). */
  load?: number
}

export type PropSpec =
  | { kind: 'bench'; x: number; w: number; top?: number }
  | { kind: 'incline'; x: number; angle: number; seat?: number; len?: number; top?: number }
  | { kind: 'rack'; x: number; y: number }
  | { kind: 'barbell'; plate?: number; ez?: boolean }
  | { kind: 'dumbbell'; style?: 'end' | 'side'; one?: boolean; both?: boolean }
  | { kind: 'kettlebell'; hang?: 'gravity' | 'arm'; both?: boolean }
  | { kind: 'cable'; from: [number, number]; column?: number; handle?: 'bar' | 'rope' | 'handle' }
  | { kind: 'pullupBar'; x: number; y: number }
  | { kind: 'dipBars'; y: number; x1: number; x2: number }
  | { kind: 'latMachine'; x: number; seat: number; top: number }
  | { kind: 'legPress'; angle: number; seat: [number, number]; back: number }
  | { kind: 'legMachine'; variant: 'extension' | 'lyingCurl'; seat: [number, number] }
  | { kind: 'mat'; x: number; w: number }
  | { kind: 'box'; x: number; w: number; h: number }
  | { kind: 'band'; anchor?: [number, number]; between?: boolean }
  | { kind: 'wall'; x: number }
  | { kind: 'seat'; x: number; w: number; top: number; back?: number }
  | { kind: 'plate'; x: number; y: number; angle: number }

export interface FigureDef {
  view?: 'side' | 'front'
  /** Spiegeln (z. B. Kopf rechts beim Bankdrücken). */
  mirror?: boolean
  /** Drehung der Figur um einen Punkt (Grad, z. B. Seitstütz). */
  roll?: { deg: number; cx: number; cy: number }
  /** Zyklusdauer in ms (Standard 3200). */
  duration?: number
  poses: Record<string, PoseSpec>
  timeline: TimelineKey[]
  /** Zeitpunkt für das Standbild (reduzierte Bewegung / außerhalb des Sichtbereichs). */
  peak?: number
  props?: PropSpec[]
}

export interface FigureEntry {
  id: string
  /** Deutscher Anzeigename. */
  name: string
  figure: FigureDef
  primary: MuscleRegion[]
  secondary: MuscleRegion[]
  /** IDs aus public/exercise-library.json. */
  libraryIds: string[]
  /** Weitere Namen (deutsch/englisch) für die Zuordnung eigener Übungen. */
  names: string[]
}
