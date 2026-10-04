import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Dumbbell, List, PenLine, Plus, Sparkles } from 'lucide-react'
import { useExercises } from '../../hooks/useExercises'
import { useAllSets, useWorkouts } from '../../hooks/useWorkouts'
import { useAiStatus } from '../../hooks/useAi'
import { nextPlanPosition, useCreatePlan, usePlans } from '../../hooks/usePlans'
import { getPlanQueue } from '../../lib/workoutSession'
import { lastDoneByPlan, suggestNextPlan } from '../../lib/home'
import { trainingDay } from '../../lib/day'
import type { PlanWithExercises } from '../../types'
import { Sheet } from '../workout/Sheet'
import { agoLong, enter } from '../exercises/muscle'
import { MyBuddy } from '../buddy/MyBuddy'
import { AiPlanGeneratorBody } from './AiPlanGenerator'
import { PlanCard } from './PlanCard'
import { PlanEditor } from './PlanEditor'
import { QuickWorkoutCard } from '../quick/QuickWorkoutCard'

/** Pläne im Routine-Stil (Neu-Modus): Liste mit Play-Knopf, Editor per ?edit=<id>. */
export default function PlansNew() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const editId = params.get('edit')
  const { data: plans, isLoading, isFetching } = usePlans()
  const { data: exercises } = useExercises()
  const { data: workouts } = useWorkouts()
  const { data: allSets } = useAllSets()
  const { data: ai } = useAiStatus()
  const createPlan = useCreatePlan()

  const [sheet, setSheet] = useState<null | 'create' | 'ai'>(null)
  const [newName, setNewName] = useState('')
  const aiAvailable = !!ai?.enabled && (exercises?.length ?? 0) > 0
  const today = trainingDay()

  const exById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])

  // Wann lief welcher Plan zuletzt? Vorschlag wie auf dem Start-Screen (Plan-Zuordnung nur vor heute).
  const { suggested, lastDone } = useMemo(() => {
    const list = plans ?? []
    const sets = allSets ?? []
    const before = new Map<string, string>()
    const all = new Map<string, string>()
    for (const w of workouts ?? []) {
      const q = getPlanQueue(w.id)
      if (!q?.planId) continue
      if ((all.get(q.planId) ?? '') < w.date) all.set(q.planId, w.date)
      if (w.date < today && (before.get(q.planId) ?? '') < w.date) before.set(q.planId, w.date)
    }
    const anyFilled = list.some((p) => p.exercise_ids.length > 0)
    return {
      suggested: anyFilled ? suggestNextPlan(list, sets, before) : null,
      lastDone: lastDoneByPlan(list, sets, all),
    }
  }, [plans, workouts, allSets, today])

  // Untertitel: „3 Pläne · zuletzt: Push vor 3 Tagen"
  const subtitle = useMemo(() => {
    if (!plans) return 'Lädt…'
    const n = plans.length
    const head = `${n} ${n === 1 ? 'Plan' : 'Pläne'}`
    let recent: PlanWithExercises | null = null
    let recentDate = ''
    for (const p of plans) {
      const d = lastDone.get(p.id)
      if (d && d > recentDate) {
        recent = p
        recentDate = d
      }
    }
    return recent ? `${head} · zuletzt: ${recent.name} ${agoLong(recentDate, today)}` : head
  }, [plans, lastDone, today])

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
    const plan = await createPlan.mutateAsync({ name, position: nextPlanPosition(plans) })
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
  const hasExercises = (exercises?.length ?? 0) > 0
  let idx = 1

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3" style={enter(0)}>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Pläne</h1>
          <p className="tabular mt-0.5 truncate text-sm text-cocoa-light">{subtitle}</p>
        </div>
        <div className="mt-1 flex shrink-0 gap-2">
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-sand text-cocoa transition active:scale-95"
            onClick={() => navigate('/exercises')}
            aria-label="Übungen"
            title="Übungen"
          >
            <List size={18} />
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-brand text-on-brand shadow-md shadow-brand/25 transition active:scale-95"
            onClick={() => setSheet('create')}
            aria-label="Neuer Plan"
            title="Neuer Plan"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {isLoading && (
        <div className="space-y-3" aria-hidden>
          <div className="h-36 animate-pulse rounded-3xl bg-sand" />
          <div className="h-28 animate-pulse rounded-3xl bg-sand" />
          <div className="h-28 animate-pulse rounded-3xl bg-sand" />
        </div>
      )}

      {!isLoading && <QuickWorkoutCard title="Schnell-Workout · keine Zeit?" style={enter(idx++)} />}

      {hasPlans && (
        <ul className="space-y-3">
          {plans!.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              exById={exById}
              lastDone={lastDone.get(plan.id)}
              today={today}
              suggested={suggested?.id === plan.id}
              onOpen={() => openEditor(plan.id)}
              onStart={() => startPlan(plan)}
              style={enter(idx++)}
            />
          ))}
        </ul>
      )}

      {hasPlans && aiAvailable && (
        <button
          className="flex w-full items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-left transition active:scale-[0.99]"
          onClick={() => setSheet('ai')}
          style={enter(idx++)}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
            <Sparkles size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Plan mit KI erstellen</span>
            <span className="block truncate text-xs text-cocoa-light">Wunsch eingeben, Vorschlag übernehmen</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
        </button>
      )}

      {!isLoading && plans && !hasPlans && (
        <section className="space-y-4 pt-2" style={enter(1)}>
          <div className="flex flex-col items-center text-center">
            <div className="relative grid h-24 w-24 place-items-center">
              <span className="absolute inset-0 rounded-full bg-brand/10 blur-xl" aria-hidden />
              <MyBuddy size={96} mood="happy" className="relative" />
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-tight">Noch keine Pläne</h2>
            <p className="mt-1 max-w-xs text-sm text-cocoa-light">
              Stell dir Routinen wie „Push" oder „Beine" zusammen und starte sie mit einem Tipp.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <EmptyTile
              primary
              icon={<PenLine size={22} />}
              title="Selbst erstellen"
              desc="Übungen frei wählen"
              onClick={() => setSheet('create')}
            />
            {aiAvailable ? (
              <EmptyTile
                icon={<Sparkles size={22} />}
                title="Mit KI erstellen"
                desc="Aus deinem Wunsch"
                onClick={() => setSheet('ai')}
              />
            ) : (
              <EmptyTile
                icon={<Dumbbell size={22} />}
                title={hasExercises ? 'Übungen' : 'Übungen anlegen'}
                desc={hasExercises ? 'Deine Übungsliste' : 'Zuerst die Grundlage'}
                onClick={() => navigate('/exercises')}
              />
            )}
          </div>
        </section>
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
          <div className="flex flex-wrap gap-1.5">
            {['Push', 'Pull', 'Beine', 'Oberkörper', 'Ganzkörper'].map((n) => (
              <button
                key={n}
                type="button"
                className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-cocoa-light"
                onClick={() => setNewName(n)}
              >
                {n}
              </button>
            ))}
          </div>
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
              <Sparkles size={16} className="text-brand" /> Plan mit KI erstellen
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

function EmptyTile({
  icon,
  title,
  desc,
  onClick,
  primary = false,
}: {
  icon: ReactNode
  title: string
  desc: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      className={`relative flex h-36 flex-col justify-between overflow-hidden rounded-3xl p-4 text-left transition active:scale-[0.97] ${
        primary ? 'bg-brand text-on-brand shadow-lg shadow-brand/25' : 'bg-cream text-cocoa'
      }`}
      onClick={onClick}
    >
      {primary && (
        <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
      )}
      <span
        className={`relative grid h-11 w-11 place-items-center rounded-full ${
          primary ? 'bg-white/20' : 'bg-brand/15 text-brand'
        }`}
      >
        {icon}
      </span>
      <span className="relative">
        <span className="block font-bold leading-tight">{title}</span>
        <span className={`mt-0.5 block text-xs ${primary ? 'opacity-80' : 'text-cocoa-light'}`}>{desc}</span>
      </span>
    </button>
  )
}
