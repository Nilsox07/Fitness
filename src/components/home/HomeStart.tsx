import { useMemo } from 'react'
import { useExercises } from '../../hooks/useExercises'
import { usePlans } from '../../hooks/usePlans'
import { useAllSets, useWorkouts } from '../../hooks/useWorkouts'
import { useMyProfile } from '../../hooks/useSocial'
import { useStreakState } from '../../hooks/useStreak'
import { lastTrainedPerMuscle, sessionDates } from '../../lib/analytics'
import { weekStreakWithFreezes } from '../../lib/streaks'
import { getPlanQueue } from '../../lib/workoutSession'
import { useTrainingRhythm } from '../../hooks/usePrefsSync'
import { isConfigured, plannedTrainingDates, upcoming } from '../../lib/schedule'
import {
  lastDoneByPlan,
  lastSessionStats,
  recoveryLevel,
  suggestNextPlan,
  weekDates,
  type RecoveryLevel,
} from '../../lib/home'
import { MUSCLE_GROUPS, type MuscleGroup, type PlanWithExercises } from '../../types'
import { HomeHeader } from './HomeHeader'
import { useBuddy } from '../buddy/useBuddy'
import { WeekStrip } from './WeekStrip'
import { NextWorkoutCard } from './NextWorkoutCard'
import { RecoveryCard, type MuscleState } from './RecoveryCard'
import { LastWorkoutCard } from './LastWorkoutCard'
import { NutritionRow } from './NutritionRow'
import { ChallengeCard } from './ChallengeCard'
import { RestDayCard } from './RestDayCard'
import { RhythmPrompt } from './RhythmPrompt'

const SKIP_MUSCLES = new Set<MuscleGroup>(['Sonstige', 'Ganzkörper'])

/** „morgen", „übermorgen", „am Mittwoch". */
function whenLabel(offset: number, date: string): string {
  if (offset === 1) return 'morgen'
  if (offset === 2) return 'übermorgen'
  return `am ${new Date(date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long' })}`
}

/**
 * „Heute"-Start-Screen im Neu-Modus (noch kein Training heute):
 * Begrüßung, Wochenleiste, nächstes Training, Erholung, letztes Training.
 */
