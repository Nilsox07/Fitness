import type { CSSProperties } from 'react'
import { Play, Sparkles } from 'lucide-react'
import { estimateMinutes } from '../../lib/home'
import type { Exercise, PlanWithExercises } from '../../types'
import { CoverageBar, MuscleChip } from '../exercises/MuscleBits'
import { agoShort, categoryShares, muscleWeights } from '../exercises/muscle'

const MAX_CHIPS = 3

/** Plan-Karte im Routine-Stil: Name, Muskel-Chips, Meta, Abdeckung, runder Play-Knopf. */
export function PlanCard({
  plan,
  exById,
  lastDone,
  today,
  suggested,
  onOpen,
  onStart,
  style,
}: {
  plan: PlanWithExercises
  exById: Map<string, Exercise>
  lastDone: string | null | undefined
  today: string
  suggested: boolean
  onOpen: () => void
  onStart: () => void
  style?: CSSProperties
}) {
  const exs = plan.exercise_ids.map((id) => exById.get(id)).filter((e): e is Exercise => Boolean(e))
  const count = plan.exercise_ids.length
  const weights = muscleWeights(exs)
  const shares = categoryShares(weights)
  const chips = weights.slice(0, MAX_CHIPS).map((w) => w.muscle)
  const more = weights.length - chips.length
  const ago = agoShort(lastDone, today)
  const dark = suggested

  const meta = [
    count === 0 ? 'Noch keine Übungen' : `${count} ${count === 1 ? 'Übung' : 'Übungen'}`,
    count > 0 ? `~${estimateMinutes(count)} Min` : null,
    ago ? `zuletzt ${ago}` : count > 0 ? 'noch nie' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      className={`relative overflow-hidden rounded-3xl ${
        dark
          ? 'bg-cocoa text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none'
          : 'bg-cream'
      }`}
      style={style}
    >
      {dark && (
        <>
          <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-brand/10 blur-3xl" />
        </>
      )}
      <div className="relative flex items-center gap-3 p-4">
        <button className="min-w-0 flex-1 text-left" onClick={onOpen} aria-label={`${plan.name} bearbeiten`}>
          {dark && (
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
              <Sparkles size={11} />
              Vorschlag
            </span>
          )}
          <span className={`block truncate font-bold tracking-tight ${dark ? 'text-2xl' : 'text-xl'}`}>{plan.name}</span>
          <span
            className={`tabular mt-0.5 block truncate text-xs ${dark ? 'text-bg/65 dark:text-cocoa-light' : 'text-cocoa-light'}`}
          >
            {meta}
          </span>

          {chips.length > 0 && (
            <span className="mt-2.5 flex flex-wrap gap-1.5">
              {chips.map((m) => (
                <MuscleChip key={m} muscle={m} onDark={dark} size="xs" />
              ))}
              {more > 0 && (
                <span
                  className={`tabular rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    dark ? 'bg-bg/10 text-bg/70 dark:bg-white/5 dark:text-cocoa-light' : 'bg-sand text-cocoa-light'
                  }`}
                >
                  +{more}
                </span>
              )}
            </span>
          )}

          {shares.length > 0 && <CoverageBar shares={shares} onDark={dark} className="mt-3 max-w-[85%]" />}
        </button>

        <button
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-on-brand transition active:scale-90 disabled:opacity-40 ${
            dark ? 'shadow-lg shadow-brand/40' : 'shadow-md shadow-brand/20'
          }`}
          onClick={onStart}
          disabled={count === 0}
          aria-label={`${plan.name} starten`}
        >
          <Play size={22} className="ml-0.5 fill-current" />
        </button>
      </div>
    </li>
  )
}
