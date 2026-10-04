import { useMemo } from 'react'
import { BookOpen, ChevronRight, Loader2, Plus, TriangleAlert } from 'lucide-react'
import { useExercises } from '../../hooks/useExercises'
import { searchLibrary, type LibraryExercise } from '../../lib/exerciseLibrary'
import type { Exercise, MuscleGroup } from '../../types'
import { ExerciseAnimation } from './ExerciseAnimation'
import { useAddFromLibrary, useLibrary, useLibraryLinks } from './useLibrary'

const EQUIP_ORDER: Record<string, number> = { Langhantel: 0, Kurzhantel: 1, Maschine: 2, Kabelzug: 3, Körpergewicht: 4 }

/** Ohne Suchbegriff: gängige Grundübungen mit klassischem Equipment zuerst. */
function popular(a: LibraryExercise, b: LibraryExercise): number {
  return (
    (a.mechanic === 'Grundübung' ? 0 : 1) - (b.mechanic === 'Grundübung' ? 0 : 1) ||
    (EQUIP_ORDER[a.equipment] ?? 9) - (EQUIP_ORDER[b.equipment] ?? 9) ||
    (a.level === 'Anfänger' ? 0 : 1) - (b.level === 'Anfänger' ? 0 : 1) ||
    a.name_de.length - b.name_de.length
  )
}

/**
 * Abschnitt „Aus der Bibliothek" für Übungs-Picker: Suchtreffer der Bibliothek
 * (ohne Einträge, die es schon als eigene Übung gibt). Antippen legt die
 * eigene Übung an, verknüpft sie und meldet sie per `onPicked`.
 */
export function LibraryResults({
  query,
  muscle = null,
  limit = 6,
  onPicked,
  onBrowseAll,
  tone = 'cream',
}: {
  query: string
  /** Ohne Suchbegriff: Vorschläge für diese Muskelgruppe. */
  muscle?: string | null
  limit?: number
  onPicked: (exercise: Exercise, item: LibraryExercise) => void
  /** Link „Ganze Bibliothek durchsuchen". */
  onBrowseAll?: () => void
  tone?: 'cream' | 'sand'
}) {
  const q = query.trim()
  const active = q.length >= 2 || !!muscle
  const { list, loading } = useLibrary()
  const { data: mine } = useExercises()
  const { byLibrary } = useLibraryLinks(mine, list)
  const { add, pendingId, busy, error } = useAddFromLibrary()

  const results = useMemo(() => {
    if (!list || !active) return []
    const found = searchLibrary(list, {
      query: q.length >= 2 ? q : '',
      muscle: (muscle as MuscleGroup | null) ?? null,
    }).filter((e) => !byLibrary.has(e.id))
    return (q.length >= 2 ? found : [...found].sort(popular)).slice(0, limit)
  }, [list, active, q, muscle, byLibrary, limit])

  async function pick(item: LibraryExercise) {
    if (busy) return
    const ex = await add(item)
    if (ex) onPicked(ex, item)
  }

  const bg = tone === 'cream' ? 'bg-cream' : 'bg-sand-light'
  if (!active && !onBrowseAll) return null

  return (
    <section className="space-y-1.5">
      {(results.length > 0 || (active && loading)) && (
        <h3 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
          <BookOpen size={13} /> Aus der Bibliothek
        </h3>
      )}
      {active && loading && <div className="h-16 animate-pulse rounded-2xl bg-sand" aria-hidden />}
      {results.length > 0 && (
        <ul className={`divide-y divide-sand-dark/40 overflow-hidden rounded-2xl ${bg}`}>
          {results.map((item) => {
            const pending = pendingId === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-2.5 py-2 text-left transition-colors active:bg-sand disabled:opacity-60"
                  onClick={() => pick(item)}
                  disabled={busy}
                >
                  <ExerciseAnimation item={item} alt="" still className="h-11 w-11 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-cocoa">{item.name_de}</span>
                    <span className="block truncate text-xs text-cocoa-light">
                      {item.muscle} · {item.equipment}
                    </span>
                  </span>
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-brand ring-1 ring-sand-dark"
                    aria-label="Anlegen und hinzufügen"
                  >
                    {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} strokeWidth={2.5} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && (
        <p className="flex items-center gap-1.5 px-1 text-xs text-red-500 dark:text-red-400">
          <TriangleAlert size={14} className="shrink-0" /> {error}
        </p>
      )}
      {onBrowseAll && (
        <button
          type="button"
          onClick={onBrowseAll}
          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors active:bg-sand ${bg}`}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <BookOpen size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-cocoa">Ganze Bibliothek durchsuchen</span>
            <span className="block truncate text-xs text-cocoa-light">Über 600 Übungen mit Animation</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
        </button>
      )}
    </section>
  )
}
