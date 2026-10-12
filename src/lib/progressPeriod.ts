// Gemeinsamer Zeitraum (Woche / Monat / Jahr) für beide Fortschritts-Reiter:
// Wer bei Training „Woche" wählt, sieht bei Ernährung auch die Woche.
import { useSyncExternalStore } from 'react'
import type { Period } from './periods'

const KEY = 'progress_period'
const listeners = new Set<() => void>()

function read(): Period {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'week' || v === 'year' ? v : 'month'
  } catch {
    return 'month'
  }
}

export function useProgressPeriod(): [Period, (p: Period) => void] {
  const period = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
  )
  const set = (p: Period) => {
    try {
      localStorage.setItem(KEY, p)
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l())
  }
  return [period, set]
}
