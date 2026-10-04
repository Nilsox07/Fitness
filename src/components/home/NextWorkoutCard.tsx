import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, Dumbbell, ListOrdered, Play, Plus, Sparkles } from 'lucide-react'
import { estimateMinutes, type RecoveryLevel } from '../../lib/home'
import type { Exercise, MuscleGroup, PlanWithExercises } from '../../types'
import { enter } from './motion'
import { PlanPickerSheet, lastDoneLabel } from './PlanPicker'
import { BuddyLine, HeroWithBuddy, type HeroBuddyData } from './HeroBuddy'

const DOT: Record<RecoveryLevel, string> = {
  fresh: 'bg-success',
  almost: 'bg-gold',
  tired: 'bg-brand/60',
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
  fromRhythm = false,
  buddy,
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
  /** Vorschlag kommt aus dem eigenen Trainingsrhythmus („Heute laut Rhythmus"). */
  fromRhythm?: boolean
  /** Buddy sitzt oben rechts auf der Karte, sein Spruch steht oben in der Karte. */
  buddy?: HeroBuddyData
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
        <HeroWithBuddy buddy={buddy}>
          <div className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg dark:bg-sand-light dark:text-cocoa">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/30 blur-3xl" />
            {buddy && (
              <div className="relative">
                <BuddyLine line={buddy.line} tone="dark" />
              </div>
            )}
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
        </HeroWithBuddy>
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
      <HeroWithBuddy buddy={buddy}>
        <div className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
          {/* dezenter Brand-Schimmer */}
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

          <div className="relative">
            {buddy && <BuddyLine line={buddy.line} tone="dark" />}
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
              {fromRhythm ? (
                <CalendarCheck size={13} className="text-brand" />
              ) : (
                <Sparkles size={13} className="text-brand" />
              )}
              {fromRhythm ? 'Heute laut Rhythmus' : 'Dein nächstes Training'}
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
      </HeroWithBuddy>

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
        <PlanPickerSheet
          plans={plans}
          highlightId={suggested.id}
          highlightLabel={fromRhythm ? 'Laut Rhythmus' : 'Vorschlag'}
          exerciseCount={(p) => exList(p).length}
          lastDone={lastDone}
          today={today}
          busy={busy}
          onPick={onStartPlan}
          onClose={() => setPickOpen(false)}
        />
      )}
    </section>
  )
}
