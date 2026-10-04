import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus, Search } from 'lucide-react'
import { nextExercisePosition, useAddPlanExercise, useRemovePlanExercise } from '../../hooks/usePlans'
import { MUSCLE_GROUPS, type Exercise, type PlanWithExercises } from '../../types'
import { Sheet } from '../workout/Sheet'
import { MuscleAvatar } from '../exercises/MuscleBits'
import { ExerciseAnimation } from '../library/ExerciseAnimation'
import { figureForExercise, figureForLibraryId } from '../../lib/figure/catalog'
import { LibraryResults } from '../library/LibraryResults'
import { LibrarySheet } from '../library/LibrarySheet'
import { useLibrary, useLibraryLinks } from '../library/useLibrary'

/**
 * Übungen zum Plan hinzufügen/entfernen (Mehrfachauswahl, sofort gespeichert).
 * Unter den eigenen Übungen: Treffer aus der Übungsbibliothek — antippen legt
 * die Übung an (verknüpft) und fügt sie direkt dem Plan hinzu.
 */
export function ExercisePickerSheet({
  plan,
  exercises,
  onClose,
}: {
  plan: PlanWithExercises
  exercises: Exercise[]
  onClose: () => void
}) {
  const addEx = useAddPlanExercise()
  const removeEx = useRemovePlanExercise()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [libOpen, setLibOpen] = useState(false)
  const { list: library } = useLibrary()
  const { byExercise } = useLibraryLinks(exercises, library)
  // Figur über die Verknüpfung, sonst über den Namen (keine Fotos mehr).
  const figOf = (ex: Exercise) => figureForLibraryId(byExercise.get(ex.id)?.id) ?? figureForExercise(ex)
  // Positionen fortlaufend vergeben, auch wenn mehrere Übungen schnell hintereinander kommen.
  const nextPos = useRef(nextExercisePosition(plan))

  const groups = useMemo(
    () => MUSCLE_GROUPS.filter((g) => exercises.some((e) => e.muscle_group === g)),
    [exercises],
  )

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises
      .filter((e) => (!group || e.muscle_group === group) && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [exercises, query, group])

  function mark(id: string, on: boolean) {
    setPending((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /** Neu angelegte Bibliotheks-Übung (oder vorhandene) ans Planende hängen. */
  async function addToPlan(id: string) {
    if (plan.exercise_ids.includes(id) || pending.has(id)) return
    mark(id, true)
    try {
      const position = Math.max(nextPos.current, nextExercisePosition(plan))
      nextPos.current = position + 1
      await addEx.mutateAsync({ plan_id: plan.id, exercise_id: id, position })
    } finally {
      mark(id, false)
    }
  }

  async function toggle(ex: Exercise) {
    if (pending.has(ex.id)) return
    mark(ex.id, true)
    try {
      if (plan.exercise_ids.includes(ex.id)) {
        await removeEx.mutateAsync({ plan_id: plan.id, exercise_id: ex.id })
      } else {
        const position = Math.max(nextPos.current, nextExercisePosition(plan))
        nextPos.current = position + 1
        await addEx.mutateAsync({ plan_id: plan.id, exercise_id: ex.id, position })
      }
    } finally {
      mark(ex.id, false)
    }
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      active ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
    }`

  const inPlanCount = plan.exercise_ids.length

  if (libOpen) {
    return (
      <LibrarySheet
        onClose={() => setLibOpen(false)}
        onAdded={(ex) => {
          setLibOpen(false)
          addToPlan(ex.id)
        }}
        existingAction={{
          label: 'Zum Plan hinzufügen',
          run: (ex) => {
            setLibOpen(false)
            addToPlan(ex.id)
          },
        }}
      />
    )
  }

  return (
    <Sheet title="Übung hinzufügen" onClose={onClose}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted" />
        <input
          className="input pl-9"
          type="search"
          placeholder="Übung suchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button className={chip(group === null)} onClick={() => setGroup(null)}>
          Alle
        </button>
        {groups.map((g) => (
          <button key={g} className={chip(group === g)} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>

      {list.length > 0 ? (
        <ul className="divide-y divide-sand-dark/40 rounded-2xl bg-sand-light">
          {list.map((ex) => {
            const inPlan = plan.exercise_ids.includes(ex.id)
            const busy = pending.has(ex.id)
            return (
              <li key={ex.id}>
                <button
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:opacity-60"
                  onClick={() => toggle(ex)}
                  disabled={busy}
                  aria-pressed={inPlan}
                >
                  {figOf(ex) ? (
                    <ExerciseAnimation
                      figure={figOf(ex)}
                      alt=""
                      still
                      className="h-[34px] w-[34px] shrink-0 rounded-lg"
                    />
                  ) : (
                    <MuscleAvatar muscle={ex.muscle_group} size={34} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{ex.name}</div>
                    <div className="text-xs text-cocoa-muted">{ex.muscle_group}</div>
                  </div>
                  {inPlan ? (
                    <span
                      key="on"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success text-white"
                      style={{ animation: 'check-pop .28s ease-out both' }}
                      aria-label="im Plan"
                    >
                      <Check size={15} strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      key="off"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-brand ring-1 ring-sand-dark"
                      aria-label="hinzufügen"
                    >
                      <Plus size={15} strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="py-3 text-center text-sm text-cocoa-muted">
          Keine eigene Übung gefunden.{' '}
          <Link to="/exercises" className="underline">
            Übungen verwalten
          </Link>
        </p>
      )}

      <LibraryResults
        query={query}
        muscle={group}
        tone="sand"
        onPicked={(ex) => addToPlan(ex.id)}
        onBrowseAll={() => setLibOpen(true)}
      />

      <button className="btn-primary w-full" onClick={onClose}>
        Fertig{inPlanCount > 0 && <span className="tabular ml-1 opacity-80">· {inPlanCount} im Plan</span>}
      </button>
    </Sheet>
  )
}
