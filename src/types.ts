import type { Micros } from './lib/micros'
export const MUSCLE_GROUPS = [
  'Brust',
  'Rücken',
  'Beine',
  'Beinbeuger',
  'Waden',
  'Gesäß',
  'Schultern',
  'Bizeps',
  'Trizeps',
  'Unterarme',
  'Bauch',
  'Ganzkörper',
  'Sonstige',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const SET_TYPES = ['warmup', 'working', 'drop'] as const
export type SetType = (typeof SET_TYPES)[number]

export const SET_TYPE_LABEL: Record<SetType, string> = {
  warmup: 'Aufwärmen',
  working: 'Arbeitssatz',
  drop: 'Dropsatz',
}

export interface Exercise {
  id: string
  user_id: string
  name: string
  muscle_group: MuscleGroup
  notes: string | null
  target_rep_min: number
  target_rep_max: number
  increment: number
  /** Einseitig: links/rechts getrennt erfassen. */
  unilateral: boolean
  /** Optionale Liste real wählbarer Gewichte (Text, leer = gleichmäßige Schritte). */
  weight_steps: string | null
  /** Zusätzlich beanspruchte Muskelgruppen (Sekundärmuskeln), z. B. Rudern → Schultern. */
  secondary_muscles: MuscleGroup[]
  created_at: string
}

export interface Workout {
  id: string
  user_id: string
  date: string // YYYY-MM-DD
  name: string | null
  notes: string | null
  created_at: string
}

export interface WorkoutSet {
  id: string
  user_id: string
  workout_id: string
  exercise_id: string
  set_number: number
  reps: number
  weight: number
  /** rechte Seite bei einseitigen Übungen (sonst null); links = reps/weight */
  reps_right: number | null
  weight_right: number | null
  set_type: SetType
  /** Satz bis zum Muskelversagen ausgeführt? (Default false = noch Reserve) */
  to_failure: boolean
  created_at: string
}

/** Ein Satz angereichert um Workout-Datum — für die Auswertung. */
export interface SetWithDate extends WorkoutSet {
  date: string
}

// ---------------------------------------------------------------------------
// Trainingspläne (Routinen)
// ---------------------------------------------------------------------------

export interface Plan {
  id: string
  user_id: string
  name: string
  position: number
  created_at: string
}

/** Ein Plan angereichert um seine (geordneten) Übungs-IDs. */
export interface PlanWithExercises extends Plan {
  exercise_ids: string[]
}

// ---------------------------------------------------------------------------
// Ernährung
// ---------------------------------------------------------------------------

export type Sex = 'm' | 'f'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type NutritionGoal = 'lose' | 'maintain' | 'gain' | 'recomp'

export interface NutritionSettings {
  user_id: string
  sex: Sex
  age: number
  height_cm: number
  weight_kg: number
  activity: ActivityLevel
  goal: NutritionGoal
  kcal_target: number
  protein_target: number
  carbs_target: number
  fat_target: number
  water_target_ml: number
  /** Ernährungsweise (Migration 0027) — fehlen, solange die Migration nicht läuft. */
  diet_macro?: string | null
  diet_restrictions?: string[] | null
  fasting?: string | null
  fasting_start?: string | null
  updated_at: string
}

export interface BodyWeight {
  id: string
  user_id: string
  date: string
  weight_kg: number
  /** 'health' = von der Waage über Health Connect übernommen (Migration 0043), sonst selbst eingetragen */
  source?: string | null
  created_at: string
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
  snack: 'Snack',
}

/** Feste, wiederkehrende Mahlzeit (z. B. täglicher Proteinshake). */
export interface MealRoutine {
  id: string
  user_id: string
  meal: Meal
  title: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  created_at: string
}

/** Gespeicherter Ernährungsplan inkl. Einkaufsliste. */
export interface SavedMealPlan {
  id: string
  user_id: string
  name: string
  days: number
  plan: PlanDay[]
  shopping: ShoppingCat[]
  created_at: string
}

export interface PlanMeal {
  meal: Meal
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  routine?: boolean
}
export interface PlanDay {
  label: string
  meals: PlanMeal[]
}
export interface ShoppingCat {
  category: string
  items: string[]
}

export interface FoodEntry {
  id: string
  user_id: string
  date: string
  name: string
  amount_g: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sat_fat: number
  salt: number
  barcode: string | null
  meal: Meal | null
  /** Getränk: Flüssigkeit in ml (zählt zur Trinkmenge), sonst null */
  fluid_ml?: number | null
  /** geschätzte Vitamine & Mineralstoffe (Migration 0045), sonst null */
  micros?: Micros | null
  created_at: string
}

export interface SavedRecipe {
  id: string
  user_id: string
  author_name: string | null
  title: string
  servings: number
  ingredients: string[]
  steps: string[]
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sat_fat: number
  salt: number
  shared: boolean
  created_at: string
}

export interface WaterIntake {
  id: string
  user_id: string
  date: string
  ml: number
  created_at: string
}

/** Ausdauer-Einheit von Smartwatch / Health Connect (Migration 0037). */
export type ActivityType = 'run' | 'ride' | 'walk' | 'hike' | 'swim' | 'row' | 'other'

export interface HealthActivity {
  id: string
  user_id: string
  source_id: string
  source: string | null
  type: ActivityType
  title: string | null
  started_at: string
  duration_s: number
  distance_m: number | null
  kcal: number | null
  avg_hr: number | null
  max_hr: number | null
  elevation_m: number | null
  /** vereinfachte Strecke [[lat, lng, höhe?, sekunde?], …] */
  route: RoutePoint[] | null
  active_kcal?: number | null
  min_hr?: number | null
  steps?: number | null
  avg_power?: number | null
  max_power?: number | null
  /** m/s */
  max_speed?: number | null
  avg_cadence?: number | null
  /** [[sekunde, bpm], …] */
  hr_series?: [number, number][] | null
  /** [[sekunde, m/s], …] */
  speed_series?: [number, number][] | null
  power_series?: [number, number][] | null
  laps?: { start_s: number; end_s: number; length_m: number | null }[] | null
}

/** Streckenpunkt: Breite, Länge, optional Höhe (m) und Sekunde seit Start. */
export type RoutePoint = [number, number] | [number, number, number | null, number]

/** Eine Nacht Schlaf (date = Aufwach-Tag). */
export interface HealthSleep {
  user_id: string
  date: string
  start_at: string
  end_at: string
  asleep_min: number
  deep_min: number | null
  rem_min: number | null
  light_min: number | null
  awake_min: number | null
  source: string | null
  in_bed_min?: number | null
  latency_min?: number | null
  awakenings?: number | null
  /** [[startMinute, dauer, phase]] – 1 wach, 2 leicht, 3 tief, 4 REM, 5 Schlaf */
  stages?: [number, number, number][] | null
  hr_avg?: number | null
  hr_min?: number | null
  /** [[minute, bpm], …] */
  hr_series?: [number, number][] | null
  hrv_avg?: number | null
  spo2_avg?: number | null
  spo2_min?: number | null
  resp_rate?: number | null
  skin_temp_delta?: number | null
}

/** Tageswerte von der Uhr. */
export interface HealthDaily {
  user_id: string
  date: string
  steps: number | null
  active_kcal: number | null
  resting_hr: number | null
  hrv_ms: number | null
  vo2max: number | null
  distance_m?: number | null
  floors?: number | null
  total_kcal?: number | null
  hr_min?: number | null
  hr_max?: number | null
  hr_avg?: number | null
  /** 24 Werte: Ø-Puls je Stunde */
  hr_hourly?: (number | null)[] | null
  spo2?: number | null
  resp_rate?: number | null
  weight_kg?: number | null
  body_fat_pct?: number | null
  bp_sys?: number | null
  bp_dia?: number | null
  glucose_mmol?: number | null
  body_temp_c?: number | null
  /** Migration 0043: aus anderen Apps über Health Connect */
  hydration_ml?: number | null
  nutrition_kcal?: number | null
  nutrition_protein_g?: number | null
  mindful_min?: number | null
  /** Krafttraining, das andere Apps/Uhren aufgezeichnet haben (zählt nicht doppelt) */
  strength_sessions?: number | null
  strength_min?: number | null
}
