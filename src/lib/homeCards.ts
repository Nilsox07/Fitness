// „Startseite anpassen": optionale Karten auf den Startseiten von Ernährung
// und Training. Standard = aufgeräumt (alles aus), wie bei Apple Fitness.
import { useSyncExternalStore } from 'react'

export type HomeCard = 'recent' | 'weight' | 'recovery' | 'lastWorkout' | 'nutrition' | 'challenge'

export const HOME_CARDS: Record<'food' | 'training', { id: HomeCard; label: string; hint: string }[]> = {
  food: [
    { id: 'recent', label: 'Zuletzt gegessen', hint: 'Schnell nochmal eintragen (steht auch in der Suche)' },
    { id: 'weight', label: 'Körpergewicht', hint: 'Gewicht eintragen (Verlauf im Fortschritt)' },
  ],
  training: [
    { id: 'recovery', label: 'Erholung', hint: 'Welche Muskeln bereit sind' },
    { id: 'lastWorkout', label: 'Letztes Training', hint: 'Dauer, Sätze, Volumen, Rekorde' },
    { id: 'nutrition', label: 'Ernährung heute', hint: 'Kalorien & Eiweiß auf einen Blick' },
    { id: 'challenge', label: 'Challenge des Tages', hint: 'Kleine Tagesaufgabe' },
  ],
}

const KEY = 'home_cards'
const listeners = new Set<() => void>()
let cache: string | null = null

function raw(): string {
  try {
    return localStorage.getItem(KEY) ?? '{}'
  } catch {
    return '{}'
  }
}

function parse(s: string): Partial<Record<HomeCard, boolean>> {
  try {
    return JSON.parse(s) as Partial<Record<HomeCard, boolean>>
  } catch {
    return {}
  }
}

export function useHomeCards(): [Partial<Record<HomeCard, boolean>>, (id: HomeCard, on: boolean) => void] {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (cache ??= raw()),
  )
  const set = (id: HomeCard, on: boolean) => {
    const next = { ...parse(raw()), [id]: on }
    cache = JSON.stringify(next)
    try {
      localStorage.setItem(KEY, cache)
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l())
  }
  return [parse(snap), set]
}
