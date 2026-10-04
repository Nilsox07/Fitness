import { useState } from 'react'
import { Dumbbell, Footprints, Moon, Play, StretchHorizontal } from 'lucide-react'
import type { PlanWithExercises } from '../../types'
import { enter } from './motion'
import { PlanPickerSheet } from './PlanPicker'
import { BuddyLine, HeroWithBuddy, type HeroBuddyData } from './HeroBuddy'

const IDEAS = [
  { icon: Footprints, title: 'Spaziergang', sub: '20–30 Min an der frischen Luft' },
  { icon: StretchHorizontal, title: 'Dehnen', sub: '10 Min Mobility für Hüfte & Schultern' },
]

/** Ruhiger Hero für Ruhetage laut Rhythmus — mit „Trotzdem trainieren". */
export function RestDayCard({
  plans,
  nextUp,
  highlightId,
  exerciseCount,
  lastDone,
  today,
  busy,
  error,
  onStartPlan,
  onStartFree,
  index,
  buddy,
}: {
  plans: PlanWithExercises[]
  /** Nächstes geplantes Training, z. B. { name: 'Pull', when: 'morgen' } */
  nextUp: { name: string; when: string } | null
  highlightId: string | null
  exerciseCount: (p: PlanWithExercises) => number
  lastDone: Map<string, string | null>
  today: string
  busy: boolean
  error: Error | null
  onStartPlan: (p: PlanWithExercises) => void
  onStartFree: () => void
  index: number
  /** Buddy sitzt oben rechts auf der Karte, sein Spruch steht oben in der Karte. */
  buddy?: HeroBuddyData
}) {
  const [pickOpen, setPickOpen] = useState(false)

  return (
    <section className="space-y-2" style={enter(index)}>
      <HeroWithBuddy buddy={buddy}>
        <div className="relative overflow-hidden rounded-3xl bg-cream p-5 ring-1 ring-sand-dark/40">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gold/15 blur-3xl" />
          <div className="relative">
            {buddy && <BuddyLine line={buddy.line} tone="light" />}
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sand text-cocoa-light">
                <Moon size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">Laut Rhythmus</p>
                <h2 className="text-2xl font-bold tracking-tight">Heute Ruhetag</h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-cocoa-light">
              Erholung gehört zum Plan — in der Pause werden deine Muskeln stärker.
            </p>

            <ul className="mt-4 space-y-2">
              {IDEAS.map(({ icon: Icon, title, sub }) => (
                <li key={title} className="flex items-center gap-3 rounded-2xl bg-sand/70 px-3 py-2.5">
                  <Icon size={18} className="shrink-0 text-cocoa-light" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block truncate text-xs text-cocoa-light">{sub}</span>
                  </span>
                </li>
              ))}
            </ul>

            {nextUp && (
              <p className="mt-4 text-sm text-cocoa-light">
                Als Nächstes: <span className="font-semibold text-cocoa">{nextUp.name}</span> · {nextUp.when}
              </p>
            )}
          </div>
        </div>
      </HeroWithBuddy>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn-ghost gap-2 text-sm"
          onClick={() => (plans.length > 0 ? setPickOpen(true) : onStartFree())}
          disabled={busy}
        >
          <Play size={15} />
          Trotzdem trainieren
        </button>
        <button className="btn-ghost gap-2 text-sm" onClick={onStartFree} disabled={busy}>
          <Dumbbell size={16} />
          Freies Training
        </button>
      </div>
      {error && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {error.message}</p>}

      {pickOpen && (
        <PlanPickerSheet
          plans={plans}
          highlightId={highlightId}
          highlightLabel="Als Nächstes"
          exerciseCount={exerciseCount}
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
