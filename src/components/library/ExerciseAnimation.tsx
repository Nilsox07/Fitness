import { useMemo } from 'react'
import { figureForLibraryId, figureForName } from '../../lib/figure/catalog'
import type { FigureEntry } from '../../lib/figure/types'
import type { MuscleGroup } from '../../types'
import { ExerciseFigure } from '../figure/ExerciseFigure'
import { MuscleChip } from '../exercises/MuscleBits'
import { muscleAbbr, muscleTint } from '../exercises/muscle'

/** Was die Anzeige von einem Bibliotheks-Eintrag braucht. */
export interface AnimationItem {
  id: string
  name_de: string
  muscle: MuscleGroup
  secondary?: MuscleGroup[]
}

/**
 * Übungs-Darstellung: stilisierte, animierte Figur (falls im Katalog), sonst
 * ein ruhiger Platzhalter mit Muskel-Chips („Animation folgt"). Fotos werden
 * nicht mehr gezeigt. `still` = kleines Vorschaubild (Standbild der Hauptpose,
 * ohne Figur: Muskel-Avatar).
 *
 * `images` bleibt aus Kompatibilitätsgründen erhalten, wird aber ignoriert.
 */
export function ExerciseAnimation({
  item,
  figure,
  libraryId,
  name,
  muscle,
  secondary,
  alt,
  still = false,
  className = '',
}: {
  /** @deprecated Fotos werden nicht mehr angezeigt. */
  images?: string[]
  item?: AnimationItem | null
  /** Bereits aufgelöste Figur (überschreibt die Suche). */
  figure?: FigureEntry | null
  libraryId?: string | null
  name?: string | null
  muscle?: MuscleGroup | null
  secondary?: MuscleGroup[]
  alt: string
  still?: boolean
  className?: string
}) {
  const libId = libraryId ?? item?.id ?? null
  const label = name ?? item?.name_de ?? null
  const fig = useMemo(
    () => (figure !== undefined ? figure : figureForLibraryId(libId) ?? figureForName(label)),
    [figure, libId, label],
  )
  const main = muscle ?? item?.muscle ?? null
  const extra = secondary ?? item?.secondary ?? []

  if (still) {
    if (fig) {
      return (
        <span className={`block overflow-hidden bg-sand-light ring-1 ring-sand-dark/30 ${className}`} role="img" aria-label={alt || fig.name}>
          <ExerciseFigure entry={fig} thumb label={alt || fig.name} className="p-0.5" />
        </span>
      )
    }
    const t = main ? muscleTint(main) : null
    return (
      <span
        className={`grid place-items-center text-[13px] font-bold tracking-tight ${t ? `${t.soft} ${t.text}` : 'bg-sand text-cocoa-muted'} ${className}`}
        role="img"
        aria-label={alt || main || 'Übung'}
        title={main ?? undefined}
      >
        {main ? muscleAbbr(main) : '·'}
      </span>
    )
  }

  if (fig) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-sand-light ${className}`}>
        <ExerciseFigure entry={fig} label={alt || `Animation: ${fig.name}`} className="absolute inset-0" />
      </div>
    )
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-sand-light p-4 ${className}`}
      role="img"
      aria-label={alt || 'Animation folgt'}
    >
      {main && (
        <div className="flex flex-wrap justify-center gap-1.5">
          <MuscleChip muscle={main} />
          {extra.map((m) => (
            <span key={m} className="opacity-70">
              <MuscleChip muscle={m} size="xs" />
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-cocoa-muted">Animation folgt</p>
    </div>
  )
}
