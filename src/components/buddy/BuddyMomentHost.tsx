import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAllSets } from '../../hooks/useWorkouts'
import { useUserPrefs, useWeeklyGoal } from '../../hooks/usePrefsSync'
import { sessionDates, isoWeekKey } from '../../lib/analytics'
import { sessionsInWeek } from '../../lib/home'
import { trainingDay } from '../../lib/day'
import { mascotStageIndex } from '../../lib/cosmetics'
import {
  BUDDY_MOMENT_EVENT,
  BuddyMoment,
  hasSeenBuddyMoment,
  markBuddyMomentSeen,
  showBuddyMoment,
  type BuddyMomentEventDetail,
  type BuddyMomentOptions,
} from './BuddyMoment'
import { BuddyLevelUp } from './BuddyLevelUp'
import { BUDDY_STAGE_LABELS } from './Buddy'


let seq = 0

/** localStorage: zuletzt gefeierte Wachstumsstufe. */
const SEEN_STAGE_KEY = 'seen_buddy_stage'

/**
 * Einmal in `App.tsx` (neuer Modus) mounten: zeigt Buddy-Momente nacheinander an
 * und beobachtet die automatischen Meilensteine (Wochenziel, Entwicklung, Level-up).
 */
export function BuddyMomentHost() {
  const [queue, setQueue] = useState<{ id: number; moment: BuddyMomentOptions }[]>([])

  useEffect(() => {
    const onMoment = (e: Event) => {
      const detail = (e as CustomEvent<BuddyMomentEventDetail>).detail
      const m = detail?.moment
      if (!m || !m.title) return
      if (m.key) {
        if (hasSeenBuddyMoment(m.key)) return
        markBuddyMomentSeen(m.key)
      }
      detail.accepted = true
      seq += 1
      const id = seq
      setQueue((q) => [...q, { id, moment: m }])
    }
    window.addEventListener(BUDDY_MOMENT_EVENT, onMoment)
    return () => window.removeEventListener(BUDDY_MOMENT_EVENT, onMoment)
  }, [])

  const next = useCallback(() => setQueue((q) => q.slice(1)), [])
  const current = queue[0]

  return (
    <>
      <BuddyMilestones />
      {/* key → jeder Moment bekommt frische Timer/Konfetti */}
      {current && <BuddyMoment key={current.id} moment={current.moment} onClose={next} />}
    </>
  )
}

/**
 * Automatische Meilensteine. Während eines laufenden Trainings (Startseite mit heutigem
 * Training bzw. Schnell-Workout) bleibt es still — gefeiert wird danach.
 */
function BuddyMilestones() {
  const { pathname } = useLocation()
  const { data: allSets } = useAllSets()
  const { isLoading: prefsLoading } = useUserPrefs()
  const goal = useWeeklyGoal()
  const today = trainingDay()

  const dates = useMemo(() => (allSets ? sessionDates(allSets) : null), [allSets])
  const trainedToday = Boolean(dates?.includes(today))
  const quiet = (pathname === '/' && trainedToday) || pathname.startsWith('/quick')

  // (a) Wochenziel erreicht
  const weekly = dates ? sessionsInWeek(dates, today) : 0
  useEffect(() => {
    if (quiet || !dates || prefsLoading || goal <= 0 || weekly < goal) return
    showBuddyMoment({
      key: `goal-${isoWeekKey(today)}`,
      mood: 'proud',
      title: 'Wochenziel geschafft!',
      subtitle:
        weekly > goal
          ? `${weekly} Trainings diese Woche – alles Weitere ist Bonus.`
          : `${goal} von ${goal} Trainings – ich bin so stolz auf dich!`,
      chips: [
        { value: String(weekly), label: weekly === 1 ? 'Training' : 'Trainings' },
        { value: String(dates.length), label: 'Gesamt' },
      ],
    })
  }, [quiet, dates, prefsLoading, goal, weekly, today])

  // (b) Buddy-Entwicklung (neue Wachstumsstufe)
  const stage = dates ? mascotStageIndex(dates.length) : null
  useEffect(() => {
    if (quiet || stage == null) return
    let seen = NaN
    try {
      const raw = localStorage.getItem(SEEN_STAGE_KEY)
      seen = raw == null ? NaN : Number(raw)
      // Erster Start: aktuelle Stufe übernehmen, nicht feiern. Gespeicherte Stufe sinkt nie.
      if (!Number.isFinite(seen) || stage > seen) localStorage.setItem(SEEN_STAGE_KEY, String(stage))
    } catch {
      return
    }
    if (!Number.isFinite(seen) || stage <= seen) return
    showBuddyMoment({
      key: `stage-${stage}`,
      mood: 'cheer',
      title: 'Dein Buddy hat sich entwickelt!',
      subtitle: `${BUDDY_STAGE_LABELS[seen] ?? 'Ei'} → ${BUDDY_STAGE_LABELS[stage] ?? ''}`,
      fromStage: seen,
      stage,
      chips: [{ value: String(dates?.length ?? 0), label: 'Trainings' }],
    })
  }, [quiet, stage, dates])

  // (c) Level-up (eigene Merk-Logik in useBuddyLevelUp)
  return quiet ? null : <BuddyLevelUp />
}
