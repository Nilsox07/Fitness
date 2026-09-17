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

export interface PlanExercise {
  id: string
  user_id: string
  plan_id: string
  exercise_id: string
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
  updated_at: string
}

export interface BodyWeight {
  id: string
  user_id: string
  date: string
  weight_kg: number
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
