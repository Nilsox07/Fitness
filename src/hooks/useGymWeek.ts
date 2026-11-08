// Krafttage der Woche (Mo–So) mit „Beintag ja/nein“ – für die Hybrid-Abstimmung (src/lib/hybrid.ts).
// Nur mit festen Wochentagen oder Rotation; bei „flexibel“ ist nicht bekannt, wann trainiert wird.

import { useMemo } from 'react'
import { usePlans } from './usePlans'
import { useExercises } from './useExercises'
import { useTrainingRhythm } from './usePrefsSync'
import { localDate } from '../lib/day'
import { upcoming, weekdayIndex } from '../lib/schedule'
import { isLegPlan, type GymDay } from '../lib/hybrid'

export function useGymWeek(): { week: GymDay[]; known: boolean } {
  const today = localDate()
  const rhythm = useTrainingRhythm(today)
  const { data: plans } = usePlans()
  const { data: exercises } = useExercises()
  return useMemo(() => {
    const empty = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, gym: false, legs: false }))
    const s = rhythm.schedule
    if (!s || (s.type !== 'weekdays' && s.type !== 'rotation')) return { week: empty, known: false }
    const muscle = new Map((exercises ?? []).map((e) => [e.id, e.muscle_group as string]))
    const planBy = new Map((plans ?? []).map((p) => [p.id, p]))
    const planFor = new Map<number, string>()
    if (s.type === 'weekdays') s.days.forEach((id, d) => id && planFor.set(d, id))
    else
      for (const u of upcoming(s, rhythm.history, today, 7))
        if (u.plan.kind === 'train') planFor.set(weekdayIndex(u.date), u.plan.planId)
    const week = empty.map((w) => {
      const p = planBy.get(planFor.get(w.day) ?? '')
      return p ? { ...w, gym: true, legs: isLegPlan(p.exercise_ids, (id) => muscle.get(id)), planName: p.name } : w
    })
    return { week, known: week.some((w) => w.gym) }
  }, [rhythm.schedule, rhythm.history, plans, exercises, today])
}
