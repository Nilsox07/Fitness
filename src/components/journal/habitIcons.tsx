// Symbole für Journal-Gewohnheiten und das Gefühl am Morgen (neutral, keine Emojis).

import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  BookOpen,
  Brain,
  Coffee,
  Dumbbell,
  Moon,
  Smartphone,
  Sofa,
  Sun,
  Thermometer,
  ThermometerSun,
  UtensilsCrossed,
  Wind,
  Wine,
  Zap,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  alcohol: Wine,
  caffeine_late: Coffee,
  late_meal: UtensilsCrossed,
  screen_bed: Smartphone,
  stress: Brain,
  outside: Sun,
  late_workout: Moon,
  nap: Sofa,
  reading: BookOpen,
  relax: Wind,
  sauna: ThermometerSun,
  sick: Thermometer,
  trained: Dumbbell,
}

export const habitIcon = (id: string): LucideIcon => ICONS[id] ?? Sun

/** Gefühl am Morgen 1–5 als Akku */
export const FEEL_ICON: LucideIcon[] = [BatteryWarning, BatteryWarning, BatteryLow, BatteryMedium, BatteryFull, Zap]