export function HomeStart({
  today,
  busy,
  error,
  onStartPlan,
  onStartFree,
}: {
  /** Trainings-Tag (YYYY-MM-DD) */
  today: string
  busy: boolean
  error: Error | null
  onStartPlan: (p: PlanWithExercises) => void
  onStartFree: () => void
}) {
  const { data: workouts } = useWorkouts()
  const { data: allSets } = useAllSets()
  const { data: exercises } = useExercises()
  const { data: plans } = usePlans()
  const { data: profile } = useMyProfile()
  const { data: streakState } = useStreakState()
  const buddy = useBuddy()
  const rhythm = useTrainingRhythm(today)

  const dates = useMemo(() => sessionDates(allSets ?? []), [allSets])
  const trainedDates = useMemo(() => new Set(dates), [dates])
  const streak = weekStreakWithFreezes(dates, streakState?.frozen_weeks ?? [])

  const exById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])

  // Erholung je Muskelgruppe — nur Gruppen, die in den eigenen Übungen vorkommen.
  const muscleStates = useMemo<MuscleState[]>(() => {
    if (!exercises) return []
    const now = new Date(today + 'T12:00:00')
    const last = new Map(lastTrainedPerMuscle(allSets ?? [], exercises, now).map((r) => [r.muscle, r.daysAgo]))
    const own = new Set(exercises.map((e) => e.muscle_group))
    return MUSCLE_GROUPS.filter((m) => own.has(m) && !SKIP_MUSCLES.has(m)).map((m) => {
      const daysAgo = last.get(m) ?? null
      return { muscle: m, daysAgo, level: recoveryLevel(daysAgo) }
    })
  }, [exercises, allSets, today])
  const recovery = useMemo(
    () => new Map<MuscleGroup, RecoveryLevel>(muscleStates.map((s) => [s.muscle, s.level])),
    [muscleStates],
  )

  // Wann lief welcher Plan zuletzt? (gemerkte Plan-Zuordnung + Übungs-Überschneidung)
  const { suggested, lastDone } = useMemo(() => {
    const list = plans ?? []
    const queueDates = new Map<string, string>()
    for (const w of workouts ?? []) {
      if (w.date >= today) continue
      const q = getPlanQueue(w.id)
      if (q && (queueDates.get(q.planId) ?? '') < w.date) queueDates.set(q.planId, w.date)
    }
    const sets = allSets ?? []
    return {
      suggested: suggestNextPlan(list, sets, queueDates),
      lastDone: lastDoneByPlan(list, sets, queueDates),
    }
  }, [plans, workouts, allSets, today])

  // Trainingsrhythmus: was steht heute an, welche Tage sind diese Woche geplant?
  const planById = useMemo(() => new Map((plans ?? []).map((p) => [p.id, p])), [plans])
  const planned = useMemo(
    () => plannedTrainingDates(rhythm.schedule, rhythm.history, today, weekDates(today)),
    [rhythm.schedule, rhythm.history, today],
  )
  const rhythmPlan = rhythm.today.kind === 'train' ? (planById.get(rhythm.today.planId) ?? null) : null
  const isRest = rhythm.today.kind === 'rest'
  const nextUp = useMemo(() => {
    if (!isRest) return null
    const days = upcoming(rhythm.schedule, rhythm.history, today, 8)
    for (let k = 1; k < days.length; k++) {
      const p = days[k].plan
      if (p.kind === 'train') {
        const plan = planById.get(p.planId)
        if (plan) return { plan, name: plan.name, when: whenLabel(k, days[k].date) }
      }
    }
    return null
  }, [isRest, rhythm.schedule, rhythm.history, today, planById])
  const showPrompt = rhythm.ready && (plans?.length ?? 0) > 0 && !isConfigured(rhythm.schedule)

  const last = useMemo(() => lastSessionStats(allSets ?? [], today), [allSets, today])
  const lastNames = (last?.exerciseIds ?? []).map((id) => exById.get(id)?.name).filter((n): n is string => Boolean(n))

  const dateLabel = new Date(today + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  let i = 0
  return (
    <div className="space-y-4">
      <HomeHeader name={profile?.display_name ?? null} dateLabel={dateLabel} streak={streak} buddy={buddy} />
      <WeekStrip today={today} trainedDates={trainedDates} goal={rhythm.goal} planned={planned} index={++i} />
      {showPrompt && <RhythmPrompt index={++i} />}
      {plans === undefined ? (
        <div className="h-72 animate-pulse rounded-3xl bg-sand" aria-hidden />
      ) : isRest && plans.length > 0 ? (
        <RestDayCard
          plans={plans}
          nextUp={nextUp && { name: nextUp.name, when: nextUp.when }}
          highlightId={nextUp?.plan.id ?? suggested?.id ?? null}
          exerciseCount={(p) => p.exercise_ids.filter((id) => exById.has(id)).length}
          lastDone={lastDone}
          today={today}
          busy={busy}
          error={error}
          onStartPlan={onStartPlan}
          onStartFree={onStartFree}
          index={++i}
        />
      ) : (
        <NextWorkoutCard
          plans={plans}
          suggested={rhythmPlan ?? suggested}
          fromRhythm={Boolean(rhythmPlan)}
          exById={exById}
          recovery={recovery}
          lastDone={lastDone}
          today={today}
          busy={busy}
          error={error}
          onStartPlan={onStartPlan}
          onStartFree={onStartFree}
          index={++i}
        />
      )}
      <RecoveryCard items={muscleStates} index={++i} />
      {last && <LastWorkoutCard stats={last} today={today} names={lastNames} index={++i} />}
      <NutritionRow allSets={allSets} index={++i} />
      <ChallengeCard index={++i} />
    </div>
  )
}
