import { useEffect, useMemo } from 'react'
import { useStreakState, useUpdateStreakState } from '../hooks/useStreak'
import {
  completedPerfectWeeks,
  currentWeekKey,
  perfectWeeksCount,
  trainedThisWeek,
  weekStreakWithFreezes,
} from '../lib/streaks'
import type { SetWithDate } from '../types'

export function StreakCard({ sets }: { sets: SetWithDate[] }) {
  const { data: state, isLoading } = useStreakState()
  const update = useUpdateStreakState()

  const dates = useMemo(() => sets.map((s) => s.date), [sets])
  const frozen = state?.frozen_weeks ?? []
  const streak = weekStreakWithFreezes(dates, frozen)
  const perfect = perfectWeeksCount(dates)
  const trained = trainedThisWeek(dates)
  const week = currentWeekKey()
  const newestPerfect = useMemo(() => {
    const p = completedPerfectWeeks(dates)
    return p[p.length - 1]
  }, [dates])

  // Freeze verdienen: pro neu abgeschlossener perfekter Woche +1
  useEffect(() => {
    if (isLoading) return
    if (state === null) {
      update.mutate({ freezes: 1, frozen_weeks: [], last_award_week: newestPerfect ?? null })
      return
    }
    if (state && newestPerfect && (!state.last_award_week || newestPerfect > state.last_award_week)) {
      update.mutate({ freezes: state.freezes + 1, last_award_week: newestPerfect })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, state, newestPerfect])

  const canFreeze = !trained && (state?.freezes ?? 0) > 0 && !frozen.includes(week)

  function useFreeze() {
    if (!state || state.freezes <= 0 || frozen.includes(week)) return
    update.mutate({ freezes: state.freezes - 1, frozen_weeks: [...frozen, week] })
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">🔥 Serie</h2>
        <span className="text-sm text-cocoa-light">❄️ {state?.freezes ?? 0} Freeze</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-3xl font-bold text-brand">{streak}</div>
        <div className="text-sm text-cocoa-light">
          Wochen am Stück
          {frozen.includes(week) && <span className="ml-1 text-xs">(diese Woche ❄️)</span>}
        </div>
      </div>

      {!trained && !frozen.includes(week) && (
        <div className="rounded-xl bg-amber-500/15 p-2.5 text-sm ring-1 ring-amber-500/30">
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            Diese Woche noch kein Training.
          </span>
          {canFreeze ? (
            <button className="btn-primary mt-2 w-full text-sm" onClick={useFreeze}>
              ❄️ Freeze einsetzen (Serie retten)
            </button>
          ) : (
            <p className="mt-1 text-xs text-cocoa-light">
              {(state?.freezes ?? 0) === 0
                ? 'Kein Freeze übrig — trainiere, um die Serie zu halten.'
                : ''}
            </p>
          )}
        </div>
      )}

      <div className="text-xs text-cocoa-muted">
        ✨ Perfekte Wochen (4+ Trainings): <span className="font-semibold text-cocoa">{perfect}</span> ·
        Freeze gibt's für jede perfekte Woche.
      </div>
    </section>
  )
}
