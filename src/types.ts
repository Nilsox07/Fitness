export const MUSCLE_GROUPS = [
  'Brust',
  'Rücken',
  'Beine',
  'Schultern',
  'Bizeps',
  'Trizeps',
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

/** Kurzkennung für kompakte Anzeige (Verlauf, Badges). */
export const SET_TYPE_SHORT: Record<SetType, string> = {
  warmup: 'Aufw.',
  working: 'Arbeit',
  drop: 'Drop',
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
// Ernährung
// ---------------------------------------------------------------------------

export type Sex = 'm' | 'f'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type NutritionGoal = 'lose' | 'maintain' | 'gain'

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
  updated_at: string
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
  barcode: string | null
  created_at: string
}
