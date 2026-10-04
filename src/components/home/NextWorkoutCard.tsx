import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Dumbbell, ListOrdered, Play, Plus, Sparkles } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { estimateMinutes, type RecoveryLevel } from '../../lib/home'
import { shiftDate } from '../../lib/day'
import type { Exercise, MuscleGroup, PlanWithExercises } from '../../types'
import { enter } from './motion'

const DOT: Record<RecoveryLevel, string> = {
  fresh: 'bg-success',
  almost: 'bg-gold',
  tired: 'bg-brand/60',
}

function lastDoneLabel(date: string | null | undefined, today: string): string {
  if (!date) return 'Noch nie trainiert'
  if (date === shiftDate(today, -1)) return 'Zuletzt gestern'
  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86400000)
  if (days <= 0) return 'Zuletzt heute'
  if (days < 14) return `Zuletzt vor ${days} Tagen`
  return `Zuletzt vor ${Math.round(days / 7)} Wochen`
}

/** Hero: „Dein nächstes Training" mit großem Start-Knopf, plus Plan-Auswahl. */
export function NextWorkoutCard({
  plans,
  suggested,
  exById,
  recovery,
  lastDone,
  today,
  busy,
  error,
  onStartPlan,
  onStartFree,
  index,
}: {
  plans: PlanWithExercises[]
  suggested: PlanWithExercises | null
  exById: Map<string, Exercise>
  recovery: Map<MuscleGroup, RecoveryLevel>
  lastDone: Map<string, string | null>
  today: string
  busy: boolean
  error: Error | null
  onStartPlan: (p: PlanWithExercises) => void
  onStartFree: () => void
  index: number
}) {
  const navigate = useNavigate()
  const [pickOpen, setPickOpen] = useState(false)

  const exList = (p: PlanWithExercises) =>
    p.exercise_ids.map((id) => exById.get(id)).filter((e): e is Exercise => Boolean(e))

  const errorLine = error && (
    <p className="text-sm text-red-500 dark:text-red-400">⚠️ {error.message}</p>
  )

  // ---- Noch keine Pläne ----
  if (!suggested) {
    return (
      <section className="space-y-2" style={enter(index)}>
        <div className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg dark:bg-sand-light dark:text-cocoa">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/30 blur-3xl" />
          <p className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
            <Sparkles size={13} className="text-brand" />
            Los geht's
          </p>
          <h2 className="relative mt-1 text-2xl font-bold tracking-tight">Leg deinen ersten Plan an</h2>
          <p className="relative mt-1 text-sm text-bg/70 dark:text-cocoa-light">
            Mit einem Plan startest du jedes Training mit einem Tipp — Reihenfolge, Gewichte und Sätze
            stehen schon bereit.
          </p>
          <button
            className="btn-primary relative mt-4 w-full gap-2 py-3.5 text-base"
            onClick={() => navigate('/plans')}
          >
            <Plus size={18} strokeWidth={2.5} />
            Plan erstellen
          </button>
        </div>
        <button className="btn-ghost w-full gap-2" onClick={onStartFree} disabled={busy}>
          <Dumbbell size={16} />
          Freies Training
        </button>
        {errorLine}
      </section>
    )
  }

  const exs = exList(suggested)
  const muscles = [...new Set(exs.map((e) => e.muscle_group))].filter((m) => m !== 'Sonstige')
  const minutes = estimateMinutes(exs.length)

  return (
    <section className="space-y-2" style={enter(index)}>
      <div className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
        {/* dezenter Brand-Schimmer */}
        <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
            <Sparkles size={13} className="text-brand" />
            Dein nächstes Training
          </p>
          <h2 className="mt-1 truncate text-3xl font-bold tracking-tight">{suggested.name}</h2>
          <p className="tabular mt-0.5 text-sm text-bg/70 dark:text-cocoa-light">
            {exs.length} {exs.length === 1 ? 'Übung' : 'Übungen'}
            {minutes > 0 && ` · ~${minutes} Min`}
            {' · '}
            {lastDoneLabel(lastDone.get(suggested.id), today)}
          </p>

          {exs.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {exs.slice(0, 4).map((e, i) => (
                <li key={e.id} className="flex items-center gap-2.5 text-sm">
                  <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bg/10 text-[10px] font-bold text-bg/70 dark:bg-white/5 dark:text-cocoa-light">
                    {i + 1}
                  </span>
                  <span className="truncate">{e.name}</span>
                </li>
              ))}
              {exs.length > 4 && (
                <li className="pl-7 text-xs text-bg/50 dark:text-cocoa-muted">+ {exs.length - 4} weitere</li>
              )}
            </ul>
          )}

          {muscles.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {muscles.map((m) => (
                <span
                  key={m}
                  className="flex items-center gap-1.5 rounded-full bg-bg/10 px-2.5 py-1 text-xs font-medium text-bg/85 dark:bg-white/5 dark:text-cocoa"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${DOT[recovery.get(m) ?? 'fresh']}`} />
                  {m}
                </span>
              ))}
            </div>
          )}

          <button
            className="btn-primary mt-5 w-full gap-2 py-3.5 text-base shadow-lg shadow-brand/30"
            disabled={busy}
            onClick={() => onStartPlan(suggested)}
          >
            <Play size={18} className="fill-current" />
            Training starten
          </button>
        </div>
      </div>

      <div className={`grid gap-2 ${plans.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {plans.length > 1 && (
          <button className="btn-ghost gap-2 text-sm" onClick={() => setPickOpen(true)} disabled={busy}>
            <ListOrdered size={16} />
            Anderer Plan
          </button>
        )}
        <button className="btn-ghost gap-2 text-sm" onClick={onStartFree} disabled={busy}>
          <Dumbbell size={16} />
          Freies Training
        </button>
      </div>
      {errorLine}

      {pickOpen && (
        <Sheet title="Plan wählen" onClose={() => setPickOpen(false)}>
          <div className="space-y-2">
            {plans.map((p) => {
              const n = exList(p).length
              const isSuggested = p.id === suggested.id
              return (
                <button
                  key={p.id}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                    isSuggested ? 'bg-brand/10 ring-1 ring-brand/30' : 'bg-sand-light ring-1 ring-sand-dark'
                  }`}
                  disabled={busy}
                  onClick={() => {
                    setPickOpen(false)
                    onStartPlan(p)
                  }}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
                    <Play size={16} className="ml-0.5 fill-current" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="tabular block truncate text-xs text-cocoa-light">
                      {n} {n === 1 ? 'Übung' : 'Übungen'}
                      {n > 0 && ` · ~${estimateMinutes(n)} Min`} · {lastDoneLabel(lastDone.get(p.id), today)}
                    </span>
                  </span>
                  {isSuggested ? (
                    <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">
                      Vorschlag
                    </span>
                  ) : (
                    <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
                  )}
                </button>
              )
            })}
          </div>
        </Sheet>
      )}
    </section>
  )
}
