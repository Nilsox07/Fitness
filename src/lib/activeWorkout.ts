// Läuft gerade ein Training? Steuert, ob die App beim Öffnen im Fitness-
// oder im Ernährungsbereich startet. Ein Training gilt als laufend, wenn es
// heute gestartet/bespielt und nicht beendet wurde und die letzte Aktivität
// höchstens 3 Stunden her ist.
import { trainingDay } from './day'

const KEY = 'workout_active'
const MAX_IDLE_MS = 3 * 60 * 60 * 1000

/** Training gestartet oder Satz erledigt → als laufend merken. */
export function touchWorkout(date = trainingDay()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ date, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

/** Training beendet. */
export function endWorkout(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function isWorkoutRunning(now = Date.now(), today = trainingDay()): boolean {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null') as { date: string; at: number } | null
    return !!p && p.date === today && now - p.at < MAX_IDLE_MS
  } catch {
    return false
  }
}
