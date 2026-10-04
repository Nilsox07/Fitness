import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, Home, Plus, Search, TriangleAlert } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { MuscleChip } from '../exercises/MuscleBits'
import { useCreateExercise, useExercises } from '../../hooks/useExercises'
import {
  LIBRARY_ATTRIBUTION,
  LIBRARY_EQUIPMENT,
  findLibraryMatch,
  getLinks,
  libraryMuscles,
  libraryToExerciseInput,
  repRangeFor,
  searchLibrary,
  setLink,
  type LibraryExercise,
} from '../../lib/exerciseLibrary'
import type { Exercise, MuscleGroup } from '../../types'
import { ExerciseAnimation } from './ExerciseAnimation'
import { Steps } from './ExerciseHowTo'
import { useLibrary } from './useLibrary'

const PAGE = 40

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
        on ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
      }`}
    >
      {children}
    </button>
  )
}

const chipRow =
  '-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/**
 * Übungsbibliothek als Bottom-Sheet: Suche, Filter (Muskel, Equipment, Zuhause),
 * Liste mit Vorschaubild und Detailansicht mit Animation & Ausführung.
 * „Zu meinen Übungen hinzufügen" legt eine eigene Übung an und merkt sich die
 * Verknüpfung (localStorage `exercise_library_links`).
 */
export function LibrarySheet({
  onClose,
  onAdded,
  existingAction,
}: {
  onClose: () => void
  /** Nach dem Anlegen der eigenen Übung. */
  onAdded?: (exercise: Exercise, item: LibraryExercise) => void
  /** Aktion für Einträge, die es schon als eigene Übung gibt (z. B. „Öffnen"). */
  existingAction?: { label: string; run: (exercise: Exercise) => void }
}) {
  const { list, error, loading, retry } = useLibrary()
  const { data: mine } = useExercises()
  const createEx = useCreateExercise()

  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)
  const [equipment, setEquipment] = useState<string | null>(null)
  const [home, setHome] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState<LibraryExercise | null>(null)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listScroll = useRef(0)

  const muscles = useMemo(() => (list ? libraryMuscles(list) : []), [list])
  const results = useMemo(
    () => (list ? searchLibrary(list, { query, muscle, equipment, home }) : []),
    [list, query, muscle, equipment, home],
  )

  // Bibliotheks-ID → eigene Übung (Verknüpfung oder gleicher Name)
  const owned = useMemo(() => {
    const map = new Map<string, Exercise>()
    if (!list || !mine) return map
    const links = getLinks()
    for (const ex of mine) {
      const m = findLibraryMatch(ex, list, links)
      if (m && !map.has(m.id)) map.set(m.id, ex)
    }
    return map
  }, [list, mine])

  function scroller() {
    return rootRef.current?.closest('[role="dialog"]') as HTMLElement | null
  }

  function open(item: LibraryExercise) {
    listScroll.current = scroller()?.scrollTop ?? 0
    setSaveErr(null)
    setSelected(item)
    requestAnimationFrame(() => scroller()?.scrollTo({ top: 0 }))
  }

  function back() {
    setSelected(null)
    requestAnimationFrame(() => scroller()?.scrollTo({ top: listScroll.current }))
  }

  function resetFilters(fn: () => void) {
    fn()
    setLimit(PAGE)
  }

  async function add(item: LibraryExercise) {
    if (createEx.isPending) return
    setSaveErr(null)
    try {
      const created = await createEx.mutateAsync(libraryToExerciseInput(item))
      setLink(created.id, item.id)
      if (onAdded) onAdded(created, item)
      else onClose()
    } catch (e) {
      setSaveErr(
        `Konnte nicht speichern: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}. Bitte Verbindung prüfen.`,
      )
    }
  }

  const footer = (
    <p className="pt-1 text-center text-[11px] text-cocoa-muted">{LIBRARY_ATTRIBUTION}</p>
  )

  // ---- Detailansicht ----
  if (selected) {
    const existing = owned.get(selected.id)
    const [min, max] = repRangeFor(selected)
    return (
      <Sheet title={selected.name_de} onClose={onClose}>
        <div ref={rootRef} className="anim-fade space-y-4">
          <button
            type="button"
            onClick={back}
            className="-mt-1 flex items-center gap-1 text-sm font-medium text-cocoa-light"
          >
            <ChevronLeft size={16} /> Bibliothek
          </button>

          <ExerciseAnimation
            images={selected.images}
            alt={`Animation: ${selected.name_de}`}
            className="aspect-[4/3] w-full"
          />

          <div className="flex flex-wrap gap-1.5">
            <MuscleChip muscle={selected.muscle} />
            {selected.secondary.map((m) => (
              <span key={m} className="opacity-70">
                <MuscleChip muscle={m} size="xs" />
              </span>
            ))}
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Equipment', selected.equipment],
              ['Level', selected.level],
              ['Typ', selected.mechanic],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-sand-light px-2 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-cocoa-muted">{k}</dt>
                <dd className="truncate text-sm font-semibold text-cocoa">{v}</dd>
              </div>
            ))}
          </dl>

          <section className="space-y-2">
            <h3 className="font-semibold">Ausführung</h3>
            <Steps steps={selected.steps_de} />
          </section>

          <p className="text-xs text-cocoa-light">
            {selected.name_en !== selected.name_de && <>Englisch: {selected.name_en} · </>}
            Empfehlung: {min}–{max} Wiederholungen
          </p>

          {saveErr && (
            <p className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
              <TriangleAlert size={16} className="shrink-0" /> {saveErr}
            </p>
          )}

          {existing ? (
            <div className="space-y-2">
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-success">
                <Check size={16} strokeWidth={3} /> Bereits in deinen Übungen
                {existing.name !== selected.name_de && <span className="text-cocoa-light">(„{existing.name}")</span>}
              </p>
              {existingAction && (
                <button className="btn-primary w-full" onClick={() => existingAction.run(existing)}>
                  {existingAction.label}
                </button>
              )}
            </div>
          ) : (
            <button
              className="btn-primary w-full gap-1.5"
              onClick={() => add(selected)}
              disabled={createEx.isPending}
            >
              <Plus size={18} /> {createEx.isPending ? 'Füge hinzu…' : 'Zu meinen Übungen hinzufügen'}
            </button>
          )}
          {footer}
        </div>
      </Sheet>
    )
  }

  // ---- Liste ----
  const shown = results.slice(0, limit)
  return (
    <Sheet title="Übungsbibliothek" onClose={onClose}>
      <div ref={rootRef} className="space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted"
          />
          <input
            className="input pl-9"
            type="search"
            placeholder="Suchen (deutsch oder englisch) …"
            value={query}
            onChange={(e) => resetFilters(() => setQuery(e.target.value))}
            aria-label="Bibliothek durchsuchen"
          />
        </div>

        {list && (
          <>
            <div className={chipRow}>
              <Chip on={muscle === null} onClick={() => resetFilters(() => setMuscle(null))}>
                Alle
              </Chip>
              {muscles.map((m) => (
                <Chip key={m} on={muscle === m} onClick={() => resetFilters(() => setMuscle(muscle === m ? null : m))}>
                  {m}
                </Chip>
              ))}
            </div>
            <div className={chipRow}>
              <Chip on={home} onClick={() => resetFilters(() => setHome((h) => !h))}>
                <Home size={13} /> Zuhause
              </Chip>
              {LIBRARY_EQUIPMENT.map((eq) => (
                <Chip
                  key={eq}
                  on={equipment === eq}
                  onClick={() => resetFilters(() => setEquipment(equipment === eq ? null : eq))}
                >
                  {eq}
                </Chip>
              ))}
            </div>
            <p className="tabular px-1 text-xs text-cocoa-muted">
              {results.length} {results.length === 1 ? 'Übung' : 'Übungen'}
            </p>
          </>
        )}

        {loading && (
          <div className="space-y-px overflow-hidden rounded-2xl" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-sand" />
            ))}
          </div>
        )}

        {error && (
          <div className="space-y-2 rounded-2xl bg-sand-light p-3 text-sm">
            <p className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
              <TriangleAlert size={16} className="shrink-0" /> {error}
            </p>
            <button className="btn-ghost w-full" onClick={retry}>
              Erneut versuchen
            </button>
          </div>
        )}

        {list && results.length === 0 && (
          <p className="py-6 text-center text-sm text-cocoa-light">Keine Übung gefunden.</p>
        )}

        {shown.length > 0 && (
          <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-sand-light">
            {shown.map((item) => {
              const has = owned.has(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className="flex w-full items-center gap-3 px-2.5 py-2 text-left"
                  >
                    <ExerciseAnimation images={item.images} alt="" still className="h-14 w-14 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-cocoa">{item.name_de}</span>
                      <span className="block truncate text-xs text-cocoa-light">
                        {item.muscle} · {item.equipment}
                      </span>
                    </span>
                    {has ? (
                      <Check size={16} strokeWidth={3} className="shrink-0 text-success" aria-label="Bereits hinzugefügt" />
                    ) : (
                      <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {results.length > shown.length && (
          <button className="btn-ghost w-full" onClick={() => setLimit((l) => l + PAGE)}>
            Mehr anzeigen ({results.length - shown.length})
          </button>
        )}

        {footer}
      </div>
    </Sheet>
  )
}
