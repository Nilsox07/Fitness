/**
 * Typen des Übungsfiguren-Systems (reines SVG, keine Abhängigkeiten).
 *
 * Welt: viewBox 400 × 300, Boden bei y = FLOOR. Die Figur blickt nach +x.
 * x = nach vorn, y = nach unten, z = seitlich (nahe Körperseite +z, ferne −z).
 * Winkel in Grad in der x/y-Ebene (Sagittalebene) mit y nach unten:
 *   0 = nach vorn, 90 = nach unten, −90 = nach oben, 180 = nach hinten.
 * Rumpf: positive Beugung (`bend`) rollt den oberen Rumpf zur Brust hin ein.
 *
 * Die Gelenkpositionen werden pro Frame aus Winkeln/Zielpunkten berechnet
 * (Vorwärts- bzw. 2-Knochen-IK), daher bleiben die Segmentlängen konstant.
 */

export type Vec2 = [number, number]

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

/** Gliedmaße über absolute Winkel (Vorwärtskinematik). */
export interface AngleLimb {
  /** Sagittalwinkel [Oberarm/Oberschenkel, Unterarm/Unterschenkel]. */
  a: Vec2
  /** Abspreizen aus der Ebene (Grad, + = vom Körper weg zur Seite). */
  out?: Vec2
}

/** Gliedmaße über Zielpunkt (2-Knochen-IK mit festen Längen). */
export interface TargetLimb {
  /** Weltziel des Endpunkts: Griffpunkt (Arm) bzw. Knöchel (Bein). */
  to: Vec2
  /** Seitlicher Abstand des Ziels von der Körpermitte (wird für die ferne Seite gespiegelt). */
  z?: number
  /** Absolute Welt-z des Ziels (nicht gespiegelt, z. B. beide Hände an einem Punkt). */
  zw?: number
  /** Beugerichtung des Ellbogens/Knies (absoluter Winkel). Standard: aus der Rumpflage. */
  pole?: number
  /** Beugeebene zur Seite drehen (Grad, 90 = Ellbogen/Knie ganz nach außen). */
  splay?: number
}

export type LimbSpec = AngleLimb | TargetLimb

export interface PoseSpec {
  /** Hüftmittelpunkt (Welt). */
  hip: Vec2
  /** Rumpfwinkel Hüfte → Taille. */
  torso: number
  /** Wirbelsäulenbeugung (+ = einrollen, − = Hohlkreuz). */
  bend?: number
  /** Rotation des Schultergürtels (+ = nahe Schulter nach vorn). */
  twist?: number
  /** Kopfneigung relativ zum oberen Rumpf (+ = Kinn zur Brust). */
  head?: number
  arm: LimbSpec
  armFar?: LimbSpec
  leg: LimbSpec
  legFar?: LimbSpec
  /** Fußwinkel absolut (Ferse → Zehen). Standard: flach bei Zielbein, sonst ⟂ Schienbein. */
  foot?: number
  footFar?: number
}

export interface TimelineKey {
  /** Zeitpunkt im Zyklus (0..1). */
  at: number
  pose: string
  /** Der Abschnitt, der hier ENDET, ist konzentrisch (Muskel arbeitet → stärkeres Leuchten). */
  c?: boolean
}

export type PropLayer = 'back' | 'far' | 'mid' | 'front'

export type PropSpec =
  | { kind: 'bench'; x: number; w: number; top?: number }
  | { kind: 'incline'; x: number; angle: number; top?: number; len?: number }
  | { kind: 'rack'; x: number; y: number }
  | { kind: 'barbell'; plate?: number; hand?: 'near' | 'far' }
  | { kind: 'dumbbell'; one?: boolean; style?: 'end' | 'hammer' }
  | { kind: 'kettlebell'; hand?: 'near' | 'far'; along?: boolean }
  | { kind: 'cable'; from: Vec2; column?: number; stackTop?: number; handle?: 'bar' | 'rope' | 'handle'; hand?: 'near' | 'far' | 'both'; layer?: PropLayer }
  | { kind: 'pullupBar'; x: number; y: number; post?: number }
  | { kind: 'dipBars'; y: number; x1: number; x2: number }
  | { kind: 'latMachine'; x: number; seat: Vec2; pulley: Vec2; pad?: Vec2 }
  | { kind: 'legPress'; angle: number; seat: Vec2; back: number }
  | { kind: 'legExtension'; seat: Vec2; pivot: Vec2 }
  | { kind: 'legCurl'; top: number; x: number; w: number; pivot: Vec2 }
  | { kind: 'mat'; x: number; w: number }
  | { kind: 'box'; x: number; w: number; h: number }
  | { kind: 'band'; anchor?: Vec2; foot?: boolean }
  | { kind: 'wall'; x: number }
  | { kind: 'seat'; x: number; w: number; top: number; back?: number }
  | { kind: 'calfBlock'; x: number; h: number }

export interface FigureDef {
  view?: 'side' | 'front'
  /** Spiegeln (z. B. Kopf rechts beim Bankdrücken). */
  mirror?: boolean
  /** Ganze Figur drehen (Grad) um einen Punkt — z. B. Seitstütz in der Frontansicht. */
  roll?: { deg: number; cx: number; cy: number }
  /** Zyklusdauer in ms (Standard 3200). */
  duration?: number
  poses: Record<string, PoseSpec>
  timeline: TimelineKey[]
  /** Pose für das Standbild (reduzierte Bewegung, Thumbnails). */
  peak?: string
  props?: PropSpec[]
  /** Bodenschatten-Mitte (Standard: aus Hüfte/Füßen). */
  shadowX?: number
  /** Verkleinern um den Bodenmittelpunkt (z. B. Überkopf-Übungen), Standard 1. */
  zoom?: number
  /** Boden ausblenden (z. B. hängend über der Bildkante). */
  noFloor?: boolean
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
