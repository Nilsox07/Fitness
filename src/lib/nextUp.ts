// „Jetzt dran“ auf Heute: nur das, was gerade wirklich ansteht – je nach Uhrzeit und Stand, höchstens 3.
// Alles andere (Journal am Abend, Wiegen …) kommt als Benachrichtigung statt den ganzen Tag dazustehen.
// Reine Logik – getestet in nextUp.test.ts.

import type { Meal } from '../types'

export type NextKind = 'feel' | 'workout' | 'cardio' | 'meal' | 'water' | 'supplement' | 'bedtime'

export interface NextItem {
  kind: NextKind
  priority: number
  title: string
  sub?: string
  meal?: Meal
}

export interface NextCtx {
  hour: number
  showNutrition: boolean
  hasWatch: boolean
  hasHybrid: boolean
  trainedToday: boolean
  restDay: boolean
  nextWorkout: string | null
  /** Ausdauer-Einheit laut Plan heute (Titel) – null = keine */
  cardioToday: string | null
  cardioDone: boolean
  mealsLogged: Partial<Record<Meal, boolean>>
  waterMl: number
  waterTarget: number
  /** Fälliges Supplement (Uhrzeit vorbei, nicht genommen) */
  supplementDue: { name: string; time: string } | null
  bedAt: string | null
  /** Morgens schon „Wie ausgeruht?“ beantwortet */
  feelAnswered: boolean
}

/** Welche Mahlzeit ist gerade dran? (null = gerade keine) */
export function mealSlot(hour: number): Meal | null {
  if (hour >= 6 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 15) return 'lunch'
  if (hour >= 17 && hour < 22) return 'dinner'
  return null
}

const MEAL_NAME: Record<Meal, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
}

/** Trinken im Plan? Erwartet linear von 7 bis 21 Uhr; erst ab 500 ml Rückstand ein Thema. */
export function waterBehind(ml: number, target: number, hour: number): number {
  const share = Math.min(1, Math.max(0, (hour - 7) / 14))
  return Math.max(0, Math.round(target * share - ml))
}

export function nextUp(c: NextCtx): NextItem[] {
  const out: NextItem[] = []
  if (c.hour >= 5 && c.hour < 11 && !c.feelAnswered)
    out.push({ kind: 'feel', priority: 90, title: 'Wie ausgeruht bist du?', sub: 'Ein Tipp reicht' })

  if (!c.trainedToday && !c.restDay && c.hour >= 6 && c.hour < 23)
    out.push({
      kind: 'workout',
      priority: 80,
      title: c.nextWorkout ? `Heute: ${c.nextWorkout}` : 'Training',
      sub: c.nextWorkout ? 'Laut deinem Plan' : 'Freies Training oder Plan wählen',
    })

  if (c.hasHybrid && c.cardioToday && !c.cardioDone && c.hour >= 6)
    out.push({ kind: 'cardio', priority: 70, title: c.cardioToday, sub: 'Ausdauer laut Plan' })

  if (c.showNutrition) {
    const slot = mealSlot(c.hour)
    if (slot && !c.mealsLogged[slot])
      out.push({ kind: 'meal', priority: 75, title: MEAL_NAME[slot], sub: 'Noch nicht eingetragen', meal: slot })
    const behind = waterBehind(c.waterMl, c.waterTarget, c.hour)
    if (behind >= 500)
      out.push({
        kind: 'water',
        priority: 50,
        title: 'Etwas trinken',
        sub: `${(behind / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} l hinter deinem Plan`,
      })
    if (c.supplementDue)
      out.push({
        kind: 'supplement',
        priority: 60,
        title: c.supplementDue.name,
        sub: `Fällig seit ${c.supplementDue.time}`,
      })
  }

  if (c.hasWatch && c.bedAt && c.hour >= 19)
    out.push({ kind: 'bedtime', priority: 65, title: `Ins Bett um ${c.bedAt}`, sub: 'Für deinen Schlafbedarf heute' })

  return out.sort((a, b) => b.priority - a.priority).slice(0, 3)
}
