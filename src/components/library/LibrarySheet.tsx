import { useState } from 'react'
import { Sheet } from '../workout/Sheet'
import type { LibraryExercise } from '../../lib/exerciseLibrary'
import type { Exercise } from '../../types'
import { LibraryBrowser, type LibraryBrowserProps } from './LibraryBrowser'

/**
 * Übungsbibliothek als Bottom-Sheet (Inhalt: `LibraryBrowser`).
 * „Zu meinen Übungen hinzufügen" legt eine eigene Übung an und merkt sich die
 * Verknüpfung (localStorage `exercise_library_links`). Im `pick`-Modus wird
 * nur ein Eintrag ausgewählt (z. B. zum Verknüpfen einer eigenen Übung).
 */
export function LibrarySheet({
  onClose,
  onAdded,
  existingAction,
  title = 'Übungsbibliothek',
  ...rest
}: {
  onClose: () => void
  /** Nach dem Anlegen der eigenen Übung (ohne: Sheet schließt). */
  onAdded?: (exercise: Exercise, item: LibraryExercise) => void
  /** Aktion für Einträge, die es schon als eigene Übung gibt (z. B. „Öffnen"). */
  existingAction?: { label: string; run: (exercise: Exercise) => void }
  title?: string
} & Pick<LibraryBrowserProps, 'mode' | 'onPick' | 'pickLabel' | 'initialQuery' | 'currentId' | 'suggestions'>) {
  const [selected, setSelected] = useState<LibraryExercise | null>(null)
  return (
    <Sheet title={selected ? selected.name_de : title} onClose={onClose}>
      <LibraryBrowser
        {...rest}
        onViewChange={setSelected}
        existingAction={existingAction}
        onAdded={(ex, item) => (onAdded ? onAdded(ex, item) : onClose())}
      />
    </Sheet>
  )
}
