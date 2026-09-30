import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Dumbbell,
  List,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useExercises } from '../../hooks/useExercises'
import { useWorkouts } from '../../hooks/useWorkouts'
import { useAiStatus } from '../../hooks/useAi'
import {
  useAddPlanExercise,
  useCreatePlan,
  useDeletePlan,
  usePlans,
  useRemovePlanExercise,
  useRenamePlan,
  useReorderPlanExercises,
} from '../../hooks/usePlans'
import { getPlanQueue } from '../../lib/workoutSession'
import { MUSCLE_GROUPS, type Exercise, type PlanWithExercises } from '../../types'
import { Sheet } from '../workout/Sheet'
import { AiPlanGeneratorBody } from './AiPlanGenerator'

/** Pläne im Hevy-„Routines"-Stil: Liste mit Starten-Button, Editor per ?edit=<id>. */
export default function PlansNew() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const editId = params.get('edit')
  const { data: plans, isLoading, isFetching } = usePlans()
  const { data: exercises } = useExercises()
  const { data: workouts } = useWorkouts()
  const { data: ai } = useAiStatus()
  const createPlan = useCreatePlan()

  const [sheet, setSheet] = useState<null | 'create' | 'ai'>(null)
  const [newName, setNewName] = useState('')
  const aiAvailable = !!ai?.enabled && (exercises?.length ?? 0) > 0

  const exName = useMemo(() => {
    const m = new Map((exercises ?? []).map((e) => [e.id, e.name]))
    return (id: string) => m.get(id) ?? 'Übung'
  }, [exercises])

  // Letztes Training je Plan: über die lokal gemerkte Plan-Vorlage je Workout.
  const lastByPlan = useMemo(() => {
    const m = new Map<string, string>()
    for (const w of workouts ?? []) {
      const q = getPlanQueue(w.id)
      if (!q?.planId) continue
      const prev = m.get(q.planId)
      if (!prev || w.date > prev) m.set(q.planId, w.date)
    }
    return m
  }, [workouts])

  function openEditor(id: string) {
    setParams({ edit: id })
  }

  function closeEditor() {
    // Mit Verlauf (per push geöffnet) → zurück; Direktaufruf → Parameter entfernen.
    if (location.key !== 'default') navigate(-1)
    else setParams({}, { replace: true })
  }

  function startPlan(plan: PlanWithExercises) {
    navigate('/', { state: { startPlanId: plan.id } })
  }

  async function submitCreate() {
    const name = newName.trim()
    if (!name || createPlan.isPending) return
    const plan = await createPlan.mutateAsync({ name, position: plans?.length ?? 0 })
    setNewName('')
    setSheet(null)
    openEditor(plan.id)
  }

  const editPlan = editId ? plans?.find((p) => p.id === editId) : undefined

  // Editor-ID zeigt auf gelöschten/unbekannten Plan → Parameter still entfernen.
  useEffect(() => {
    if (editId && plans && !isFetching && !editPlan) setParams({}, { replace: true })
  }, [editId, plans, isFetching, editPlan, setParams])

  if (editId && editPlan) {
    return (
      <PlanEditor
        plan={editPlan}
        exercises={exercises ?? []}
        onBack={closeEditor}
        onStart={() => startPlan(editPlan)}
      />
    )
  }

  const hasPlans = (plans?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-xl font-bold">Pläne</h1>
        <Link to="/exercises" className="btn-ghost flex items-center gap-1.5 text-sm">
          <List size={16} /> Übungen
        </Link>
        <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => setSheet('create')}>
          <Plus size={16} strokeWidth={2.5} /> Plan
        </button>
      </header>

      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      {hasPlans && (
        <ul className="space-y-3">
          {plans!.map((plan) => (
            <PlanListCard
              key={plan.id}
              plan={plan}
              exName={exName}
              lastDate={lastByPlan.get(plan.id)}
              onOpen={() => openEditor(plan.id)}
              onStart={() => startPlan(plan)}
            />
          ))}
        </ul>
      )}

      {hasPlans && aiAvailable && (
        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-cocoa-light"
          onClick={() => setSheet('ai')}
        >
          <Sparkles size={18} className="shrink-0 text-cocoa-muted" />
          <span className="flex-1">Plan von der KI erstellen</span>
          <ChevronRight size={16} className="text-cocoa-muted" />
        </button>
      )}

      {!isLoading && plans && !hasPlans && (
        <div className="card anim-fade space-y-4 py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sand text-cocoa-light">
            <ClipboardList size={26} />
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold">Noch keine Pläne</h2>
            <p className="text-sm text-cocoa-light">
              Stell dir Routinen wie „Push" oder „Beine" zusammen und starte sie mit einem Tipp.
            </p>
          </div>
          <div className="mx-auto flex max-w-xs flex-col gap-2">
            <button className="btn-primary flex items-center justify-center gap-1.5" onClick={() => setSheet('create')}>
              <Plus size={16} strokeWidth={2.5} /> Neuen Plan anlegen
            </button>
            {aiAvailable && (
              <button className="btn-ghost flex items-center justify-center gap-1.5" onClick={() => setSheet('ai')}>
                <Sparkles size={16} className="text-cocoa-light" /> Plan von der KI erstellen
              </button>
            )}
          </div>
        </div>
      )}

      {sheet === 'create' && (
        <Sheet title="Neuer Plan" onClose={() => setSheet(null)}>
          <label className="label" htmlFor="new-plan-name">
            Name
          </label>
          <input
            id="new-plan-name"
            className="input"
            placeholder="z. B. Push Day"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate()
            }}
          />
          <button
            className="btn-primary w-full"
            onClick={submitCreate}
            disabled={!newName.trim() || createPlan.isPending}
          >
            {createPlan.isPending ? 'Lege an…' : 'Plan erstellen'}
          </button>
          {aiAvailable && (
            <button
              className="btn-ghost flex w-full items-center justify-center gap-1.5 text-sm"
              onClick={() => setSheet('ai')}
            >
              <Sparkles size={16} className="text-cocoa-light" /> Plan von der KI erstellen
            </button>
          )}
        </Sheet>
      )}

      {sheet === 'ai' && (
        <Sheet title="KI-Plan" onClose={() => setSheet(null)}>
          <AiPlanGeneratorBody onClose={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function daysAgoLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const then = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'zuletzt heute'
  if (days === 1) return 'zuletzt gestern'
  return `zuletzt vor ${days} Tagen`
}

function PlanListCard({
  plan,
  exName,
  lastDate,
  onOpen,
  onStart,
}: {
  plan: PlanWithExercises
  exName: (id: string) => string
  lastDate: string | undefined
  onOpen: () => void
  onStart: () => void
}) {
  const names = plan.exercise_ids.map(exName)
  const summary =
    names.length === 0
      ? 'Noch keine Übungen'
      : names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '')

  return (
    <li className="card flex items-center gap-3">
      <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <div className="truncate font-bold">{plan.name}</div>
        <div className="truncate text-sm text-cocoa-light">{summary}</div>
        {lastDate && <div className="mt-0.5 text-xs text-cocoa-muted">{daysAgoLabel(lastDate)}</div>}
      </button>
      <button
        className="btn-primary flex shrink-0 items-center gap-1.5 text-sm"
        onClick={onStart}
        disabled={plan.exercise_ids.length === 0}
      >
        <Play size={14} className="fill-current" /> Starten
      </button>
    </li>
  )
}

// ---------------------------------------------------------------------------

function PlanEditor({
  plan,
  exercises,
  onBack,
  onStart,
}: {
  plan: PlanWithExercises
  exercises: Exercise[]
  onBack: () => void
  onStart: () => void
}) {
  const renamePlan = useRenamePlan()
  const deletePlan = useDeletePlan()
  const removeEx = useRemovePlanExercise()
  const reorder = useReorderPlanExercises()
  const [name, setName] = useState(plan.name)
  const [pickerOpen, setPickerOpen] = useState(false)
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  useEffect(() => setName(plan.name), [plan.name])

  function commitName() {
    const n = name.trim()
    if (n && n !== plan.name) renamePlan.mutate({ id: plan.id, name: n })
    else setName(plan.name)
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= plan.exercise_ids.length) return
    const ids = [...plan.exercise_ids]
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    reorder.mutate({ plan_id: plan.id, exercise_ids: ids })
  }

  function removePlan() {
    if (!confirm(`Plan „${plan.name}" löschen? (Übungen bleiben erhalten)`)) return
    // Erst Editor schließen, dann löschen — sonst konkurriert das Aufräumen des
    // ?edit-Parameters mit dem Zurück-Navigieren.
    onBack()
    deletePlan.mutate(plan.id)
  }

  return (
    <div className="anim-fade space-y-4">
      <header className="flex items-center gap-1">
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-cocoa-light"
          onClick={onBack}
          aria-label="Zurück zu Plänen"
        >
          <ChevronLeft size={22} />
        </button>
        <input
          className="input min-w-0 flex-1 font-bold"
          aria-label="Planname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
          aria-label="Plan löschen"
          onClick={removePlan}
          disabled={deletePlan.isPending}
        >
          <Trash2 size={18} />
        </button>
      </header>

      <section className="card space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Übungen</h2>
          <span className="tabular text-xs text-cocoa-muted">{plan.exercise_ids.length}</span>
        </div>

        {plan.exercise_ids.length > 0 ? (
          <ul className="divide-y divide-sand">
            {plan.exercise_ids.map((exId, i) => {
              const ex = exById.get(exId)
              return (
                <li key={exId} className="flex items-center gap-2 py-2">
                  <span className="tabular w-5 shrink-0 text-center text-xs text-cocoa-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{ex?.name ?? 'Übung'}</div>
                    {ex && <div className="text-xs text-cocoa-muted">{ex.muscle_group}</div>}
                  </div>
                  <button
                    className="grid h-7 w-6 place-items-center text-cocoa-muted disabled:opacity-30"
                    aria-label="Nach oben"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    className="grid h-7 w-6 place-items-center text-cocoa-muted disabled:opacity-30"
                    aria-label="Nach unten"
                    disabled={i === plan.exercise_ids.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    className="grid h-7 w-6 place-items-center text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
                    aria-label="Aus Plan entfernen"
                    onClick={() => removeEx.mutate({ plan_id: plan.id, exercise_id: exId })}
                  >
                    <X size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="py-2 text-sm text-cocoa-muted">Noch keine Übungen in diesem Plan.</p>
        )}

        <button
          className="btn-ghost flex w-full items-center justify-center gap-1.5 text-sm"
          onClick={() => setPickerOpen(true)}
        >
          <Plus size={16} /> Übung hinzufügen
        </button>
      </section>

      <button
        className="btn-primary flex w-full items-center justify-center gap-1.5"
        onClick={onStart}
        disabled={plan.exercise_ids.length === 0}
      >
        <Play size={16} className="fill-current" /> Training starten
      </button>

      {pickerOpen && (
        <ExercisePickerSheet plan={plan} exercises={exercises} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ExercisePickerSheet({
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
  // Positionen fortlaufend vergeben, auch wenn mehrere Übungen schnell hintereinander kommen.
  const nextPos = useRef(plan.exercise_ids.length)

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

  async function toggle(ex: Exercise) {
    if (pending.has(ex.id)) return
    mark(ex.id, true)
    try {
      if (plan.exercise_ids.includes(ex.id)) {
        await removeEx.mutateAsync({ plan_id: plan.id, exercise_id: ex.id })
      } else {
        const position = Math.max(nextPos.current, plan.exercise_ids.length)
        nextPos.current = position + 1
        await addEx.mutateAsync({ plan_id: plan.id, exercise_id: ex.id, position })
      }
    } finally {
      mark(ex.id, false)
    }
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
      active ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
    }`

  return (
    <Sheet title="Übung hinzufügen" onClose={onClose}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted" />
        <input
          className="input pl-9"
          placeholder="Übung suchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
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
        <ul className="divide-y divide-sand">
          {list.map((ex) => {
            const inPlan = plan.exercise_ids.includes(ex.id)
            const busy = pending.has(ex.id)
            return (
              <li key={ex.id}>
                <button
                  className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-60"
                  onClick={() => toggle(ex)}
                  disabled={busy}
                  aria-pressed={inPlan}
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light">
                    <Dumbbell size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{ex.name}</div>
                    <div className="text-xs text-cocoa-muted">{ex.muscle_group}</div>
                  </div>
                  {inPlan ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <Check size={16} strokeWidth={2.5} /> im Plan
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-brand">
                      <Plus size={14} strokeWidth={2.5} /> hinzufügen
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="py-4 text-center text-sm text-cocoa-muted">
          Keine Übung gefunden.{' '}
          <Link to="/exercises" className="underline">
            Übungen verwalten
          </Link>
        </p>
      )}

      <button className="btn-primary w-full" onClick={onClose}>
        Fertig
      </button>
    </Sheet>
  )
}
