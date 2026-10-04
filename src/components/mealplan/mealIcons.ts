import {
  Apple,
  Beef,
  Carrot,
  Coffee,
  Cookie,
  CupSoda,
  Egg,
  Fish,
  Milk,
  Moon,
  Nut,
  ShoppingBasket,
  Sun,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import type { Meal } from '../../types'
import type { CatKind } from './planUtils'

/** Gleiche Mahlzeit-Icons wie auf dem Ernährungs-Start (MealCard). */
export const MEAL_ICON: Record<Meal, LucideIcon> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
}

export const CATEGORY_ICON: Record<CatKind, LucideIcon> = {
  meat: Beef,
  fish: Fish,
  egg: Egg,
  dairy: Milk,
  grain: Wheat,
  veg: Carrot,
  fruit: Apple,
  nuts: Nut,
  drinks: CupSoda,
  other: ShoppingBasket,
}
