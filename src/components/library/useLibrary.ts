import { useEffect, useMemo, useState } from 'react'
import {
  findLibraryMatch,
  getLinks,
  loadLibrary,
  peekLibrary,
  type LibraryExercise,
} from '../../lib/exerciseLibrary'

/** Lädt die Übungsbibliothek bei Bedarf (`enabled`) und hält sie im Speicher. */
export function useLibrary(enabled = true) {
  const [list, setList] = useState<LibraryExercise[] | null>(() => peekLibrary())
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled || list) return
    let alive = true
    setError(null)
    loadLibrary()
      .then((l) => alive && setList(l))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Bibliothek nicht verfügbar'))
    return () => {
      alive = false
    }
  }, [enabled, list, attempt])

  return { list, error, loading: enabled && !list && !error, retry: () => setAttempt((a) => a + 1) }
}

/**
 * Bibliotheks-Eintrag zu einer eigenen Übung (Verknüpfung oder Namensabgleich).
 * `version` erhöhen, nachdem eine Verknüpfung gespeichert wurde.
 */
export function useLibraryMatch(
  exercise: { id: string; name: string } | null | undefined,
  enabled = true,
  version = 0,
): LibraryExercise | null {
  const { list } = useLibrary(enabled && !!exercise)
  return useMemo(
    () => (list && exercise ? findLibraryMatch(exercise, list, getLinks()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, exercise?.id, exercise?.name, version],
  )
}
