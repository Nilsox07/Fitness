// Muskel-Karte mit mitarbeitenden Muskeln – auch für eigene Übungen ohne Eintrag (aus Bibliothek bzw.
// Name, siehe src/lib/warmMuscles.ts). Für Vorermüdung im Training und die faire Auswertung.

import { useMemo } from 'react'
import { useLibrary } from '../components/library/useLibrary'
import { findLibraryMatch } from '../lib/exerciseLibrary'
import { effectiveSecondary } from '../lib/warmMuscles'
import { muscleMap, type MuscleInfo } from '../lib/fatigue'
import type { Exercise } from '../types'

export function useMuscles(exercises: readonly Exercise[] | undefined): Map<string, MuscleInfo> {
  const { list } = useLibrary()
  return useMemo(
    () =>
      muscleMap(
        (exercises ?? []).map((e) => ({
          ...e,
          secondary_muscles: effectiveSecondary(e, list ? findLibraryMatch(e, list)?.secondary : null),
        })),
      ),
    [exercises, list],
  )
}
