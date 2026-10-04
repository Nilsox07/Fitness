import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronUp, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import {
  useDeletePlan,
  useRemovePlanExercise,
  useRenamePlan,
  useReorderPlanExercises,
} from '../../hooks/usePlans'
import { estimateMinutes } from '../../lib/home'
import type { Exercise, PlanWithExercises } from '../../types'
import { CoverageBar, MuscleChip } from '../exercises/MuscleBits'
import { CATEGORY_LABEL, CATEGORY_TINT, categoryShares, enter, muscleWeights } from '../exercises/muscle'
import { ExercisePickerSheet } from './ExercisePickerSheet'

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-3 text-center">
      <div className="tabular truncate text-xl font-bold leading-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-cocoa-muted">{label}</div>
    </div>
  )
}

/** Plan-Editor (Neu-Modus): Name inline, Kennzahlen, nummerierte Übungen, fester Start-Knopf. */
export function PlanEditor({
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

  const exs = plan.exercise_ids.map((id) => exById.get(id)).filter((e): e is Exercise => Boolean(e))
  const weights = muscleWeights(exs)
  const shares = categoryShares(weights)
  const count = plan.exercise_ids.length

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

  const iconBtn = 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand transition active:scale-95'

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between" style={enter(0)}>
        <button className={`${iconBtn} text-cocoa`} onClick={onBack} aria-label="Zurück zu Plänen">
          <ChevronLeft size={22} />
        </button>
        <button
          className={`${iconBtn} text-cocoa-light hover:text-red-500 dark:hover:text-red-400`}
          aria-label="Plan löschen"
          onClick={removePlan}
          disabled={deletePlan.isPending}
        >
          <Trash2 size={18} />
        </button>
      </header>

      <div style={enter(1)}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">Plan</p>
        <label className="group relative mt-0.5 flex items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg bg-transparent py-0.5 text-3xl font-bold tracking-tight text-cocoa outline-none placeholder:text-cocoa-muted focus:bg-sand-light focus:px-2 focus:ring-2 focus:ring-brand"
            aria-label="Planname"
            placeholder="Planname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          <Pencil size={16} className="shrink-0 text-cocoa-muted group-focus-within:hidden" aria-hidden />
        </label>
      </div>

      <section className="rounded-2xl bg-cream" style={enter(2)}>
        <div className="grid grid-cols-3 divide-x divide-sand-dark/40">
          <Stat label={count === 1 ? 'Übung' : 'Übungen'} value={count} />
          <Stat label="Minuten" value={count > 0 ? `~${estimateMinutes(count)}` : '–'} />
          <Stat label="Muskeln" value={weights.length || '–'} />
        </div>
        {shares.length > 0 && (
          <div className="border-t border-sand-dark/40 px-4 pb-3.5 pt-3">
            <CoverageBar shares={shares} />
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {shares.map((s) => (
                <span key={s.category} className="flex items-center gap-1.5 text-[11px] text-cocoa-light">
                  <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_TINT[s.category].solid}`} />
                  {CATEGORY_LABEL[s.category]}
                  <span className="tabular text-cocoa-muted">{Math.round(s.share * 100)} %</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2" style={enter(3)}>
        <h2 className="flex items-baseline justify-between px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
          Übungen
          <span className="tabular normal-case tracking-normal">{count}</span>
        </h2>

        <div className="overflow-hidden rounded-2xl bg-cream">
          {count > 0 ? (
            <ul className="divide-y divide-sand-dark/40">
              {plan.exercise_ids.map((exId, i) => {
                const ex = exById.get(exId)
                return (
                  <li key={exId} className="flex items-center gap-3 py-2.5 pl-3 pr-2">
                    <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sand text-xs font-bold text-cocoa-light">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{ex?.name ?? 'Übung'}</div>
                      {ex && (
                        <div className="mt-1">
                          <MuscleChip muscle={ex.muscle_group} size="xs" />
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <button
                        className="grid h-6 w-8 place-items-center rounded-md text-cocoa-muted active:bg-sand disabled:opacity-25"
                        aria-label="Nach oben"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        className="grid h-6 w-8 place-items-center rounded-md text-cocoa-muted active:bg-sand disabled:opacity-25"
                        aria-label="Nach unten"
                        disabled={i === count - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    <button
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-cocoa-muted hover:text-red-500 active:bg-sand dark:hover:text-red-400"
                      aria-label="Aus Plan entfernen"
                      onClick={() => removeEx.mutate({ plan_id: plan.id, exercise_id: exId })}
                    >
                      <X size={16} />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 pt-4 text-sm text-cocoa-muted">Noch keine Übungen in diesem Plan.</p>
          )}

          <button
            className={`flex w-full items-center gap-3 px-3 py-3 text-left text-sm font-semibold text-brand transition active:bg-sand-light ${
              count > 0 ? 'border-t border-sand-dark/40' : ''
            }`}
            onClick={() => setPickerOpen(true)}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/15">
              <Plus size={16} strokeWidth={2.5} />
            </span>
            Übung hinzufügen
          </button>
        </div>
      </section>

      {/* Platz für den festen Start-Knopf */}
      <div className="h-16" aria-hidden />

      <div
        className="pointer-events-none fixed inset-x-0 z-10 mx-auto max-w-md px-4"
        style={{ bottom: 'calc(82px + env(safe-area-inset-bottom))' }}
      >
        <button
          className="btn-primary pointer-events-auto w-full gap-2 py-3.5 text-base shadow-lg shadow-brand/30"
          onClick={onStart}
          disabled={count === 0}
        >
          <Play size={18} className="fill-current" />
          Training starten
          {count > 0 && <span className="tabular font-medium opacity-80">· ~{estimateMinutes(count)} Min</span>}
        </button>
      </div>

      {pickerOpen && (
        <ExercisePickerSheet plan={plan} exercises={exercises} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}
