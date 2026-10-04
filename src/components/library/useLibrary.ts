import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useCreateExercise, useExercises } from '../../hooks/useExercises'
import {
  findLibraryMatch,
  getLinks,
  getLinksVersion,
  libraryToExerciseInput,
  loadLibrary,
  peekLibrary,
  setLink,
  subscribeLinks,
  type LibraryExercise,
} from '../../lib/exerciseLibrary'
import type { Exercise } from '../../types'

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

/** Version der gespeicherten Verknüpfungen — ändert sich bei jedem `setLink`. */
export function useLinksVersion(): number {
  return useSyncExternalStore(subscribeLinks, getLinksVersion, getLinksVersion)
}

/**
 * Bibliotheks-Eintrag zu einer eigenen Übung (Verknüpfung oder Namensabgleich).
 * Aktualisiert sich automatisch, wenn eine Verknüpfung gespeichert wird.
 */
export function useLibraryMatch(
  exercise: { id: string; name: string } | null | undefined,
  enabled = true,
  version = 0,
): LibraryExercise | null {
  const { list } = useLibrary(enabled && !!exercise)
  const linksVersion = useLinksVersion()
  return useMemo(
    () => (list && exercise ? findLibraryMatch(exercise, list, getLinks()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, exercise?.id, exercise?.name, version, linksVersion],
  )
}

/**
 * Zuordnung eigene Übungen ↔ Bibliothek: `byExercise` (Übungs-ID → Eintrag,
 * z. B. für Thumbnails) und `byLibrary` (Bibliotheks-ID → eigene Übung).
 */
export function useLibraryLinks(exercises: Exercise[] | undefined, list: LibraryExercise[] | null) {
  const linksVersion = useLinksVersion()
  return useMemo(() => {
    const byExercise = new Map<string, LibraryExercise>()
    const byLibrary = new Map<string, Exercise>()
    if (!list || !exercises) return { byExercise, byLibrary }
    const links = getLinks()
    for (const ex of exercises) {
      const m = findLibraryMatch(ex, list, links)
      if (!m) continue
      byExercise.set(ex.id, m)
      if (!byLibrary.has(m.id)) byLibrary.set(m.id, ex)
    }
    return { byExercise, byLibrary }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, list, linksVersion])
}

/**
 * Bibliotheks-Übung als eigene Übung anlegen (oder vorhandene wiederverwenden)
 * und verknüpfen. Liefert die eigene Übung.
 */
export function useAddFromLibrary() {
  const createEx = useCreateExercise()
  const { data: mine } = useExercises()
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const add = useCallback(
    async (item: LibraryExercise): Promise<Exercise | null> => {
      setError(null)
      const list = peekLibrary()
      if (list && mine) {
        const links = getLinks()
        const own = mine.find((ex) => findLibraryMatch(ex, list, links)?.id === item.id)
        if (own) return own
      }
      setPendingId(item.id)
      try {
        const created = await createEx.mutateAsync(libraryToExerciseInput(item))
        setLink(created.id, item.id)
        return created
      } catch (e) {
        setError(
          `Konnte nicht speichern: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}. Bitte Verbindung prüfen.`,
        )
        return null
      } finally {
        setPendingId(null)
      }
    },
    [createEx, mine],
  )

  return { add, error, pendingId, busy: pendingId !== null }
}
